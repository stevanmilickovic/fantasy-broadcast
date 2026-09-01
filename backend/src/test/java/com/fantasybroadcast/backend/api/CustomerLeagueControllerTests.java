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
import com.fantasybroadcast.backend.fpl.FplDraftMapper;
import com.fantasybroadcast.backend.fpl.FplLeagueScoring;
import com.fantasybroadcast.backend.fpl.FplLeagueType;
import com.fantasybroadcast.backend.fpl.FplPlayer;
import com.fantasybroadcast.backend.live.MockLiveStateService;
import com.fantasybroadcast.backend.security.BroadcastSecurityProperties;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;

class CustomerLeagueControllerTests {

	@Test
	void providesDraftOverviewOnlyAfterCheckingTheUsersLeagueAccess() {
		var sessions = new SessionService();
		var user = new CurrentUser(7, "viewer@example.com", "Viewer", UserRole.USER);
		var authorization = "Bearer " + sessions.create(user);
		var leagues = mock(LeagueRegistrationService.class);
		var client = mock(FplDraftClient.class);
		var mapper = mock(FplDraftMapper.class);
		var details = mock(JsonNode.class);
		var elementStatus = mock(JsonNode.class);
		var players = java.util.List.of(new FplPlayer(1, "Player", "Test Player", "Club", 1, "MID"));
		when(leagues.accessibleLeague(user, 41)).thenReturn(new RegisteredLeague(41, 12345, "Test League", FplLeagueType.DRAFT,
				FplLeagueScoring.H2H, true, false, false, user.id()));
		when(client.getLeagueDetails(12345)).thenReturn(details);
		when(client.getLeagueElementStatus(12345)).thenReturn(elementStatus);
		when(client.getDraftBootstrapStatic()).thenReturn(mock(JsonNode.class));
		when(mapper.mapPlayers(org.mockito.ArgumentMatchers.any(JsonNode.class))).thenReturn(players);
		var controller = new CustomerLeagueController(sessions, leagues, mock(BroadcastScheduleService.class), mock(MockLiveStateService.class),
				client, mapper, new BroadcastSecurityProperties());

		var overview = controller.draftLeagueOverview(authorization, 41);

		assertThat(overview.details()).isSameAs(details);
		assertThat(overview.elementStatus()).isSameAs(elementStatus);
		assertThat(overview.players()).containsExactlyElementsOf(players);
		verify(leagues).accessibleLeague(user, 41);
	}

	@Test
	void rejectsAnUnauthenticatedDraftOverviewRequestBeforeCallingFpl() {
		var controller = new CustomerLeagueController(new SessionService(), mock(LeagueRegistrationService.class), mock(BroadcastScheduleService.class),
				mock(MockLiveStateService.class), mock(FplDraftClient.class), mock(FplDraftMapper.class), new BroadcastSecurityProperties());

		assertThatThrownBy(() -> controller.draftLeagueOverview(null, 41))
				.isInstanceOf(ResponseStatusException.class)
				.hasMessageContaining("Sign in is required");
	}
}
