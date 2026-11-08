package com.fantasybroadcast.backend.live;

import com.fantasybroadcast.backend.fpl.FplDraftClient;
import com.fantasybroadcast.backend.fpl.FplClassicLeague;
import com.fantasybroadcast.backend.fpl.FplClassicLeagueEntry;
import com.fantasybroadcast.backend.fpl.FplClassicMatch;
import com.fantasybroadcast.backend.fpl.FplDraftLeague;
import com.fantasybroadcast.backend.fpl.FplDraftLeagueEntry;
import com.fantasybroadcast.backend.fpl.FplDraftMapper;
import com.fantasybroadcast.backend.fpl.FplDraftMatch;
import com.fantasybroadcast.backend.fpl.FplDraftStanding;
import com.fantasybroadcast.backend.fpl.FplEntryEvent;
import com.fantasybroadcast.backend.fpl.FplEntryPick;
import com.fantasybroadcast.backend.fpl.FplFixture;
import com.fantasybroadcast.backend.fpl.FplLivePlayer;
import com.fantasybroadcast.backend.fpl.FplLeagueType;
import com.fantasybroadcast.backend.fpl.FplLeagueScoring;
import com.fantasybroadcast.backend.fpl.FplPlayer;
import com.fantasybroadcast.backend.narration.BroadcastNarration;
import com.fantasybroadcast.backend.narration.BroadcastNarrationRepository;
import com.fantasybroadcast.backend.narration.NarrationJobService;
import com.fantasybroadcast.backend.narration.NarrationProperties;
import jakarta.annotation.PreDestroy;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import org.springframework.beans.factory.ObjectProvider;
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
	private static final long LEAGUE_REFRESH_SECONDS = 30L;
	// shortcut: slots are process-local; use a shared registry before running multiple backend instances.
	private static final int MAX_BROADCAST_VIEWERS = 50;

	private final List<LiveStateResponse> snapshots;
	private final List<LiveStateResponse> comprehensiveSnapshots;
	private final List<LiveStateResponse> totalPointsSnapshots;
	private List<LiveStateResponse> activeSnapshots;
	private final FplDraftClient fplClient;
	private final FplDraftMapper fplMapper;
	private final NarrationJobService narrationJobService;
	private final BroadcastNarrationRepository narrationRepository;
	private final NarrationProperties narrationProperties;
	private final BroadcastNotificationRepository notificationRepository;
	private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();
	private final ScheduledExecutorService sequenceExecutor = Executors.newSingleThreadScheduledExecutor();
	private int currentIndex;
	private boolean started;
	private ScheduledFuture<?> sequenceTask;
	private ScheduledFuture<?> leaguePollTask;
	private volatile MockNarrationMode mockNarrationMode = MockNarrationMode.NONE;
	private volatile long mockNarrationRunId;
	private volatile boolean mockNarrationPending;
	private ScheduledFuture<?> mockNarrationReleaseTask;
	private Instant nextMockAdvanceAt = Instant.EPOCH;
	private LiveStateResponse realState;
	private RealSession realSession;
	private Map<String, Integer> previousRealPlayerPoints = Map.of();
	private Map<Integer, FplLivePlayer> previousRealLivePlayers = Map.of();
	private Map<Integer, FplLivePlayer> fetchedRealLivePlayers = Map.of();
	private Map<Integer, FplFixture> fetchedFixtures = Map.of();
	private int fetchedFixtureGameweek;
	private final Map<String, LivePlayerCache> livePlayerCaches = new HashMap<>();
	private int realPollCount;
	private final Map<Long, RealSession> leagueSessions = new ConcurrentHashMap<>();
	private final Map<Long, List<SseEmitter>> leagueEmitters = new ConcurrentHashMap<>();

	public MockLiveStateService(ObjectMapper objectMapper, FplDraftClient fplClient, FplDraftMapper fplMapper,
			ObjectProvider<NarrationJobService> narrationJobService,
			ObjectProvider<BroadcastNarrationRepository> narrationRepository,
			ObjectProvider<NarrationProperties> narrationProperties,
			ObjectProvider<BroadcastNotificationRepository> notificationRepository) {
		this.fplClient = fplClient;
		this.fplMapper = fplMapper;
		this.narrationJobService = narrationJobService.getIfAvailable();
		this.narrationRepository = narrationRepository.getIfAvailable();
		this.narrationProperties = narrationProperties.getIfAvailable();
		this.notificationRepository = notificationRepository.getIfAvailable();
		try {
			var resource = new ClassPathResource("mock/live-sequence.json");
			this.snapshots = objectMapper.readValue(resource.getInputStream(), MockLiveSequence.class).snapshots();
			this.comprehensiveSnapshots = ComprehensiveMockLiveSequence.snapshots();
			this.totalPointsSnapshots = TotalPointsMockLiveSequence.snapshots();
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
		return session.publishedState == null ? withoutEvents(session.state) : session.publishedState;
	}

	/** Starts a league only once; later viewers join its existing poller. */
	public synchronized LiveStateResponse startRealForLeague(long leagueKey, long fplLeagueId, FplLeagueType leagueType,
			FplLeagueScoring scoringType, boolean aiNarrationEnabled, boolean voiceNarrationEnabled) {
		var existing = leagueSessions.get(leagueKey);
		if (existing != null) {
			log.info("Joining existing broadcast session: leagueKey={}, fplLeagueId={}, type={}, scoring={}", leagueKey, fplLeagueId, leagueType, scoringType);
			return currentState(leagueKey);
		}
		log.info("Starting broadcast session: leagueKey={}, fplLeagueId={}, type={}, scoring={}", leagueKey, fplLeagueId, leagueType, scoringType);
		var session = new RealSession();
		session.leagueId = fplLeagueId;
		session.aiNarrationEnabled = aiNarrationEnabled;
		session.voiceNarrationEnabled = voiceNarrationEnabled;
		session.state = fetchSessionState(session, fplLeagueId, leagueType, scoringType).withVoiceNarrationEnabled(voiceNarrationEnabled);
		log.info("Initial FPL state loaded: leagueKey={}, gameweek={}, matchups={}", leagueKey, session.state.gameweek(), session.state.matchups().size());
		leagueSessions.put(leagueKey, session);
		publishLeagueState(leagueKey, session, session.state);
		if (leaguePollTask == null || leaguePollTask.isDone()) {
			leaguePollTask = sequenceExecutor.scheduleWithFixedDelay(this::pollLeagueSessions,
					STEP_INTERVAL_SECONDS, STEP_INTERVAL_SECONDS, TimeUnit.SECONDS);
		}
		return session.state;
	}

	public synchronized SseEmitter connectStream(long leagueKey) {
		return connectStream(leagueKey, () -> { });
	}

	public synchronized SseEmitter connectStream(long leagueKey, Runnable accessCheck) {
		var state = currentState(leagueKey);
		var listeners = leagueEmitters.computeIfAbsent(leagueKey, unused -> new CopyOnWriteArrayList<>());
		return connectStream(listeners, state, accessCheck);
	}

	public synchronized void stopLeagueSessions() {
		if (!leagueSessions.isEmpty()) log.info("Stopping {} league broadcast session(s): no broadcast schedule is active.", leagueSessions.size());
		if (leaguePollTask != null) leaguePollTask.cancel(false);
		leaguePollTask = null;
		leagueSessions.values().forEach(this::cancelNarrationWait);
		leagueSessions.clear();
		livePlayerCaches.clear();
		leagueEmitters.values().forEach(listeners -> listeners.forEach(SseEmitter::complete));
		leagueEmitters.clear();
	}

	private synchronized void pollLeagueSessions() {
		livePlayerCaches.clear();
		for (var entry : leagueSessions.entrySet()) {
			var session = entry.getValue();
			pollLeagueSession(entry.getKey(), session.leagueId, session.snapshot.leagueType(), session.snapshot.scoringType());
		}
	}

	public synchronized void updateLeagueEntitlement(long leagueKey, boolean enabled, boolean ai) {
		var session = leagueSessions.get(leagueKey);
		if (session == null) return;
		if (!enabled) {
			cancelNarrationWait(session);
			leagueSessions.remove(leagueKey);
			var listeners = leagueEmitters.remove(leagueKey);
			if (listeners != null) listeners.forEach(SseEmitter::complete);
			if (leagueSessions.isEmpty()) stopLeagueSessions();
		} else {
			session.aiNarrationEnabled = ai;
			session.voiceNarrationEnabled = ai;
			if (!ai) cancelNarrationWait(session);
		}
	}

	private void pollLeagueSession(long leagueKey, long fplLeagueId, FplLeagueType leagueType, FplLeagueScoring scoringType) {
		synchronized (this) {
			var session = leagueSessions.get(leagueKey);
			if (session == null) return;
			if (session.narrationPending) {
				log.info("Skipping FPL poll while notification narration is pending: leagueKey={}", leagueKey);
				return;
			}
			if (Instant.now().isBefore(session.nextPollAt)) return;
			try {
				session.state = fetchSessionState(session, fplLeagueId, leagueType, scoringType);
				log.info("FPL poll succeeded: leagueKey={}, poll={}, gameweek={}, matchups={}, events={}", leagueKey, session.pollCount, session.state.gameweek(), session.state.matchups().size(), session.state.events().size());
				publishOrStageLeagueState(leagueKey, session, session.state);
			}
			catch (RuntimeException exception) {
				log.error("FPL poll failed: leagueKey={}, fplLeagueId={}, type={}, scoring={}", leagueKey, fplLeagueId, leagueType, scoringType, exception);
				session.state = new LiveStateResponse(new LiveStatus("REAL", Instant.now().toString(), "FPL poll failed; retrying in 10 seconds."), session.state.sequence(), session.state.gameweek(), session.state.matchups(), session.state.teams(), session.state.standings(), List.of(), session.state.commentary()); publishLeagueState(leagueKey, session, session.state);
			}
		}
	}

	private LiveStateResponse fetchSessionState(RealSession session, long leagueId, FplLeagueType leagueType,
			FplLeagueScoring scoringType) {
		realPollCount = session.pollCount++;
		if (session.snapshot == null || !session.snapshotLoadedAt.plusSeconds(LEAGUE_REFRESH_SECONDS).isAfter(Instant.now())) {
			var snapshot = loadLeagueSnapshot(leagueId, leagueType, scoringType);
			if (session.snapshot != null && snapshot.gameweek() != session.snapshot.gameweek()) {
				session.previousPoints = Map.of();
				session.previousLivePlayers = Map.of();
				session.automaticSubstitutions = java.util.Set.of();
			}
			session.snapshot = snapshot;
			session.snapshotLoadedAt = Instant.now();
		}
		var liveById = loadLivePlayers(session.snapshot);
		fetchedRealLivePlayers = liveById;
		var state = buildSnapshotState(session.snapshot, liveById, session.previousPoints, session.previousLivePlayers);
		var events = new ArrayList<>(state.events());
		var currentAutoSubstitutions = new java.util.HashSet<String>();
		for (var team : teams(state)) for (var substitution : team.automaticSubstitutions()) {
			var key = team.managerId() + "-" + substitution.playerInId() + "-" + substitution.playerOutId();
			currentAutoSubstitutions.add(key);
			if (session.automaticSubstitutions.contains(key)) continue;
			var incoming = allPlayers(team).stream().filter(player -> player.id().equals(substitution.playerInId())).findFirst().orElse(null);
			if (incoming == null) continue;
			events.add(new FantasyEventView("auto-sub-" + key + "-" + Instant.now().toEpochMilli(), Instant.now().toString(), "AUTO_SUB",
					team.managerId(), incoming.id(), incoming.displayName() + " automatic substitution", substitution.pointDelta(), Math.abs(substitution.pointDelta())));
		}
		session.automaticSubstitutions = currentAutoSubstitutions;
		events.sort(Comparator.comparingInt((FantasyEventView event) -> Math.abs(event.pointDelta())).reversed());
		state = new LiveStateResponse(state.status(), state.sequence(), state.gameweek(), state.matchups(), state.teams(), state.standings(), events, state.commentary());
		session.previousPoints = playerPoints(state);
		session.previousLivePlayers = fetchedRealLivePlayers;
		return state;
	}

	/** Refresh league composition around rollover; each cycle shares points across its leagues. */
	private LeagueSnapshot loadLeagueSnapshot(long leagueId, FplLeagueType leagueType, FplLeagueScoring scoringType) {
		if (leagueType == FplLeagueType.DRAFT) {
			var league = fplMapper.mapLeagueDetails(fplClient.getLeagueDetails(leagueId));
			var playersById = indexPlayers(fplMapper.mapPlayers(fplClient.getCurrentDraftBootstrapStatic()));
			var gameweek = currentGameweek(fplClient.getCurrentFantasyBootstrapStatic(), league);
			var entryEvents = new HashMap<Long, FplEntryEvent>();
			for (var entry : league.entries()) entryEvents.put((long) entry.entryId(), fplMapper.mapEntryEvent(fplClient.getEntryEvent(entry.entryId(), gameweek)));
			return new LeagueSnapshot(leagueType, scoringType, gameweek, playersById, league, List.of(), List.of(), entryEvents, new FplStandingsBaseline(fplClient).load(leagueType, scoringType, leagueId, gameweek, league.entries().stream().map(e -> new FplStandingsBaseline.Manager(String.valueOf(e.leagueEntryId()), e.entryId())).toList(), entryEvents));
		}

		var fantasyBootstrap = fplClient.getCurrentFantasyBootstrapStatic();
		var gameweek = currentGameweek(fantasyBootstrap, null);
		var playersById = indexPlayers(fplMapper.mapPlayers(fantasyBootstrap));
		var classicLeague = scoringType == FplLeagueScoring.H2H
				? fplMapper.mapClassicLeague(fplClient.getClassicLeagueStandings(leagueId), fplClient.getClassicLeagueMatches(leagueId, gameweek))
				: null;
		var entries = classicLeague == null
				? fplMapper.mapClassicLeagueEntries(fplClient.getClassicPointsLeagueStandings(leagueId))
				: classicLeague.entries();
		var entryEvents = new HashMap<Long, FplEntryEvent>();
		for (var entry : entries) entryEvents.put(entry.entryId(), fplMapper.mapEntryEvent(fplClient.getFantasyEntryEvent(entry.entryId(), gameweek)));
		return new LeagueSnapshot(leagueType, scoringType, gameweek, playersById, null, entries,
				classicLeague == null ? List.of() : classicLeague.matches(), entryEvents, new FplStandingsBaseline(fplClient).load(leagueType, scoringType, leagueId, gameweek, entries.stream().map(e -> new FplStandingsBaseline.Manager(String.valueOf(e.entryId()), e.entryId())).toList(), entryEvents));
	}

	private Map<Integer, FplLivePlayer> loadLivePlayers(LeagueSnapshot snapshot) {
		fetchedFixtureGameweek = snapshot.gameweek();
		var cacheKey = snapshot.leagueType() + "-" + snapshot.gameweek();
		var cached = livePlayerCaches.get(cacheKey);
		if (cached != null && Instant.now().minusSeconds(STEP_INTERVAL_SECONDS).isBefore(cached.loadedAt())) {
			fetchedFixtures = cached.fixtures();
			return cached.players();
		}
		Map<Integer, FplLivePlayer> players;
		if (snapshot.leagueType() == FplLeagueType.DRAFT) {
			var live = fplMapper.mapDraftEventLive(fplClient.getBroadcastDraftEventLive(snapshot.gameweek()));
			players = indexLivePlayers(live.players());
			fetchedFixtures = indexFixtures(live.fixtures());
		}
		else {
			players = indexLivePlayers(fplMapper.mapLivePlayers(fplClient.getBroadcastFantasyEventLive(snapshot.gameweek())));
			fetchedFixtures = indexFixtures(fplMapper.mapFixtures(fplClient.getFantasyFixtures()));
		}
		livePlayerCaches.put(cacheKey, new LivePlayerCache(Instant.now(), players, fetchedFixtures));
		return players;
	}

	private LiveStateResponse buildSnapshotState(LeagueSnapshot snapshot, Map<Integer, FplLivePlayer> liveById,
			Map<String, Integer> priorPoints, Map<Integer, FplLivePlayer> priorLivePlayers) {
		if (snapshot.leagueType() == FplLeagueType.DRAFT) {
			var teams = new ArrayList<TeamView>();
			for (var entry : snapshot.draftLeague().entries()) teams.add(buildCachedDraftTeam(entry, snapshot.entryEvents().get((long) entry.entryId()), snapshot.playersById(), liveById));
			var matchups = snapshot.scoringType() == FplLeagueScoring.H2H ? buildDraftMatchups(snapshot, teams) : List.<MatchupView>of();
			var projection = snapshotStandings(snapshot, teams, matchups);
		var standings = projection.rows();
			var status = new LiveStatus(snapshot.scoringType() == FplLeagueScoring.H2H ? "REAL" : "REAL_DRAFT_POINTS", Instant.now().toString(), projection.reason() == null ? "Polling live player points every 10 seconds." : "Live standings unavailable: " + projection.reason());
			var provisional = new LiveStateResponse(status, new SequenceState(realPollCount, 0, true, false), snapshot.gameweek(), matchups,
					snapshot.scoringType() == FplLeagueScoring.H2H ? List.of() : teams, standings, List.of(), List.of());
			var events = detectPointEvents(provisional, priorPoints, priorLivePlayers, liveById);
			return new LiveStateResponse(status, provisional.sequence(), snapshot.gameweek(), matchups, provisional.teams(), standings, events, List.of());
		}

		var teams = new ArrayList<TeamView>();
		for (var entry : snapshot.classicEntries()) teams.add(buildCachedClassicTeam(entry, snapshot.entryEvents().get(entry.entryId()), snapshot.playersById(), liveById));
		var matchups = snapshot.scoringType() == FplLeagueScoring.H2H ? buildClassicMatchups(snapshot, teams) : List.<MatchupView>of();
		var projection = snapshotStandings(snapshot, teams, matchups);
		var standings = projection.rows();
		var status = new LiveStatus(snapshot.scoringType() == FplLeagueScoring.H2H ? "REAL_CLASSIC" : "REAL_CLASSIC_POINTS", Instant.now().toString(), projection.reason() == null ? "Polling live player points every 10 seconds." : "Live standings unavailable: " + projection.reason());
		var provisional = new LiveStateResponse(status, new SequenceState(realPollCount, 0, true, false), snapshot.gameweek(), matchups,
				snapshot.scoringType() == FplLeagueScoring.H2H ? List.of() : teams, standings, List.of(), List.of());
		var events = detectPointEvents(provisional, priorPoints, priorLivePlayers, liveById);
		return new LiveStateResponse(status, provisional.sequence(), snapshot.gameweek(), matchups, provisional.teams(), standings, events, List.of());
	}

	private List<MatchupView> buildDraftMatchups(LeagueSnapshot snapshot, List<TeamView> teams) {
		var byId = new HashMap<String, TeamView>(); for (var team : teams) byId.put(team.managerId(), team);
		var matchups = new ArrayList<MatchupView>();
		for (var match : snapshot.draftLeague().matches()) {
			if (match.event() != snapshot.gameweek()) continue;
			var home = byId.get(String.valueOf(match.firstLeagueEntryId())); var away = byId.get(String.valueOf(match.secondLeagueEntryId()));
			if (home == null || away == null) continue;
			var leader = home.score() == away.score() ? "" : home.score() > away.score() ? home.managerId() : away.managerId();
			matchups.add(new MatchupView("real-gw" + snapshot.gameweek() + "-" + match.firstLeagueEntryId() + "-" + match.secondLeagueEntryId(), home, away, leader, home.score() + "-" + away.score()));
		}
		return matchups;
	}

	private List<MatchupView> buildClassicMatchups(LeagueSnapshot snapshot, List<TeamView> teams) {
		var byId = new HashMap<String, TeamView>(); for (var team : teams) byId.put(team.managerId(), team);
		var matchups = new ArrayList<MatchupView>();
		for (var match : snapshot.classicMatches()) {
			var home = byId.get(String.valueOf(match.firstEntryId())); var away = byId.get(String.valueOf(match.secondEntryId()));
			if (home == null || away == null) continue;
			var leader = home.score() == away.score() ? "" : home.score() > away.score() ? home.managerId() : away.managerId();
			matchups.add(new MatchupView("classic-gw" + snapshot.gameweek() + "-" + match.firstEntryId() + "-" + match.secondEntryId(), home, away, leader, home.score() + "-" + away.score()));
		}
		return matchups;
	}

	private void publishOrStageLeagueState(long leagueKey, RealSession session, LiveStateResponse state) {
		if (!session.aiNarrationEnabled || narrationJobService == null || narrationProperties == null
				|| !narrationJobService.enqueueForEvents(leagueKey, state, session.voiceNarrationEnabled)) {
			publishLeagueState(leagueKey, session, state);
			return;
		}
		var maxWaitMillis = Math.max(0, narrationProperties.getReleaseDelay().toMillis());
		session.narrationPending = true;
		session.narrationDeadline = Instant.now().plusMillis(maxWaitMillis);
		log.info("Waiting for complete narration before broadcast: leagueKey={}, gameweek={}, events={}, maxWaitMs={}, audioEnabled={}",
				leagueKey, state.gameweek(), state.events().size(), maxWaitMillis, session.voiceNarrationEnabled);
		session.narrationTask = sequenceExecutor.scheduleAtFixedRate(
				() -> releaseWhenNarrationReady(leagueKey, state), 0, 1, TimeUnit.SECONDS);
	}

	private void releaseWhenNarrationReady(long leagueKey, LiveStateResponse state) {
		synchronized (this) {
			var session = leagueSessions.get(leagueKey);
			if (session == null) return;
			var complete = narrationJobService.areNarrationsReady(leagueKey, state, session.voiceNarrationEnabled);
			var timedOut = !Instant.now().isBefore(session.narrationDeadline);
			if (!complete && !timedOut) return;
			cancelNarrationWait(session);
			if (complete) {
				log.info("Narration complete; sending notification: leagueKey={}, gameweek={}, events={}", leagueKey, state.gameweek(), state.events().size());
				publishLeagueState(leagueKey, session, state);
			}
			else {
				log.warn("Narration wait timed out; sending notification without commentary: leagueKey={}, gameweek={}, events={}", leagueKey, state.gameweek(), state.events().size());
				publishRawLeagueState(leagueKey, session, state);
			}
		}
	}

	private void publishLeagueState(long leagueKey, RealSession session, LiveStateResponse state) {
		var stateWithNarrations = withNarrations(leagueKey, state).withVoiceNarrationEnabled(session.voiceNarrationEnabled);
		recordPublishedNotifications(leagueKey, stateWithNarrations);
		session.publishedState = stateWithNarrations;
		for (var emitter : leagueEmitters.getOrDefault(leagueKey, List.of())) send(emitter, stateWithNarrations);
	}

	private void publishRawLeagueState(long leagueKey, RealSession session, LiveStateResponse state) {
		var stateWithSettings = state.withVoiceNarrationEnabled(session.voiceNarrationEnabled);
		recordPublishedNotifications(leagueKey, stateWithSettings);
		session.publishedState = stateWithSettings;
		for (var emitter : leagueEmitters.getOrDefault(leagueKey, List.of())) send(emitter, stateWithSettings);
	}

	private void recordPublishedNotifications(long leagueKey, LiveStateResponse state) {
		if (notificationRepository == null) return;
		for (var event : state.events()) notificationRepository.recordPublished(leagueKey, state.gameweek(), event);
	}

	private void cancelNarrationWait(RealSession session) {
		session.narrationPending = false;
		if (session.narrationTask != null) session.narrationTask.cancel(false);
		session.narrationTask = null;
		session.nextPollAt = Instant.now().plusSeconds(STEP_INTERVAL_SECONDS);
	}

	private static class RealSession {
		long leagueId;
		LiveStateResponse state;
		LiveStateResponse publishedState;
		LeagueSnapshot snapshot;
		Instant snapshotLoadedAt = Instant.EPOCH;
		Map<String, Integer> previousPoints = Map.of();
		Map<Integer, FplLivePlayer> previousLivePlayers = Map.of();
		java.util.Set<String> automaticSubstitutions = java.util.Set.of();
		int pollCount;
		ScheduledFuture<?> narrationTask;
		boolean narrationPending;
		Instant narrationDeadline = Instant.EPOCH;
		Instant nextPollAt = Instant.EPOCH;
		boolean aiNarrationEnabled;
		boolean voiceNarrationEnabled;
	}

	private record LeagueSnapshot(FplLeagueType leagueType, FplLeagueScoring scoringType, int gameweek,
			Map<Integer, FplPlayer> playersById, FplDraftLeague draftLeague,
			List<FplClassicLeagueEntry> classicEntries, List<FplClassicMatch> classicMatches,
			Map<Long, FplEntryEvent> entryEvents, FplStandingsBaseline.Result baselines) {
	}

	private record LivePlayerCache(Instant loadedAt, Map<Integer, FplLivePlayer> players, Map<Integer, FplFixture> fixtures) {
	}

	public synchronized SseEmitter connectStream() {
		return connectStream(emitters, currentState());
	}

	private SseEmitter connectStream(List<SseEmitter> listeners, LiveStateResponse state) {
		return connectStream(listeners, state, () -> { });
	}

	private SseEmitter connectStream(List<SseEmitter> listeners, LiveStateResponse state, Runnable accessCheck) {
		var emitter = new SseEmitter(STREAM_TIMEOUT) {
			@Override public void send(SseEventBuilder event) throws IOException {
				accessCheck.run();
				super.send(event);
			}
		};
		emitter.onCompletion(() -> listeners.remove(emitter));
		emitter.onTimeout(() -> listeners.remove(emitter));
		emitter.onError(error -> listeners.remove(emitter));
		if (listeners.size() >= MAX_BROADCAST_VIEWERS) {
			try {
				emitter.send(SseEmitter.event().name("broadcast-full").data(
						"This broadcast has reached its limit of " + MAX_BROADCAST_VIEWERS + " simultaneous viewers. Try again when a space opens."));
				emitter.complete();
			}
			catch (IOException | RuntimeException exception) {
				emitter.completeWithError(exception);
			}
			return emitter;
		}
		listeners.add(emitter);
		send(emitter, state);
		return emitter;
	}

	public synchronized LiveStateResponse start() {
		return startSequence(snapshots, MockNarrationMode.NONE);
	}

	/** Starts the intentionally busy six-club sequence used to exercise event prioritisation and stacked notifications. */
	public synchronized LiveStateResponse startComprehensive(MockNarrationMode narrationMode) {
		return startSequence(comprehensiveSnapshots, narrationMode);
	}

	public synchronized LiveStateResponse startTotalPointsMock(MockNarrationMode narrationMode) {
		return startSequence(totalPointsSnapshots, narrationMode);
	}

	private LiveStateResponse startSequence(List<LiveStateResponse> sequence, MockNarrationMode narrationMode) {
		realState = null;
		realSession = null;
		previousRealPlayerPoints = Map.of();
		mockNarrationMode = narrationMode;
		mockNarrationRunId++;
		cancelMockNarrationWait();
		nextMockAdvanceAt = Instant.EPOCH;
		activeSnapshots = sequence;
		started = true;
		currentIndex = 0;
		cancelSequenceTask();
		var state = currentState();
		state = publishMockState(state);
		sequenceTask = sequenceExecutor.scheduleAtFixedRate(this::advanceFromSchedule, STEP_INTERVAL_SECONDS,
				STEP_INTERVAL_SECONDS, TimeUnit.SECONDS);
		return state;
	}

	public synchronized LiveStateResponse advance() {
		started = true;
		if (mockNarrationPending || Instant.now().isBefore(nextMockAdvanceAt)) return currentState();
		if (currentIndex < activeSnapshots.size() - 1) {
			currentIndex++;
		}
		if (currentIndex == activeSnapshots.size() - 1) {
			cancelSequenceTask();
		}
		var state = currentState();
		state = publishMockState(state);
		return state;
	}

	public synchronized LiveStateResponse reset() {
		realState = null;
		realSession = null;
		previousRealPlayerPoints = Map.of();
		mockNarrationMode = MockNarrationMode.NONE;
		mockNarrationRunId++;
		cancelMockNarrationWait();
		nextMockAdvanceAt = Instant.EPOCH;
		activeSnapshots = snapshots;
		started = false;
		currentIndex = 0;
		cancelSequenceTask();
		var state = currentState();
		broadcast(state);
		return state;
	}

	/** Starts a real FPL broadcast. The first response is a baseline; later polls emit point changes. */
	public synchronized LiveStateResponse startReal(long leagueId, FplLeagueType leagueType, FplLeagueScoring scoringType) {
		cancelSequenceTask();
		mockNarrationMode = MockNarrationMode.NONE;
		mockNarrationRunId++;
		cancelMockNarrationWait();
		nextMockAdvanceAt = Instant.EPOCH;
		started = true;
		realPollCount = 0;
		previousRealPlayerPoints = Map.of();
		previousRealLivePlayers = Map.of();
		realSession = new RealSession();
		realState = fetchSessionState(realSession, leagueId, leagueType, scoringType);
		previousRealPlayerPoints = playerPoints(realState);
		previousRealLivePlayers = fetchedRealLivePlayers;
		broadcast(realState);
		sequenceTask = sequenceExecutor.scheduleAtFixedRate(() -> pollReal(leagueId, leagueType, scoringType), STEP_INTERVAL_SECONDS,
				STEP_INTERVAL_SECONDS, TimeUnit.SECONDS);
		return realState;
	}

	private void advanceFromSchedule() {
		advance();
	}

	private void pollReal(long leagueId, FplLeagueType leagueType, FplLeagueScoring scoringType) {
		synchronized (this) {
			if (realState == null) {
				return;
			}
			try {
				realPollCount++;
				if (realSession == null) return;
				var polledState = fetchSessionState(realSession, leagueId, leagueType, scoringType);
				realState = polledState;
				previousRealPlayerPoints = playerPoints(realState);
				previousRealLivePlayers = fetchedRealLivePlayers;
				broadcast(realState);
			}
			catch (RuntimeException exception) {
				realState = new LiveStateResponse(
						new LiveStatus("REAL", Instant.now().toString(), "FPL poll failed; retrying in 10 seconds."),
						realState.sequence(), realState.gameweek(), realState.matchups(), realState.teams(), realState.standings(), List.of(), realState.commentary());
				broadcast(realState);
			}
		}
	}

	private TeamView buildCachedDraftTeam(FplDraftLeagueEntry entry, FplEntryEvent entryEvent, Map<Integer, FplPlayer> playersById,
			Map<Integer, FplLivePlayer> liveById) {
		return buildTeam(entry.leagueEntryId(), entry.playerName(), entry.entryName(), entry.entryName(), entryEvent, playersById, liveById, false);
	}

	private TeamView buildCachedClassicTeam(FplClassicLeagueEntry entry, FplEntryEvent entryEvent, Map<Integer, FplPlayer> playersById,
			Map<Integer, FplLivePlayer> liveById) {
		return buildTeam(entry.entryId(), entry.playerName(), entry.entryName(), entry.entryName(), entryEvent, playersById, liveById, true);
	}

	private TeamView buildTeam(long teamId, String managerName, String entryName, String displayName, FplEntryEvent entryEvent,
			Map<Integer, FplPlayer> playersById, Map<Integer, FplLivePlayer> liveById, boolean classicRules) {
		return LiveScoring.team(teamId, managerName, entryName, displayName, entryEvent, playersById, liveById,
				fetchedFixtures.values(), fetchedFixtureGameweek, classicRules);
	}

	private PlayerView markAutoSubstituted(PlayerView player) { return LiveScoring.markSubstituted(player); }

	private List<FantasyEventView> detectPointEvents(LiveStateResponse state, Map<String, Integer> priorPoints,
			Map<Integer, FplLivePlayer> priorLivePlayers, Map<Integer, FplLivePlayer> currentLivePlayers) {
		if (priorPoints.isEmpty()) return List.of();
		var events = new ArrayList<FantasyEventView>();
		for (var team : teams(state)) addPointEvents(events, team, priorPoints, priorLivePlayers, currentLivePlayers);
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
				events.add(new FantasyEventView("real-" + team.managerId() + "-" + player.id() + "-" + change.identifier() + "-" + player.points(),
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

	private SnapshotStandings snapshotStandings(LeagueSnapshot snapshot, List<TeamView> teams, List<MatchupView> matchups) {
		if(snapshot.baselines().unavailableReason() == null) {
			try { return new SnapshotStandings(LiveScoring.standings(teams, snapshot.baselines().rows(), matchups, snapshot.scoringType() == FplLeagueScoring.H2H, snapshot.gameweek()),null); }
			catch(IllegalStateException incomplete) { /* Preserve the official table when a schedule is incomplete. */ }
		}
		var seeds = snapshot.leagueType() == FplLeagueType.DRAFT
				? snapshot.scoringType() == FplLeagueScoring.H2H ? draftStandingSeeds(snapshot.draftLeague(),teams) : draftTotalPointsSeeds(snapshot.draftLeague(),teams)
				: classicStandingSeeds(snapshot.classicEntries(),teams);
		var rows = new ArrayList<LiveStandingView>();
		for(var seed : seeds) {
			var id = seed.team().managerId();
			var rank = snapshot.leagueType() == FplLeagueType.DRAFT
					? snapshot.draftLeague().standings().stream().filter(row -> String.valueOf(row.leagueEntryId()).equals(id)).mapToInt(FplDraftStanding::rank).findFirst().orElse(0)
					: snapshot.classicEntries().stream().filter(row -> String.valueOf(row.entryId()).equals(id)).mapToInt(FplClassicLeagueEntry::rank).findFirst().orElse(0);
			rows.add(new LiveStandingView(id,seed.team().displayName(),seed.team().clubName(),rank,seed.total(),seed.team().score(),seed.pointsFor()));
		}
		rows.sort(Comparator.comparingInt(LiveStandingView::position));
		return new SnapshotStandings(rows, snapshot.baselines().unavailableReason() == null ? "The current matchup schedule is incomplete." : snapshot.baselines().unavailableReason());
	}

	private record SnapshotStandings(List<LiveStandingView> rows,String reason) { }

	private List<StandingSeed> draftStandingSeeds(FplDraftLeague league, List<TeamView> teams) {
		var standingsByEntryId = new HashMap<Integer, FplDraftStanding>();
		for (var standing : league.standings()) standingsByEntryId.put(standing.leagueEntryId(), standing);
		var seeds = new ArrayList<StandingSeed>();
		for (var team : teams) {
			var standing = standingsByEntryId.get(Integer.parseInt(team.managerId()));
			seeds.add(new StandingSeed(team, standing == null ? 0 : standing.headToHeadPoints(),
					standing == null ? 0 : standing.pointsFor(), team.officialGameweekPoints()));
		}
		return seeds;
	}

	private List<StandingSeed> classicStandingSeeds(List<FplClassicLeagueEntry> entries, List<TeamView> teams) {
		var entriesById = new HashMap<Long, FplClassicLeagueEntry>();
		for (var entry : entries) entriesById.put(entry.entryId(), entry);
		var seeds = new ArrayList<StandingSeed>();
		for (var team : teams) {
			var entry = entriesById.get(Long.parseLong(team.managerId()));
			seeds.add(new StandingSeed(team, entry == null ? 0 : entry.total(), entry == null ? 0 : entry.pointsFor(), entry == null ? 0 : entry.eventTotal()));
		}
		return seeds;
	}

	private List<TeamView> matchupTeams(List<MatchupView> matchups) {
		var teams = new ArrayList<TeamView>();
		for (var matchup : matchups) {
			teams.add(matchup.home());
			teams.add(matchup.away());
		}
		return teams;
	}

	private List<StandingSeed> draftTotalPointsSeeds(FplDraftLeague league, List<TeamView> teams) {
		var standingsByEntryId = new HashMap<Integer, FplDraftStanding>();
		for (var standing : league.standings()) standingsByEntryId.put(standing.leagueEntryId(), standing);
		var seeds = new ArrayList<StandingSeed>();
		for (var team : teams) {
			var standing = standingsByEntryId.get(Integer.parseInt(team.managerId()));
			var total = standing == null ? 0 : standing.pointsFor();
			seeds.add(new StandingSeed(team, total, total, team.officialGameweekPoints()));
		}
		return seeds;
	}

	private record StandingSeed(TeamView team, int total, int pointsFor, int officialGameweekPoints) {
	}


	private Map<String, Integer> playerPoints(LiveStateResponse state) {
		var points = new HashMap<String, Integer>();
		for (var team : teams(state)) for (var player : allPlayers(team)) points.put(player.id(), player.points());
		return points;
	}

	private List<TeamView> teams(LiveStateResponse state) {
		var teams = new ArrayList<TeamView>(state.teams());
		for (var matchup : state.matchups()) {
			teams.add(matchup.home());
			teams.add(matchup.away());
		}
		return teams;
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

	private Map<Integer, FplFixture> indexFixtures(List<FplFixture> fixtures) {
		var indexed = new HashMap<Integer, FplFixture>();
		for (var fixture : fixtures) indexed.put(fixture.id(), fixture);
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
		stopLeagueSessions();
		cancelMockNarrationWait();
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
				state.teams(),
				state.standings(),
				state.events(),
				state.commentary());
	}

	private LiveStateResponse publishMockState(LiveStateResponse state) {
		if (mockNarrationMode == MockNarrationMode.NONE || narrationJobService == null || state.events().isEmpty()) {
			broadcast(state);
			return state;
		}
		var narrationRunId = mockNarrationRunId;
		var narration = CompletableFuture.supplyAsync(() -> generateMockNarration(state));
		var maxWaitMillis = narrationProperties == null ? TimeUnit.MINUTES.toMillis(1)
				: Math.max(0, narrationProperties.getReleaseDelay().toMillis());
		mockNarrationPending = true;
		var deadline = Instant.now().plusMillis(maxWaitMillis);
		log.info("Waiting for mock narration before notification: gameweek={}, events={}, maxWaitMs={}",
				state.gameweek(), state.events().size(), maxWaitMillis);
		mockNarrationReleaseTask = sequenceExecutor.scheduleAtFixedRate(
				() -> releaseMockState(state, narrationRunId, narration, deadline), 0, 1, TimeUnit.SECONDS);
		return state;
	}

	private MockNarrationResult generateMockNarration(LiveStateResponse state) {
		var commentary = new ArrayList<CommentaryView>();
		var complete = true;
		try {
			if (mockNarrationMode == MockNarrationMode.VOICE) {
				narrationJobService.generateMockNarration(narrationRepository.mockLeagueId(), state, true)
						.ifPresent(narration -> commentary.add(toCommentaryView(narration)));
			}
			else {
				narrationJobService.generateMockText(state)
						.ifPresent(generated -> commentary.add(new CommentaryView(
								narrationJobService.mockSourceEventIdsForState(state).stream().findFirst().orElse("mock-notification"),
								state.events().getFirst().occurredAt(), generated.text(), 3, "TEXT_READY", null)));
			}
		}
		catch (RuntimeException exception) {
			complete = false;
			log.warn("Mock narration generation failed: gameweek={}, events={}", state.gameweek(), state.events().size(), exception);
		}
		return new MockNarrationResult(commentary, complete);
	}

	private void releaseMockState(LiveStateResponse state, long narrationRunId,
			CompletableFuture<MockNarrationResult> narration, Instant deadline) {
		if (mockNarrationMode == MockNarrationMode.NONE || narrationRunId != mockNarrationRunId) return;
		try {
			var result = narration.getNow(null);
			var timedOut = !Instant.now().isBefore(deadline);
			if (result == null && !timedOut) return;
			cancelMockNarrationWait();
			if (result != null && result.complete()) {
				var releasedState = result.commentary().isEmpty() ? state : new LiveStateResponse(state.status(), state.sequence(), state.gameweek(),
						state.matchups(), state.teams(), state.standings(), state.events(), result.commentary());
				broadcast(releasedState);
				nextMockAdvanceAt = Instant.now().plusSeconds(STEP_INTERVAL_SECONDS);
			}
			else {
				log.warn("Mock narration wait timed out; sending notification without commentary: gameweek={}, events={}", state.gameweek(), state.events().size());
				broadcast(state);
				nextMockAdvanceAt = Instant.now().plusSeconds(STEP_INTERVAL_SECONDS);
			}
		}
		catch (RuntimeException exception) {
			if (Instant.now().isBefore(deadline)) return;
			cancelMockNarrationWait();
			log.warn("Mock narration wait failed; sending notification without commentary: gameweek={}, events={}", state.gameweek(), state.events().size(), exception);
			broadcast(state);
			nextMockAdvanceAt = Instant.now().plusSeconds(STEP_INTERVAL_SECONDS);
		}
	}

	private void cancelMockNarrationWait() {
		mockNarrationPending = false;
		if (mockNarrationReleaseTask != null) mockNarrationReleaseTask.cancel(false);
		mockNarrationReleaseTask = null;
	}

	private record MockNarrationResult(List<CommentaryView> commentary, boolean complete) {
	}

	private LiveStateResponse withNarrations(long leagueKey, LiveStateResponse state) {
		if (narrationRepository == null || state.events().isEmpty()) return state;
		var eventIds = new HashSet<>(narrationJobService.sourceEventIdsForState(state));
		var commentary = narrationRepository.readyForLeagueGameweek(leagueKey, state.gameweek()).stream()
				.filter(narration -> eventIds.contains(narration.sourceEventId()))
				.map(this::toCommentaryView)
				.toList();
		if (commentary.isEmpty()) return state;
		return new LiveStateResponse(state.status(), state.sequence(), state.gameweek(), state.matchups(),
				state.teams(), state.standings(), state.events(), commentary);
	}

	private LiveStateResponse withoutEvents(LiveStateResponse state) {
		return new LiveStateResponse(state.status(), state.sequence(), state.gameweek(), state.matchups(),
				state.teams(), state.standings(), List.of(), state.commentary());
	}

	private CommentaryView toCommentaryView(BroadcastNarration narration) {
		return new CommentaryView(String.valueOf(narration.id()), narration.createdAt().toString(), narration.text(),
				3, narration.status().name(), narration.audioPath() == null ? null : "/api/broadcast-narrations/" + narration.id() + "/audio");
	}
}
