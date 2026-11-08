package com.fantasybroadcast.backend.live;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

import com.fantasybroadcast.backend.fpl.FplDraftClient;
import com.fantasybroadcast.backend.fpl.FplDraftMapper;
import com.fantasybroadcast.backend.fpl.FplLeagueScoring;
import com.fantasybroadcast.backend.fpl.FplLeagueType;
import com.fantasybroadcast.backend.narration.BroadcastNarrationRepository;
import com.fantasybroadcast.backend.narration.NarrationJobService;
import com.fantasybroadcast.backend.narration.NarrationProperties;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.test.util.ReflectionTestUtils;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

class SharedBroadcastPollingTests {

	private final ObjectMapper json = new ObjectMapper();
	private final FplDraftClient client = mock(FplDraftClient.class);
	private MockLiveStateService service;
    private final LeagueLiveUpdates updates = new LeagueLiveUpdates();
	private ObjectNode bootstrap;

	@BeforeEach
	void setUp() throws Exception {
		bootstrap = (ObjectNode) read("bootstrap-static.sample.json");
		bootstrap.putArray("events").addObject().put("id", 1).put("is_current", true);
		when(client.getCurrentFantasyBootstrapStatic()).thenReturn(bootstrap);
		when(client.getCurrentDraftBootstrapStatic()).thenReturn(bootstrap);
		when(client.getLeagueDetails(anyLong())).thenReturn(read("draft-league-details.sample.json"));
		when(client.getEntryEvent(anyLong(), anyInt())).thenReturn(read("entry-event.sample.json"));
		when(client.getFantasyEntryEvent(anyLong(), anyInt())).thenReturn(read("entry-event.sample.json"));
		var draftPoints = (ObjectNode) read("draft-event-live.sample.json");
		((ObjectNode)draftPoints.path("elements")).putObject("3").putObject("stats").put("minutes",0).put("total_points",0);
		var classicPoints = (ObjectNode) read("event-live.sample.json");
		((tools.jackson.databind.node.ArrayNode)classicPoints.path("elements")).addObject().put("id",3).putObject("stats").put("minutes",0).put("total_points",0);
		when(client.getCurrentPoints(eq(FplLeagueType.DRAFT), anyInt())).thenReturn(new FplDraftClient.SourceJson(draftPoints, Instant.now()));
		when(client.getCurrentPoints(eq(FplLeagueType.CLASSIC), anyInt())).thenReturn(new FplDraftClient.SourceJson(classicPoints, Instant.now()));
		when(client.getCurrentFixtures()).thenReturn(new FplDraftClient.SourceJson(json.readTree("[]"), Instant.now()));
		when(client.getClassicPointsLeagueStandings(anyLong())).thenReturn(read("classic-h2h-standings.sample.json"));
		var beans = new StaticListableBeanFactory();
		service = new MockLiveStateService(json, client, new FplDraftMapper(),
				beans.getBeanProvider(NarrationJobService.class), beans.getBeanProvider(BroadcastNarrationRepository.class),
				beans.getBeanProvider(NarrationProperties.class), beans.getBeanProvider(BroadcastNotificationRepository.class), updates);
	}

	@AfterEach
	void stop() {
		if (service != null) service.shutdown();
	}

	@Test
	void allLeaguesShareOnePollerAndOnePlayerSnapshotPerTypeInEachCycle() {
		start(1, FplLeagueType.DRAFT);
		var poller = ReflectionTestUtils.getField(service, "leaguePollTask");
		start(2, FplLeagueType.DRAFT);
		start(3, FplLeagueType.CLASSIC);
		start(4, FplLeagueType.CLASSIC);
		assertThat(ReflectionTestUtils.getField(service, "leaguePollTask")).isSameAs(poller);
		verify(client, times(1)).getCurrentPoints(FplLeagueType.DRAFT, 1);
		verify(client, times(1)).getCurrentPoints(FplLeagueType.CLASSIC, 1);
		clearInvocations(client);

		ReflectionTestUtils.invokeMethod(service, "pollLeagueSessions");

		verify(client, times(1)).getCurrentPoints(FplLeagueType.DRAFT, 1);
		verify(client, times(1)).getCurrentPoints(FplLeagueType.CLASSIC, 1);
		verify(client, never()).getLeagueDetails(anyLong());
		verify(client, never()).getEntryEvent(anyLong(), anyInt());
		verify(client, never()).getFantasyEntryEvent(anyLong(), anyInt());
		for (long key = 1; key <= 4; key++) assertThat(service.currentState(key).sequence().currentStep()).isEqualTo(1);
	}

	@Test
	void joiningViewersAndStoppingBroadcastsDoNotCreateAdditionalRequests() {
		start(1, FplLeagueType.DRAFT);
		assertThat(updates.current(1).gameweek()).isEqualTo(service.currentState(1).gameweek());
		assertThat(updates.current(1).scoresUnavailableReason()).contains("complete current-gameweek lineups");
		assertThat(updates.current(1).managerScores()).isEmpty();
		clearInvocations(client);
		start(1, FplLeagueType.DRAFT);
		verifyNoInteractions(client);
		service.stopLeagueSessions();
		assertThat(updates.current(1)).isNull();
		ReflectionTestUtils.invokeMethod(service, "pollLeagueSessions");
		verifyNoInteractions(client);
		assertThat(ReflectionTestUtils.getField(service, "leaguePollTask")).isNull();
	}

	@Test
	void cachedAvailabilityReachesBothLeagueTypesAndSurvivesAutomaticSubstitution() {
		((ObjectNode) bootstrap.path("elements").get(0)).put("status", "d").put("chance_of_playing_next_round", 75).put("news", "Knock");
		start(1, FplLeagueType.DRAFT);
		start(2, FplLeagueType.CLASSIC);
		for (long key = 1; key <= 2; key++) {
			var player = service.currentState(key).teams().stream().flatMap(team -> java.util.stream.Stream.concat(team.activePlayers().stream(), team.benchPlayers().stream()))
					.filter(candidate -> candidate.id().equals("328")).findFirst().orElseThrow();
			assertThat(player.availability()).isEqualTo(new com.fantasybroadcast.backend.fpl.FplPlayer.Availability("d", null, 75, "Knock"));
			PlayerView substituted = ReflectionTestUtils.invokeMethod(service, "markAutoSubstituted", player);
			assertThat(substituted.availability()).isEqualTo(player.availability());
		}
	}

	@Test
	void expiringOneSubscriptionKeepsTheSharedPollerUntilTheLastLeagueEnds() {
		start(1, FplLeagueType.DRAFT);
		start(2, FplLeagueType.DRAFT);
		var poller = ReflectionTestUtils.getField(service, "leaguePollTask");
		service.updateLeagueEntitlement(1, false, false);
		assertThat(ReflectionTestUtils.getField(service, "leaguePollTask")).isSameAs(poller);
		clearInvocations(client);
		ReflectionTestUtils.invokeMethod(service, "pollLeagueSessions");
		verify(client, times(1)).getCurrentPoints(FplLeagueType.DRAFT, 1);
		assertThat(service.currentState(2).sequence().currentStep()).isEqualTo(1);
		service.updateLeagueEntitlement(2, false, false);
		assertThat(ReflectionTestUtils.getField(service, "leaguePollTask")).isNull();
		clearInvocations(client);
		ReflectionTestUtils.invokeMethod(service, "pollLeagueSessions");
		verifyNoInteractions(client);
	}

	@Test
	void compositionRefreshHandlesANewGameweekWithoutInventingNegativePointChanges() {
		start(1, FplLeagueType.DRAFT);
		var sessions = ReflectionTestUtils.getField(service, "leagueSessions");
		if (!(sessions instanceof Map<?, ?> map)) throw new AssertionError("Expected league sessions");
		ReflectionTestUtils.setField(map.get(1L), "snapshotLoadedAt", Instant.EPOCH);
		bootstrap.putArray("events").addObject().put("id", 2).put("is_current", true);

		ReflectionTestUtils.invokeMethod(service, "pollLeagueSessions");

		assertThat(service.currentState(1).gameweek()).isEqualTo(2);
		assertThat(service.currentState(1).events()).isEmpty();
		verify(client, times(4)).getLeagueDetails(101);
		verify(client).getEntryEvent(9001, 2);
		verify(client).getCurrentPoints(FplLeagueType.DRAFT, 2);
	}

	@Test
	void aFailedDraftFeedDoesNotStopClassicLeaguesOrFutureCycles() {
		start(1, FplLeagueType.DRAFT);
		start(2, FplLeagueType.CLASSIC);
		when(client.getCurrentPoints(FplLeagueType.DRAFT, 1)).thenThrow(new IllegalStateException("Upstream unavailable"));
		ReflectionTestUtils.invokeMethod(service, "pollLeagueSessions");
		assertThat(service.currentState(1).status().message()).contains("failed");
		assertThat(service.currentState(2).sequence().currentStep()).isEqualTo(1);
		ReflectionTestUtils.invokeMethod(service, "pollLeagueSessions");
		assertThat(service.currentState(2).sequence().currentStep()).isEqualTo(2);
	}

	private void start(long key, FplLeagueType type) {
		service.startRealForLeague(key, key + 100, type, FplLeagueScoring.TOTAL_POINTS, false, false);
	}

	private JsonNode read(String name) throws Exception {
		try (var input = new ClassPathResource("fpl/" + name).getInputStream()) { return json.readTree(input); }
	}
}
