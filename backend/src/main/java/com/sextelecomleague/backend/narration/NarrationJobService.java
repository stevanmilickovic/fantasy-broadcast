package com.sextelecomleague.backend.narration;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.Executor;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import com.sextelecomleague.backend.live.FantasyEventView;
import com.sextelecomleague.backend.live.LiveStateResponse;

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
		var staged = false;
		for (var event : selectedEvents(state)) {
			if (!budgetService.canCreateNarration(leagueId, state.gameweek())) {
				log.info("Skipping narration: leagueId={}, gameweek={}, sourceEventId={}, reason=league_gameweek_limit",
						leagueId, state.gameweek(), event.id());
				continue;
			}
			staged = true;
			repository.createPendingIfAbsent(leagueId, state.gameweek(), event.id())
					.ifPresent(narration -> executor.execute(() -> generate(narration.id(), context(leagueId, state, event, voiceNarrationEnabled))));
		}
		return staged;
	}

	public Optional<GeneratedCommentary> generateMockText(LiveStateResponse state, FantasyEventView event) {
		if (!properties.isEnabled() || !selectedEvents(state).contains(event)) return Optional.empty();
		return Optional.of(textGenerator.generate(context(0, state, event, false)));
	}

	/** Returns true only when every narration selected for this notification is ready to publish. */
	public boolean areNarrationsReady(long leagueId, LiveStateResponse state, boolean voiceNarrationEnabled) {
		var expectedStatus = properties.isAudioEnabled() && voiceNarrationEnabled
				? NarrationStatus.AUDIO_READY
				: NarrationStatus.TEXT_READY;
		return selectedEvents(state).stream().allMatch(event -> repository
				.findBySourceEvent(leagueId, state.gameweek(), event.id())
				.map(narration -> narration.status() == expectedStatus)
				.orElse(false));
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
				return;
			}
			var voice = voiceGenerator.generate(context.sourceEventId(), narration.text());
			repository.markAudioReady(narration.id(), voice.audioPath(), voice.characters(), voice.expiresAt());
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

	private NarrationContext context(long leagueId, LiveStateResponse state, FantasyEventView event, boolean voiceNarrationEnabled) {
		return new NarrationContext(leagueId, state.gameweek(), event.id(), event.type(), event.managerId(),
				event.playerId(), event.summary(), notificationContext(state), event.pointDelta(), properties.getLimits().getMaxTextCharacters(),
				voiceNarrationEnabled);
	}

	private String notificationContext(LiveStateResponse state) {
		var highlightManagers = highlightManagerIds(state);
		var events = state.events().stream().filter(event -> highlightManagers.contains(event.managerId()))
				.map(event -> "- " + event.summary() + " (club=" + clubName(state, event.managerId()) + ", player=" + event.playerId()
						+ ", type=" + event.type() + ", delta=" + signed(event.pointDelta()) + ")")
				.toList();
		var matchup = state.matchups().stream()
				.filter(candidate -> highlightManagers.contains(candidate.home().managerId()))
				.findFirst();
		var result = matchup
				.map(candidate -> candidate.home().clubName() + " " + candidate.home().score() + " - "
						+ candidate.away().score() + " " + candidate.away().clubName())
				.orElseGet(() -> state.teams().stream()
						.filter(team -> highlightManagers.contains(team.managerId()))
						.map(team -> team.clubName() + " " + team.score() + " points")
						.findFirst().orElse("No score available"));
		return """
				broadcast_highlight_result: %s
				changes_in_the_highlight:
				%s
				""".formatted(result, lines(events));
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

	private String clubName(LiveStateResponse state, String managerId) {
		return state.matchups().stream()
				.flatMap(matchup -> java.util.stream.Stream.of(matchup.home(), matchup.away()))
				.filter(team -> team.managerId().equals(managerId))
				.map(team -> team.clubName())
				.findFirst()
				.or(() -> state.teams().stream().filter(team -> team.managerId().equals(managerId)).map(team -> team.clubName()).findFirst())
				.orElse("the club");
	}

	private static String signed(int value) {
		return value >= 0 ? "+" + value : String.valueOf(value);
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
