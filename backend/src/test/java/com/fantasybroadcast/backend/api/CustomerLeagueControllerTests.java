package com.fantasybroadcast.backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fantasybroadcast.backend.customer.BroadcastScheduleService;
import com.fantasybroadcast.backend.customer.CurrentUser;
import com.fantasybroadcast.backend.customer.LeagueRegistrationService;
import com.fantasybroadcast.backend.customer.LeagueRegistrationService.RegisteredLeague;
import com.fantasybroadcast.backend.customer.SessionService;
import com.fantasybroadcast.backend.customer.UserRole;
import com.fantasybroadcast.backend.fpl.FplDraftClient;
import com.fantasybroadcast.backend.fpl.FplDraftEventLive;
import com.fantasybroadcast.backend.fpl.FplDraftLeague;
import com.fantasybroadcast.backend.fpl.FplDraftLeagueEntry;
import com.fantasybroadcast.backend.fpl.FplDraftMapper;
import com.fantasybroadcast.backend.fpl.FplLeagueScoring;
import com.fantasybroadcast.backend.fpl.FplLeagueType;
import com.fantasybroadcast.backend.fpl.FplPlayer;
import com.fantasybroadcast.backend.fpl.FplLivePlayer;
import com.fantasybroadcast.backend.fpl.FplLiveStats;
import com.fantasybroadcast.backend.fpl.FplLiveExplanation;
import com.fantasybroadcast.backend.fpl.FplLivePointBreakdown;
import com.fantasybroadcast.backend.live.MockLiveStateService;
import com.fantasybroadcast.backend.security.BroadcastSecurityProperties;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.mock.web.MockHttpServletRequest;
import jakarta.servlet.http.Cookie;
import tools.jackson.databind.JsonNode;

class CustomerLeagueControllerTests {

	@Test
	void providesDraftOverviewOnlyAfterCheckingTheUsersLeagueAccess() {
		var sessions = new SessionService();
		var user = new CurrentUser(7, "viewer@example.com", "Viewer", UserRole.USER);
		var request = new MockHttpServletRequest();
		request.setCookies(new Cookie(SessionService.COOKIE_NAME, sessions.create(user)));
		var leagues = mock(LeagueRegistrationService.class);
		var client = mock(FplDraftClient.class);
		var mapper = mock(FplDraftMapper.class);
		var details = mock(JsonNode.class);
		var elementStatus = mock(JsonNode.class);
		var bootstrap = mock(JsonNode.class);
		var events = mock(JsonNode.class);
		var currentEvent = mock(JsonNode.class);
		var current = mock(JsonNode.class);
		var gameweekId = mock(JsonNode.class);
		var players = java.util.List.of(new FplPlayer(1, "Player", "Test Player", "Club", 1, "MID"));
		when(leagues.accessibleLeague(user, 41)).thenReturn(new RegisteredLeague(41, 12345, "Test League", FplLeagueType.DRAFT,
				FplLeagueScoring.H2H, true, false, false, user.id()));
		when(client.getLeagueDetails(12345)).thenReturn(details);
		when(client.getLeagueElementStatus(12345)).thenReturn(elementStatus);
		when(client.getFantasyBootstrapStatic()).thenReturn(bootstrap);
		when(bootstrap.path("events")).thenReturn(events);
		when(events.iterator()).thenReturn(java.util.List.of(currentEvent).iterator());
		when(currentEvent.path("is_current")).thenReturn(current);
		when(current.asBoolean(false)).thenReturn(true);
		when(currentEvent.path("id")).thenReturn(gameweekId);
		when(gameweekId.asInt()).thenReturn(2);
		when(client.getDraftBootstrapStatic()).thenReturn(mock(JsonNode.class));
		when(mapper.mapLeagueDetails(details)).thenReturn(new FplDraftLeague(
				java.util.List.of(new FplDraftLeagueEntry(101, 9001, "Test League", "Viewer")), java.util.List.of(), java.util.List.of()));
		when(mapper.mapEntryEvent(client.getEntryEvent(9001, 2))).thenReturn(mock(com.fantasybroadcast.backend.fpl.FplEntryEvent.class));
		when(mapper.mapDraftEventLive(client.getDraftEventLive(2))).thenReturn(new FplDraftEventLive(java.util.List.of(), java.util.List.of()));
		when(mapper.mapPlayers(org.mockito.ArgumentMatchers.any(JsonNode.class))).thenReturn(players);
		var controller = new CustomerLeagueController(sessions, leagues, mock(BroadcastScheduleService.class), mock(MockLiveStateService.class),
				client, mapper, new BroadcastSecurityProperties());

		var overview = controller.draftLeagueOverview(request, 41);

		assertThat(overview.details()).isSameAs(details);
		assertThat(overview.elementStatus()).isSameAs(elementStatus);
		assertThat(overview.players()).containsExactlyElementsOf(players);
		assertThat(overview.entryEvents()).containsKey(9001L);
		verify(leagues).accessibleLeague(user, 41);
	}

	@Test
	void rejectsAnUnauthenticatedDraftOverviewRequestBeforeCallingFpl() {
		var controller = new CustomerLeagueController(new SessionService(), mock(LeagueRegistrationService.class), mock(BroadcastScheduleService.class),
				mock(MockLiveStateService.class), mock(FplDraftClient.class), mock(FplDraftMapper.class), new BroadcastSecurityProperties());

		assertThatThrownBy(() -> controller.draftLeagueOverview(new MockHttpServletRequest(), 41))
				.isInstanceOf(ResponseStatusException.class)
				.hasMessageContaining("Sign in is required");
	}

	@Test
	void returnsPlayerBreakdownAndPreviousGameweekTotals() {
		var sessions = new SessionService();
		var user = new CurrentUser(7, "viewer@example.com", "Viewer", UserRole.USER);
		var request = new MockHttpServletRequest();
		request.setCookies(new Cookie(SessionService.COOKIE_NAME, sessions.create(user)));
		var leagues = mock(LeagueRegistrationService.class);
		var client = mock(FplDraftClient.class);
		var mapper = mock(FplDraftMapper.class);
		var json = new tools.jackson.databind.ObjectMapper();
		var bootstrap = json.readTree("{\"elements\":[{\"id\":12,\"code\":1234}]}");
		var summary = json.readTree("{\"history\":[{\"round\":1,\"total_points\":3},{\"round\":2,\"total_points\":4},{\"round\":2,\"total_points\":2},{\"round\":3,\"total_points\":5}]}");
		var liveRoot = json.readTree("{}");
		var livePlayer = new FplLivePlayer(12, new FplLiveStats(90, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6),
				java.util.List.of(new FplLiveExplanation(55, java.util.List.of(new FplLivePointBreakdown("goals_scored", 4, 1, 0)))));
		when(leagues.accessibleLeague(user, 41)).thenReturn(new RegisteredLeague(41, 12345, "Test League", FplLeagueType.CLASSIC,
				FplLeagueScoring.H2H, true, false, false, user.id()));
		when(client.getFantasyBootstrapStatic()).thenReturn(bootstrap);
		when(client.getFantasyPlayerSummary(12)).thenReturn(summary);
		when(client.getFantasyEventLive(3)).thenReturn(liveRoot);
		when(mapper.mapPlayers(bootstrap)).thenReturn(java.util.List.of(new FplPlayer(12, "Player", "Test Player", "Club", 1, "MID")));
		when(mapper.mapLivePlayers(liveRoot)).thenReturn(java.util.List.of(livePlayer));
		var controller = new CustomerLeagueController(sessions, leagues, mock(BroadcastScheduleService.class), mock(MockLiveStateService.class),
				client, mapper, new BroadcastSecurityProperties());

		var details = controller.playerDetails(request, 41, 12, 3);

		assertThat(details.photoCode()).isEqualTo(1234);
		assertThat(details.points()).isEqualTo(6);
		assertThat(details.changes()).containsExactly(new CustomerLeagueController.PlayerPointChange("goals_scored", 1, 4, 55));
		assertThat(details.history()).containsExactly(new CustomerLeagueController.PlayerGameweekPoints(1, 3),
				new CustomerLeagueController.PlayerGameweekPoints(2, 6));
	}
}
