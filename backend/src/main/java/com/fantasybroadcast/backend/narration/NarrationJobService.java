package com.fantasybroadcast.backend.narration;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.Executor;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import com.fantasybroadcast.backend.live.FantasyEventView;
import com.fantasybroadcast.backend.live.LiveStateResponse;
import com.fantasybroadcast.backend.live.MatchupView;
import com.fantasybroadcast.backend.live.PlayerView;
import com.fantasybroadcast.backend.live.TeamView;

import jakarta.annotation.PreDestroy;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

@Service
@Profile("db & !test")
public class NarrationJobService {
	private static final Logger log = LoggerFactory.getLogger(NarrationJobService.class);

	private final NarrationProperties properties;
	private final BroadcastNarrationRepository repository;
	private final NarrationEventSelector eventSelector;
	private final NarrationBudgetService budgetService;
	private final CommentaryTextGenerator textGenerator;
	private final VoiceNarrationGenerator voiceGenerator;
	private final Executor executor;

	@Autowired
	public NarrationJobService(NarrationProperties properties, BroadcastNarrationRepository repository,
			NarrationEventSelector eventSelector, NarrationBudgetService budgetService, CommentaryTextGenerator textGenerator,
			VoiceNarrationGenerator voiceGenerator) {
		this(properties, repository, eventSelector, budgetService, textGenerator, voiceGenerator, Executors.newFixedThreadPool(2));
	}

	NarrationJobService(NarrationProperties properties, BroadcastNarrationRepository repository,
			NarrationEventSelector eventSelector, NarrationBudgetService budgetService, CommentaryTextGenerator textGenerator,
			VoiceNarrationGenerator voiceGenerator, Executor executor) {
		this.properties = properties;
		this.repository = repository;
		this.eventSelector = eventSelector;
		this.budgetService = budgetService;
		this.textGenerator = textGenerator;
		this.voiceGenerator = voiceGenerator;
		this.executor = executor;
	}

	public boolean enqueueForEvents(long leagueId, LiveStateResponse state) {
		return enqueueForEvents(leagueId, state, true);
	}

	public boolean enqueueForEvents(long leagueId, LiveStateResponse state, boolean voiceNarrationEnabled) {
		if (!properties.isEnabled() || state.events().isEmpty()) return false;
		var events = selectedEvents(state);
		if (events.isEmpty()) return false;
		var sourceEventId = sourceEventId(events);
		if (!budgetService.canCreateNarration(leagueId, state.gameweek())) {
			log.info("Skipping narration: leagueId={}, gameweek={}, sourceEventId={}, reason=league_gameweek_limit",
					leagueId, state.gameweek(), sourceEventId);
			return false;
		}
		repository.createPendingIfAbsent(leagueId, state.gameweek(), sourceEventId)
				.ifPresent(narration -> executor.execute(() -> generate(narration.id(), context(leagueId, state, events, voiceNarrationEnabled))));
		return true;
	}

	public Optional<GeneratedCommentary> generateMockText(LiveStateResponse state) {
		var events = selectedEvents(state);
		if (events.isEmpty()) return Optional.empty();
		return Optional.of(textGenerator.generate(context(0, state, events, false)));
	}

	public Optional<BroadcastNarration> generateMockNarration(long leagueId, LiveStateResponse state, boolean voiceNarrationEnabled) {
		var events = selectedEvents(state);
		if (events.isEmpty()) return Optional.empty();
		var sourceEventId = "mock-" + sourceEventId(events);
		var narration = repository.createPending(leagueId, state.gameweek(), sourceEventId);
		generate(narration.id(), context(leagueId, state, events, voiceNarrationEnabled));
		return repository.findById(narration.id());
	}

	/** Returns true only when every narration selected for this notification is ready to publish. */
	public boolean areNarrationsReady(long leagueId, LiveStateResponse state, boolean voiceNarrationEnabled) {
		var events = selectedEvents(state);
		if (events.isEmpty()) return true;
		var sourceEventId = sourceEventId(events);
		var expectedStatus = properties.isAudioEnabled() && voiceNarrationEnabled
				? NarrationStatus.AUDIO_READY
				: NarrationStatus.TEXT_READY;
		return repository
				.findBySourceEvent(leagueId, state.gameweek(), sourceEventId)
				.map(narration -> narration.status() == expectedStatus || textFallbackReady(expectedStatus, narration))
				.orElse(false);
	}

	public List<String> sourceEventIdsForState(LiveStateResponse state) {
		var events = selectedEvents(state);
		return events.isEmpty() ? List.of() : List.of(sourceEventId(events));
	}

	public List<String> mockSourceEventIdsForState(LiveStateResponse state) {
		return sourceEventIdsForState(state).stream()
				.map(sourceEventId -> "mock-" + sourceEventId)
				.toList();
	}

	private boolean textFallbackReady(NarrationStatus expectedStatus, BroadcastNarration narration) {
		return expectedStatus == NarrationStatus.AUDIO_READY
				&& narration.status() == NarrationStatus.TEXT_READY
				&& narration.errorMessage() != null
				&& !narration.errorMessage().isBlank();
	}

	void generate(long narrationId, NarrationContext context) {
		try {
			var commentary = textGenerator.generate(context);
			var narration = repository.markTextReady(narrationId, commentary.text(), commentary.inputTokens(), commentary.outputTokens()).orElseThrow();
			if (!properties.isAudioEnabled() || !context.voiceNarrationEnabled()) {
				return;
			}
			if (!budgetService.canGenerateAudio(narration.text().length())) {
				log.info("Publishing text-only narration: narrationId={}, reason=monthly_tts_budget", narration.id());
				repository.markAudioFailedTextReady(narration.id(), "monthly_tts_budget");
				return;
			}
			try {
				var voice = voiceGenerator.generate(context.sourceEventId(), narration.text());
				repository.markAudioReady(narration.id(), voice.audioPath(), voice.characters(), voice.expiresAt());
			}
			catch (RuntimeException exception) {
				log.warn("Voice narration generation failed; publishing text-only narration: narrationId={}, sourceEventId={}",
						narration.id(), context.sourceEventId(), exception);
				repository.markAudioFailedTextReady(narration.id(), exception.getMessage());
			}
		}
		catch (RuntimeException exception) {
			log.warn("Narration generation failed: narrationId={}, sourceEventId={}", narrationId, context.sourceEventId(), exception);
			repository.markFailed(narrationId, exception.getMessage());
		}
	}

	private List<FantasyEventView> selectedEvents(LiveStateResponse state) {
		var highlightManagers = highlightManagerIds(state);
		return state.events().stream()
				.filter(eventSelector::shouldNarrate)
				.filter(event -> highlightManagers.contains(event.managerId()))
				.toList();
	}

	private NarrationContext context(long leagueId, LiveStateResponse state, List<FantasyEventView> events, boolean voiceNarrationEnabled) {
		return new NarrationContext(sourceEventId(events), eventType(events), narrationData(state),
				properties.getLimits().getMaxTextCharacters(), voiceNarrationEnabled);
	}

	private String eventType(List<FantasyEventView> events) {
		return events.size() == 1 ? events.getFirst().type() : "NOTIFICATION";
	}

	private String sourceEventId(List<FantasyEventView> events) {
		if (events.size() == 1) return events.getFirst().id();
		var joined = events.stream().map(FantasyEventView::id).collect(java.util.stream.Collectors.joining("|"));
		return "notification-" + sha256(joined).substring(0, 16);
	}

	private String sha256(String value) {
		try {
			var digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
			return HexFormat.of().formatHex(digest);
		}
		catch (NoSuchAlgorithmException exception) {
			throw new IllegalStateException("SHA-256 is unavailable", exception);
		}
	}

	private String narrationData(LiveStateResponse state) {
		var highlightManagers = highlightManagerIds(state);
		var teams = highlightedTeams(state, highlightManagers);
		var changedPlayers = changedPlayers(state, teams);
		return """
				%s
				events:
				%s
				changed_players:
				%s
				""".formatted(teamScoreBlock(state, teams, changedPlayers), eventLines(state, changedPlayers), playerLines(changedPlayers));
	}

	private Set<String> highlightManagerIds(LiveStateResponse state) {
		var matchup = state.matchups().stream()
				.max(java.util.Comparator.comparingInt(candidate -> state.events().stream()
						.filter(event -> event.managerId().equals(candidate.home().managerId()) || event.managerId().equals(candidate.away().managerId()))
						.mapToInt(event -> Math.abs(event.pointDelta())).sum()))
				.orElse(null);
		if (matchup != null) return Set.of(matchup.home().managerId(), matchup.away().managerId());
		return state.events().stream()
				.max(java.util.Comparator.comparingInt(event -> Math.abs(event.pointDelta())))
				.map(event -> Set.of(event.managerId()))
				.orElse(Set.of());
	}

	private List<TeamView> highlightedTeams(LiveStateResponse state, Set<String> highlightManagers) {
		var matchup = highlightedMatchup(state, highlightManagers);
		if (matchup != null) return List.of(matchup.home(), matchup.away());
		return state.teams().stream()
				.filter(team -> highlightManagers.contains(team.managerId()))
				.toList();
	}

	private MatchupView highlightedMatchup(LiveStateResponse state, Set<String> highlightManagers) {
		return state.matchups().stream()
				.filter(candidate -> highlightManagers.contains(candidate.home().managerId())
						|| highlightManagers.contains(candidate.away().managerId()))
				.findFirst()
				.orElse(null);
	}

	private String teamScoreBlock(LiveStateResponse state, List<TeamView> teams, List<ChangedPlayer> changedPlayers) {
		var prefix = highlightedMatchup(state, teams.stream().map(TeamView::managerId).collect(java.util.stream.Collectors.toSet())) == null
				? "club:"
				: "match:";
		var lines = teams.stream()
				.map(team -> "- " + team.clubName() + ": " + (team.score() - teamDelta(team, changedPlayers)) + " -> " + team.score())
				.toList();
		return prefix + "\n" + lines(lines);
	}

	private int teamDelta(TeamView team, List<ChangedPlayer> changedPlayers) {
		return changedPlayers.stream()
				.filter(change -> change.team().managerId().equals(team.managerId()))
				.mapToInt(ChangedPlayer::delta)
				.sum();
	}

	private List<ChangedPlayer> changedPlayers(LiveStateResponse state, List<TeamView> teams) {
		var teamsByManager = new LinkedHashMap<String, TeamView>();
		for (var team : teams) teamsByManager.put(team.managerId(), team);
		var deltas = new LinkedHashMap<String, Integer>();
		for (var event : state.events()) {
			if (!teamsByManager.containsKey(event.managerId())) continue;
			deltas.merge(event.managerId() + "\t" + event.playerId(), event.pointDelta(), Integer::sum);
		}
		var changes = new ArrayList<ChangedPlayer>();
		for (var entry : deltas.entrySet()) {
			if (entry.getValue() == 0) continue;
			var parts = entry.getKey().split("\t", 2);
			var team = teamsByManager.get(parts[0]);
			if (team == null) continue;
			var player = findPlayer(team, parts[1]);
			if (player == null) continue;
			changes.add(new ChangedPlayer(team, player, entry.getValue()));
		}
		changes.sort(Comparator.comparingInt((ChangedPlayer change) -> Math.abs(change.delta())).reversed());
		return changes;
	}

	private PlayerView findPlayer(TeamView team, String playerId) {
		return java.util.stream.Stream.concat(team.activePlayers().stream(), team.benchPlayers().stream())
				.filter(player -> player.id().equals(playerId))
				.findFirst()
				.orElse(null);
	}

	private String playerLines(List<ChangedPlayer> changedPlayers) {
		var lines = changedPlayers.stream()
				.map(change -> "- " + change.team().clubName() + " / " + change.player().displayName() + ": "
						+ (change.player().points() - change.delta()) + " -> " + change.player().points())
				.toList();
		return lines(lines);
	}

	private String eventLines(LiveStateResponse state, List<ChangedPlayer> changedPlayers) {
		var eventsByPlayer = new LinkedHashMap<String, List<String>>();
		for (var event : state.events()) {
			if (!eventSelector.shouldNarrate(event)) continue;
			var changedPlayer = changedPlayers.stream()
					.filter(change -> change.team().managerId().equals(event.managerId()) && change.player().id().equals(event.playerId()))
					.findFirst()
					.orElse(null);
			if (changedPlayer == null) continue;
			var key = changedPlayer.team().clubName() + " / " + changedPlayer.player().displayName();
			eventsByPlayer.computeIfAbsent(key, unused -> new ArrayList<>()).add(eventLabel(event));
		}
		var lines = eventsByPlayer.entrySet().stream()
				.map(entry -> "- " + entry.getKey() + ": " + String.join(", ", distinct(entry.getValue())))
				.toList();
		return lines(lines);
	}

	private String eventLabel(FantasyEventView event) {
		return switch (event.type()) {
			case "GOAL" -> "goal";
			case "ASSIST" -> "assist";
			case "RED_CARD" -> "red card";
			case "PENALTY_SAVED" -> "penalty saved";
			case "PENALTY_MISSED" -> "penalty missed";
			case "PENALTY_SCORED" -> "penalty scored";
			case "CLEAN_SHEET" -> event.pointDelta() >= 0 ? "clean sheet gained" : "clean sheet lost";
			case "CLEAN_SHEET_LOST" -> "clean sheet lost";
			case "BONUS" -> event.pointDelta() >= 0 ? "bonus increased" : "bonus decreased";
			default -> event.type().toLowerCase().replace('_', ' ');
		};
	}

	private List<String> distinct(List<String> values) {
		var distinct = new ArrayList<String>();
		for (var value : values) if (!distinct.contains(value)) distinct.add(value);
		return distinct;
	}

	private record ChangedPlayer(TeamView team, PlayerView player, int delta) {
	}

	private static String lines(List<String> lines) {
		return lines.isEmpty() ? "- none" : String.join("\n", lines);
	}

	@PreDestroy
	void shutdown() {
		if (executor instanceof ExecutorService executorService) {
			executorService.shutdownNow();
		}
	}
}
