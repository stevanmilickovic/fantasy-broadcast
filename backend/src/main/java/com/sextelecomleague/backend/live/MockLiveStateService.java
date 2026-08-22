package com.sextelecomleague.backend.live;

import com.sextelecomleague.backend.fpl.FplDraftClient;
import com.sextelecomleague.backend.fpl.FplClassicLeague;
import com.sextelecomleague.backend.fpl.FplClassicLeagueEntry;
import com.sextelecomleague.backend.fpl.FplClassicMatch;
import com.sextelecomleague.backend.fpl.FplDraftLeague;
import com.sextelecomleague.backend.fpl.FplDraftLeagueEntry;
import com.sextelecomleague.backend.fpl.FplDraftMapper;
import com.sextelecomleague.backend.fpl.FplDraftMatch;
import com.sextelecomleague.backend.fpl.FplEntryEvent;
import com.sextelecomleague.backend.fpl.FplEntryPick;
import com.sextelecomleague.backend.fpl.FplLivePlayer;
import com.sextelecomleague.backend.fpl.FplLeagueType;
import com.sextelecomleague.backend.fpl.FplPlayer;
import jakarta.annotation.PreDestroy;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tools.jackson.databind.ObjectMapper;

@Service
public class MockLiveStateService {
	private static final Logger log = LoggerFactory.getLogger(MockLiveStateService.class);

	private static final long STREAM_TIMEOUT = Long.MAX_VALUE;
	private static final long STEP_INTERVAL_SECONDS = 10L;
	private static final String[] TEAM_COLORS = { "#2684ff", "#f04770", "#ffb000", "#24c47e", "#9b59ff", "#ff7a45" };

	private final List<LiveStateResponse> snapshots;
	private final List<LiveStateResponse> comprehensiveSnapshots;
	private List<LiveStateResponse> activeSnapshots;
	private final FplDraftClient fplClient;
	private final FplDraftMapper fplMapper;
	private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();
	private final ScheduledExecutorService sequenceExecutor = Executors.newSingleThreadScheduledExecutor();
	private int currentIndex;
	private boolean started;
	private ScheduledFuture<?> sequenceTask;
	private LiveStateResponse realState;
	private Map<String, Integer> previousRealPlayerPoints = Map.of();
	private Map<Integer, FplLivePlayer> previousRealLivePlayers = Map.of();
	private Map<Integer, FplLivePlayer> fetchedRealLivePlayers = Map.of();
	private final List<FantasyEventView> realEventHistory = new ArrayList<>();
	private int realPollCount;
	private final Map<Long, RealSession> leagueSessions = new ConcurrentHashMap<>();
	private final Map<Long, List<SseEmitter>> leagueEmitters = new ConcurrentHashMap<>();

	public MockLiveStateService(ObjectMapper objectMapper, FplDraftClient fplClient, FplDraftMapper fplMapper) {
		this.fplClient = fplClient;
		this.fplMapper = fplMapper;
		try {
			var resource = new ClassPathResource("mock/live-sequence.json");
			this.snapshots = objectMapper.readValue(resource.getInputStream(), MockLiveSequence.class).snapshots();
			this.comprehensiveSnapshots = ComprehensiveMockLiveSequence.snapshots();
			this.activeSnapshots = snapshots;
		}
		catch (IOException exception) {
			throw new UncheckedIOException("Failed to load mock live sequence", exception);
		}
	}

	public synchronized LiveStateResponse currentState() {
		if (realState != null) {
			return realState;
		}
		return withRuntimeSequence(activeSnapshots.get(currentIndex));
	}

	public synchronized LiveStateResponse currentState(long leagueKey) {
		var session = leagueSessions.get(leagueKey);
		if (session == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "This league broadcast is not running. Open it again while its schedule is active.");
		return session.state;
	}

	/** Starts a league only once; later viewers join its existing poller. */
	public synchronized LiveStateResponse startRealForLeague(long leagueKey, long fplLeagueId, FplLeagueType leagueType) {
		var existing = leagueSessions.get(leagueKey);
		if (existing != null) {
			log.info("Joining existing broadcast session: leagueKey={}, fplLeagueId={}, mode={}", leagueKey, fplLeagueId, leagueType);
			return existing.state;
		}
		log.info("Starting broadcast session: leagueKey={}, fplLeagueId={}, mode={}", leagueKey, fplLeagueId, leagueType);
		var session = new RealSession();
		session.state = fetchSessionState(session, fplLeagueId, leagueType);
		log.info("Initial FPL state loaded: leagueKey={}, gameweek={}, matchups={}", leagueKey, session.state.gameweek(), session.state.matchups().size());
		leagueSessions.put(leagueKey, session);
		broadcast(leagueKey, session.state);
		session.task = sequenceExecutor.scheduleAtFixedRate(() -> pollLeagueSession(leagueKey, fplLeagueId, leagueType), STEP_INTERVAL_SECONDS, STEP_INTERVAL_SECONDS, TimeUnit.SECONDS);
		return session.state;
	}

	public SseEmitter connectStream(long leagueKey) {
		var emitter = new SseEmitter(STREAM_TIMEOUT);
		var listeners = leagueEmitters.computeIfAbsent(leagueKey, unused -> new CopyOnWriteArrayList<>());
		listeners.add(emitter);
		emitter.onCompletion(() -> listeners.remove(emitter));
		emitter.onTimeout(() -> listeners.remove(emitter));
		emitter.onError(error -> listeners.remove(emitter));
		send(emitter, currentState(leagueKey));
		return emitter;
	}

	public synchronized void stopLeagueSessions() {
		if (!leagueSessions.isEmpty()) log.info("Stopping {} league broadcast session(s): no broadcast schedule is active.", leagueSessions.size());
		leagueSessions.values().forEach(session -> { if (session.task != null) session.task.cancel(false); });
		leagueSessions.clear();
	}

	private void pollLeagueSession(long leagueKey, long fplLeagueId, FplLeagueType leagueType) {
		synchronized (this) {
			var session = leagueSessions.get(leagueKey);
			if (session == null) return;
			try {
				session.state = fetchSessionState(session, fplLeagueId, leagueType);
				log.info("FPL poll succeeded: leagueKey={}, poll={}, gameweek={}, matchups={}, events={}", leagueKey, session.pollCount, session.state.gameweek(), session.state.matchups().size(), session.state.events().size());
				broadcast(leagueKey, session.state);
			}
			catch (RuntimeException exception) {
				log.error("FPL poll failed: leagueKey={}, fplLeagueId={}, mode={}", leagueKey, fplLeagueId, leagueType, exception);
				session.state = new LiveStateResponse(new LiveStatus("REAL", Instant.now().toString(), "FPL poll failed; retrying in 10 seconds."), session.state.sequence(), session.state.gameweek(), session.state.matchups(), session.state.events(), session.state.commentary()); broadcast(leagueKey, session.state);
			}
		}
	}

	private LiveStateResponse fetchSessionState(RealSession session, long leagueId, FplLeagueType leagueType) {
		realPollCount = session.pollCount++;
		fetchedRealLivePlayers = Map.of();
		var state = fetchRealState(leagueId, leagueType, session.previousPoints, session.previousLivePlayers);
		session.previousPoints = playerPoints(state);
		session.previousLivePlayers = fetchedRealLivePlayers;
		session.eventHistory.addAll(state.events());
		return withEventHistory(state, session.eventHistory);
	}

	private void broadcast(long leagueKey, LiveStateResponse state) {
		for (var emitter : leagueEmitters.getOrDefault(leagueKey, List.of())) send(emitter, state);
	}

	private static class RealSession { LiveStateResponse state; Map<String, Integer> previousPoints = Map.of(); Map<Integer, FplLivePlayer> previousLivePlayers = Map.of(); List<FantasyEventView> eventHistory = new ArrayList<>(); int pollCount; ScheduledFuture<?> task; }

	public SseEmitter connectStream() {
		var emitter = new SseEmitter(STREAM_TIMEOUT);
		emitters.add(emitter);
		emitter.onCompletion(() -> emitters.remove(emitter));
		emitter.onTimeout(() -> emitters.remove(emitter));
		emitter.onError((error) -> emitters.remove(emitter));
		send(emitter, currentState());
		return emitter;
	}

	public synchronized LiveStateResponse start() {
		return startSequence(snapshots);
	}

	/** Starts the intentionally busy six-club sequence used to exercise event prioritisation and stacked notifications. */
	public synchronized LiveStateResponse startComprehensive() {
		return startSequence(comprehensiveSnapshots);
	}

	private LiveStateResponse startSequence(List<LiveStateResponse> sequence) {
		realState = null;
		previousRealPlayerPoints = Map.of();
		activeSnapshots = sequence;
		started = true;
		currentIndex = 0;
		cancelSequenceTask();
		var state = currentState();
		broadcast(state);
		sequenceTask = sequenceExecutor.scheduleAtFixedRate(this::advanceFromSchedule, STEP_INTERVAL_SECONDS,
				STEP_INTERVAL_SECONDS, TimeUnit.SECONDS);
		return state;
	}

	public synchronized LiveStateResponse advance() {
		started = true;
		if (currentIndex < activeSnapshots.size() - 1) {
			currentIndex++;
		}
		if (currentIndex == activeSnapshots.size() - 1) {
			cancelSequenceTask();
		}
		var state = currentState();
		broadcast(state);
		return state;
	}

	public synchronized LiveStateResponse reset() {
		realState = null;
		realEventHistory.clear();
		previousRealPlayerPoints = Map.of();
		activeSnapshots = snapshots;
		started = false;
		currentIndex = 0;
		cancelSequenceTask();
		var state = currentState();
		broadcast(state);
		return state;
	}

	/** Starts a real FPL broadcast. The first response is a baseline; later polls emit point changes. */
	public synchronized LiveStateResponse startReal(long leagueId, FplLeagueType leagueType) {
		cancelSequenceTask();
		started = true;
		realPollCount = 0;
		previousRealPlayerPoints = Map.of();
		previousRealLivePlayers = Map.of();
		realEventHistory.clear();
		realState = withEventHistory(fetchRealState(leagueId, leagueType, Map.of(), Map.of()), realEventHistory);
		previousRealPlayerPoints = playerPoints(realState);
		previousRealLivePlayers = fetchedRealLivePlayers;
		broadcast(realState);
		sequenceTask = sequenceExecutor.scheduleAtFixedRate(() -> pollReal(leagueId, leagueType), STEP_INTERVAL_SECONDS,
				STEP_INTERVAL_SECONDS, TimeUnit.SECONDS);
		return realState;
	}

	private void advanceFromSchedule() {
		advance();
	}

	private void pollReal(long leagueId, FplLeagueType leagueType) {
		synchronized (this) {
			if (realState == null) {
				return;
			}
			try {
				realPollCount++;
				var polledState = fetchRealState(leagueId, leagueType, previousRealPlayerPoints, previousRealLivePlayers);
				realEventHistory.addAll(polledState.events());
				realState = withEventHistory(polledState, realEventHistory);
				previousRealPlayerPoints = playerPoints(realState);
				previousRealLivePlayers = fetchedRealLivePlayers;
				broadcast(realState);
			}
			catch (RuntimeException exception) {
				realState = new LiveStateResponse(
						new LiveStatus("REAL", Instant.now().toString(), "FPL poll failed; retrying in 10 seconds."),
						realState.sequence(), realState.gameweek(), realState.matchups(), realState.events(), realState.commentary());
				broadcast(realState);
			}
		}
	}

	private LiveStateResponse fetchRealState(long leagueId, FplLeagueType leagueType, Map<String, Integer> priorPoints,
			Map<Integer, FplLivePlayer> priorLivePlayers) {
		return leagueType == FplLeagueType.CLASSIC
				? fetchClassicState(leagueId, priorPoints, priorLivePlayers)
				: fetchDraftState(leagueId, priorPoints, priorLivePlayers);
	}

	private LiveStateResponse fetchDraftState(long leagueId, Map<String, Integer> priorPoints, Map<Integer, FplLivePlayer> priorLivePlayers) {
		FplDraftLeague league = fplMapper.mapLeagueDetails(fplClient.getLeagueDetails(leagueId));
		var bootstrap = fplClient.getDraftBootstrapStatic();
		var gameweek = currentGameweek(fplClient.getFantasyBootstrapStatic(), league);
		var playersById = indexPlayers(fplMapper.mapPlayers(bootstrap));
		var liveById = indexLivePlayers(fplMapper.mapDraftEventLive(fplClient.getDraftEventLive(gameweek)).players());
		fetchedRealLivePlayers = liveById;
		var entriesByLeagueEntryId = new HashMap<Integer, FplDraftLeagueEntry>();
		for (var entry : league.entries()) entriesByLeagueEntryId.put(entry.leagueEntryId(), entry);
		var matches = league.matches().stream().filter(match -> match.event() == gameweek).toList();
		var matchups = new ArrayList<MatchupView>();
		for (var match : matches) {
			var homeEntry = entriesByLeagueEntryId.get(match.firstLeagueEntryId());
			var awayEntry = entriesByLeagueEntryId.get(match.secondLeagueEntryId());
			if (homeEntry == null || awayEntry == null) continue;
			var home = buildDraftTeam(homeEntry, gameweek, playersById, liveById);
			var away = buildDraftTeam(awayEntry, gameweek, playersById, liveById);
			var leader = home.score() == away.score() ? "" : home.score() > away.score() ? home.managerId() : away.managerId();
			var matchupId = "real-gw" + gameweek + "-" + match.firstLeagueEntryId() + "-" + match.secondLeagueEntryId();
			matchups.add(new MatchupView(matchupId, home, away, leader, home.score() + "-" + away.score()));
		}
		var provisional = new LiveStateResponse(new LiveStatus("REAL", Instant.now().toString(), "Polling FPL every 10 seconds."),
				new SequenceState(realPollCount, 0, true, false), gameweek, matchups, List.of(), List.of());
		var events = detectPointEvents(provisional, priorPoints, priorLivePlayers, liveById);
		return new LiveStateResponse(provisional.status(), provisional.sequence(), gameweek, matchups, events, List.of());
	}

	private LiveStateResponse fetchClassicState(long leagueId, Map<String, Integer> priorPoints,
			Map<Integer, FplLivePlayer> priorLivePlayers) {
		var fantasyBootstrap = fplClient.getFantasyBootstrapStatic();
		var gameweek = currentGameweek(fantasyBootstrap, null);
		FplClassicLeague league = fplMapper.mapClassicLeague(
				fplClient.getClassicLeagueStandings(leagueId), fplClient.getClassicLeagueMatches(leagueId, gameweek));
		var playersById = indexPlayers(fplMapper.mapPlayers(fantasyBootstrap));
		var liveById = indexLivePlayers(fplMapper.mapLivePlayers(fplClient.getFantasyEventLive(gameweek)));
		fetchedRealLivePlayers = liveById;
		var entriesById = new HashMap<Long, FplClassicLeagueEntry>();
		for (var entry : league.entries()) entriesById.put(entry.entryId(), entry);
		var matchups = new ArrayList<MatchupView>();
		for (FplClassicMatch match : league.matches()) {
			var homeEntry = entriesById.get(match.firstEntryId());
			var awayEntry = entriesById.get(match.secondEntryId());
			if (homeEntry == null || awayEntry == null) continue;
			var home = buildClassicTeam(homeEntry, gameweek, playersById, liveById);
			var away = buildClassicTeam(awayEntry, gameweek, playersById, liveById);
			var leader = home.score() == away.score() ? "" : home.score() > away.score() ? home.managerId() : away.managerId();
			matchups.add(new MatchupView("classic-gw" + gameweek + "-" + match.firstEntryId() + "-" + match.secondEntryId(),
					home, away, leader, home.score() + "-" + away.score()));
		}
		var provisional = new LiveStateResponse(new LiveStatus("REAL_CLASSIC", Instant.now().toString(),
				"Polling regular FPL every 10 seconds."), new SequenceState(realPollCount, 0, true, false), gameweek,
				matchups, List.of(), List.of());
		var events = detectPointEvents(provisional, priorPoints, priorLivePlayers, liveById);
		return new LiveStateResponse(provisional.status(), provisional.sequence(), gameweek, matchups, events, List.of());
	}

	private TeamView buildDraftTeam(FplDraftLeagueEntry entry, int gameweek, Map<Integer, FplPlayer> playersById,
			Map<Integer, FplLivePlayer> liveById) {
		FplEntryEvent entryEvent = fplMapper.mapEntryEvent(fplClient.getEntryEvent(entry.entryId(), gameweek));
		return buildTeam(entry.leagueEntryId(), entry.playerName(), entry.entryName(), entry.entryName(), entryEvent, playersById, liveById);
	}

	private TeamView buildClassicTeam(FplClassicLeagueEntry entry, int gameweek, Map<Integer, FplPlayer> playersById,
			Map<Integer, FplLivePlayer> liveById) {
		FplEntryEvent entryEvent = fplMapper.mapEntryEvent(fplClient.getFantasyEntryEvent(entry.entryId(), gameweek));
		return buildTeam(entry.entryId(), entry.playerName(), entry.entryName(), entry.entryName(), entryEvent, playersById, liveById);
	}

	private TeamView buildTeam(long teamId, String managerName, String entryName, String displayName, FplEntryEvent entryEvent,
			Map<Integer, FplPlayer> playersById, Map<Integer, FplLivePlayer> liveById) {
		var active = new ArrayList<PlayerView>();
		var bench = new ArrayList<PlayerView>();
		var liveScore = 0;
		for (FplEntryPick pick : entryEvent.picks()) {
			var player = playersById.get(pick.element());
			if (player == null) continue;
			var live = liveById.get(pick.element());
			var points = live == null ? 0 : live.totalPoints();
			var minutes = live == null ? 0 : live.stats().minutes();
			var view = new PlayerView(String.valueOf(player.id()), player.fullName(), player.webName(), player.premierLeagueClub(),
					player.position(), "" + pick.position(), points, minutes, "AVAILABLE", 0);
			if (pick.starter()) {
				active.add(view);
				liveScore += points * Math.max(1, pick.multiplier());
			}
			else {
				bench.add(view);
			}
		}
		var color = TEAM_COLORS[(int) Math.floorMod(teamId, TEAM_COLORS.length)];
		return new TeamView(String.valueOf(teamId), managerName, entryName, displayName, color,
				liveScore, active, bench);
	}

	private List<FantasyEventView> detectPointEvents(LiveStateResponse state, Map<String, Integer> priorPoints,
			Map<Integer, FplLivePlayer> priorLivePlayers, Map<Integer, FplLivePlayer> currentLivePlayers) {
		if (priorPoints.isEmpty()) return List.of();
		var events = new ArrayList<FantasyEventView>();
		for (var matchup : state.matchups()) {
			addPointEvents(events, matchup.home(), priorPoints, priorLivePlayers, currentLivePlayers);
			addPointEvents(events, matchup.away(), priorPoints, priorLivePlayers, currentLivePlayers);
		}
		events.sort(Comparator.comparingInt((FantasyEventView event) -> Math.abs(event.pointDelta())).reversed());
		return events;
	}

	private void addPointEvents(List<FantasyEventView> events, TeamView team, Map<String, Integer> priorPoints,
			Map<Integer, FplLivePlayer> priorLivePlayers, Map<Integer, FplLivePlayer> currentLivePlayers) {
		for (var player : allPlayers(team)) {
			var oldPoints = priorPoints.get(player.id());
			if (oldPoints == null || oldPoints == player.points()) continue;
			var delta = player.points() - oldPoints;
			var playerId = Integer.parseInt(player.id());
			var changes = classifyPointEvents(priorLivePlayers.get(playerId), currentLivePlayers.get(playerId), delta);
			for (var change : changes) {
				var eventType = normalizedEventType(change.identifier());
				events.add(new FantasyEventView("real-" + team.managerId() + "-" + player.id() + "-" + change.identifier() + "-" + Instant.now().toEpochMilli(),
						Instant.now().toString(), eventType, team.managerId(), player.id(), player.displayName() + " " + eventType.replace('_', ' ').toLowerCase(), change.pointDelta(), Math.abs(change.pointDelta())));
			}
		}
	}

	private List<PointChange> classifyPointEvents(FplLivePlayer previous, FplLivePlayer current, int totalDelta) {
		if (previous == null || current == null) return List.of(new PointChange("points_update", totalDelta));
		var before = explanationValues(previous);
		var after = explanationValues(current);
		var beforePoints = explanationPoints(previous);
		var afterPoints = explanationPoints(current);
		var changes = new ArrayList<PointChange>();
		var identifiers = new java.util.HashSet<String>();
		identifiers.addAll(before.keySet());
		identifiers.addAll(after.keySet());
		identifiers.addAll(beforePoints.keySet());
		identifiers.addAll(afterPoints.keySet());
		for (var identifier : identifiers) {
			var statChanged = before.getOrDefault(identifier, 0) != after.getOrDefault(identifier, 0);
			var delta = afterPoints.getOrDefault(identifier, 0) - beforePoints.getOrDefault(identifier, 0);
			if (statChanged || delta != 0) {
				if (delta != 0) changes.add(new PointChange(identifier, delta));
			}
		}
		if (changes.isEmpty()) changes.addAll(classifyStatChanges(previous, current));
		return changes.isEmpty() ? List.of(new PointChange("points_update", totalDelta)) : changes;
	}

	private LiveStateResponse withEventHistory(LiveStateResponse state, List<FantasyEventView> eventHistory) {
		eventHistory.sort(Comparator.comparing(FantasyEventView::occurredAt).reversed());
		return new LiveStateResponse(state.status(), state.sequence(), state.gameweek(), state.matchups(), List.copyOf(eventHistory), state.commentary());
	}

	private List<PointChange> classifyStatChanges(FplLivePlayer previous, FplLivePlayer current) {
		var before = previous.stats();
		var after = current.stats();
		var changes = new ArrayList<PointChange>();
		addStatChange(changes, "goals_scored", before.goalsScored(), after.goalsScored(), 4);
		addStatChange(changes, "assists", before.assists(), after.assists(), 3);
		addStatChange(changes, "clean_sheets", before.cleanSheets(), after.cleanSheets(), 4);
		addStatChange(changes, "bonus", before.bonus(), after.bonus(), 1);
		addStatChange(changes, "yellow_cards", before.yellowCards(), after.yellowCards(), -1);
		addStatChange(changes, "red_cards", before.redCards(), after.redCards(), -3);
		return changes;
	}

	private void addStatChange(List<PointChange> changes, String identifier, int before, int after, int pointsPerUnit) {
		var difference = after - before;
		if (difference != 0) changes.add(new PointChange(identifier, difference * pointsPerUnit));
	}

	private Map<String, Integer> explanationValues(FplLivePlayer player) {
		var values = new HashMap<String, Integer>();
		for (var explanation : player.explain()) {
			for (var breakdown : explanation.stats()) values.merge(breakdown.identifier(), breakdown.value(), Integer::sum);
		}
		return values;
	}

	private Map<String, Integer> explanationPoints(FplLivePlayer player) {
		var points = new HashMap<String, Integer>();
		for (var explanation : player.explain()) {
			for (var breakdown : explanation.stats()) points.merge(breakdown.identifier(), breakdown.points() + breakdown.pointsModification(), Integer::sum);
		}
		return points;
	}

	private String normalizedEventType(String identifier) {
		return switch (identifier) {
			case "goals_scored" -> "GOAL";
			case "assists" -> "ASSIST";
			case "penalties_saved" -> "PENALTY_SAVED";
			case "penalties_missed" -> "PENALTY_MISSED";
			case "yellow_cards" -> "YELLOW_CARD";
			case "red_cards" -> "RED_CARD";
			case "clean_sheets" -> "CLEAN_SHEET";
			case "goals_conceded" -> "GOALS_CONCEDED";
			case "bonus" -> "BONUS";
			default -> identifier.toUpperCase();
		};
	}

	private record PointChange(String identifier, int pointDelta) {
	}

	private Map<String, Integer> playerPoints(LiveStateResponse state) {
		var points = new HashMap<String, Integer>();
		for (var matchup : state.matchups()) {
			for (var player : allPlayers(matchup.home())) points.put(player.id(), player.points());
			for (var player : allPlayers(matchup.away())) points.put(player.id(), player.points());
		}
		return points;
	}

	private List<PlayerView> allPlayers(TeamView team) {
		var players = new ArrayList<PlayerView>(team.activePlayers());
		players.addAll(team.benchPlayers());
		return players;
	}

	private int currentGameweek(tools.jackson.databind.JsonNode bootstrap, FplDraftLeague league) {
		for (var event : bootstrap.path("events")) if (event.path("is_current").asBoolean(false)) return event.path("id").asInt();
		for (var event : bootstrap.path("events")) if (event.path("is_next").asBoolean(false)) return event.path("id").asInt();
		if (league == null) throw new IllegalStateException("No current or next FPL gameweek was found.");
		return league.matches().stream()
				.filter(match -> !match.finished())
				.filter(match -> match.firstPoints() != 0 || match.secondPoints() != 0)
				.mapToInt(FplDraftMatch::event)
				.max()
				.orElseGet(() -> league.matches().stream()
						.filter(match -> !match.finished())
						.mapToInt(FplDraftMatch::event)
						.min()
						.orElseThrow(() -> new IllegalStateException("No unfinished Draft league matchups were found.")));
	}

	private Map<Integer, FplPlayer> indexPlayers(List<FplPlayer> players) {
		var indexed = new HashMap<Integer, FplPlayer>();
		for (var player : players) indexed.put(player.id(), player);
		return indexed;
	}

	private Map<Integer, FplLivePlayer> indexLivePlayers(List<FplLivePlayer> players) {
		var indexed = new HashMap<Integer, FplLivePlayer>();
		for (var player : players) indexed.put(player.id(), player);
		return indexed;
	}

	private void cancelSequenceTask() {
		if (sequenceTask != null) {
			sequenceTask.cancel(false);
			sequenceTask = null;
		}
	}

	@PreDestroy
	public void shutdown() {
		cancelSequenceTask();
		sequenceExecutor.shutdownNow();
	}

	private void broadcast(LiveStateResponse state) {
		for (SseEmitter emitter : emitters) {
			send(emitter, state);
		}
	}

	private void send(SseEmitter emitter, LiveStateResponse state) {
		try {
			emitter.send(SseEmitter.event()
					.name("live-state")
					.data(state, MediaType.APPLICATION_JSON));
		}
		catch (IOException | RuntimeException exception) {
			emitters.remove(emitter);
			leagueEmitters.values().forEach(listeners -> listeners.remove(emitter));
			try {
				emitter.completeWithError(exception);
			}
			catch (RuntimeException ignored) {
				// The client has already disconnected; its stream must not affect live polling.
			}
		}
	}

	private LiveStateResponse withRuntimeSequence(LiveStateResponse state) {
		return new LiveStateResponse(
				state.status(),
				new SequenceState(currentIndex + 1, activeSnapshots.size(), started, currentIndex == activeSnapshots.size() - 1),
				state.gameweek(),
				state.matchups(),
				state.events(),
				state.commentary());
	}
}
