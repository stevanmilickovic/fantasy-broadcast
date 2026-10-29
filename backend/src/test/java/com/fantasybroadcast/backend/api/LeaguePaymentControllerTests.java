package com.fantasybroadcast.backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;
import com.fantasybroadcast.backend.customer.CurrentUser;
import com.fantasybroadcast.backend.customer.LeagueRegistrationService;
import com.fantasybroadcast.backend.customer.SessionService;
import com.fantasybroadcast.backend.customer.UserRole;
import com.fantasybroadcast.backend.fpl.FplLeagueType;
import com.fantasybroadcast.backend.payment.PaddleCheckoutService;
import com.fantasybroadcast.backend.payment.PaddleProperties;
import com.fantasybroadcast.backend.security.BroadcastSecurityProperties;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

class LeaguePaymentControllerTests {
	@Test
	void disabledRegistrationDisablesCheckoutEvenWhenPaddleAndTheLeagueAreValid() {
		var sessions = new SessionService();
		var request = new MockHttpServletRequest();
		request.setCookies(new Cookie(SessionService.COOKIE_NAME, sessions.create(new CurrentUser(1, "owner@example.com", "Owner", UserRole.USER))));
		var leagues = mock(LeagueRegistrationService.class);
		when(leagues.preview(42, FplLeagueType.DRAFT)).thenReturn(new LeagueRegistrationService.LeaguePreview("Test league", 8, null));
		var paddle = mock(PaddleProperties.class);
		when(paddle.isConfigured()).thenReturn(true);
		var security = new BroadcastSecurityProperties();
		security.setLeagueRegistrationEnabled(false);
		var controller = new LeaguePaymentController(sessions, leagues, paddle, mock(PaddleCheckoutService.class), security);
		var disabled = controller.preview(request, 42, FplLeagueType.DRAFT);
		assertThat(disabled.registrationEligible()).isTrue();
		assertThat(disabled.checkoutReady()).isFalse();
		security.setLeagueRegistrationEnabled(true);
		assertThat(controller.preview(request, 42, FplLeagueType.DRAFT).checkoutReady()).isTrue();
		when(paddle.isConfigured()).thenReturn(false);
		assertThat(controller.preview(request, 42, FplLeagueType.DRAFT).checkoutReady()).isFalse();
	}
}
