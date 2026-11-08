package com.fantasybroadcast.backend.api;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.fantasybroadcast.backend.customer.*;
import com.fantasybroadcast.backend.fpl.*;
import com.fantasybroadcast.backend.live.LeagueLiveProjection;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

class LeagueLiveControllerTests {
	@Test void membershipIsRequiredBeforeReadingLiveDataWithoutAnyBroadcastEntitlement() {
		var sessions = new SessionService(); var leagues=mock(LeagueRegistrationService.class); var projection=mock(LeagueLiveProjection.class);
		var controller = new LeagueLiveController(sessions,leagues,projection,new com.fantasybroadcast.backend.live.LeagueLiveUpdates());
		var request = new MockHttpServletRequest();
		assertThatThrownBy(() -> controller.live(request,4)).isInstanceOf(ResponseStatusException.class); verifyNoInteractions(leagues,projection);
		var user = new CurrentUser(1,"a@example.test","Name",UserRole.USER);
		request.setCookies(new Cookie(SessionService.COOKIE_NAME,sessions.create(user)));
		when(leagues.accessibleLeague(user,4)).thenThrow(new ResponseStatusException(HttpStatus.FORBIDDEN));
		assertThatThrownBy(() -> controller.live(request,4)).isInstanceOf(ResponseStatusException.class); verifyNoInteractions(projection);
		doReturn(new LeagueRegistrationService.RegisteredLeague(4,10,"League",FplLeagueType.DRAFT,FplLeagueScoring.H2H,true,false,false,2,true)).when(leagues).accessibleLeague(user,4);
		controller.live(request,4); verify(projection).load(10,FplLeagueType.DRAFT,FplLeagueScoring.H2H);
	}
	@Test void runningBroadcastIsReusedWithoutLoadingAnotherProjection() {
		var sessions = new SessionService(); var leagues = mock(LeagueRegistrationService.class);
		var projection = mock(LeagueLiveProjection.class); var updates = mock(com.fantasybroadcast.backend.live.LeagueLiveUpdates.class);
		var user = new CurrentUser(1,"a@example.test","Name",UserRole.USER);
		var request = new MockHttpServletRequest(); request.setCookies(new Cookie(SessionService.COOKIE_NAME,sessions.create(user)));
		when(leagues.accessibleLeague(user,4)).thenReturn(new LeagueRegistrationService.RegisteredLeague(4,10,"League",FplLeagueType.DRAFT,FplLeagueScoring.H2H,true,false,false,2,true));
		var active = mock(LeagueLiveProjection.Projection.class); when(updates.current(4)).thenReturn(active);
		assertThat(new LeagueLiveController(sessions,leagues,projection,updates).live(request,4)).isSameAs(active);
		verifyNoInteractions(projection);
	}
}
