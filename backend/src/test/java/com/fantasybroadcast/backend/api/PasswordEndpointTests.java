package com.fantasybroadcast.backend.api;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.fantasybroadcast.backend.customer.*;
import com.fantasybroadcast.backend.security.BroadcastSecurityProperties;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class PasswordEndpointTests {
	@Test void passwordEndpointsRequireSessionTrustedOriginAndValidBounds() throws Exception {
		var passwords = mock(PasswordSecurityService.class);
		var sessions = new SessionService();
		var controller = new AuthController(mock(AccountService.class), sessions, new BroadcastSecurityProperties(),
				new StaticListableBeanFactory().getBeanProvider(ClientRegistrationRepository.class), passwords, "http://localhost:5173");
		var mvc = MockMvcBuilders.standaloneSetup(controller).build();
		var json = "{\"currentPassword\":\"old-password-123\",\"password\":\"new-password-123\"}";
		mvc.perform(get("/api/auth/password/capability")).andExpect(status().isUnauthorized());
		mvc.perform(post("/api/auth/password/change").contentType("application/json").content(json)).andExpect(status().isForbidden());
		mvc.perform(post("/api/auth/password/change").header("Origin", "https://evil.example").contentType("application/json").content(json)).andExpect(status().isForbidden());
		mvc.perform(post("/api/auth/password/change").header("Origin", "http://localhost:5173").contentType("application/json").content(json)).andExpect(status().isUnauthorized());
		var cookie = new jakarta.servlet.http.Cookie(SessionService.COOKIE_NAME, sessions.create(new CurrentUser(1,"a@example.test","Name",UserRole.USER)));
		mvc.perform(post("/api/auth/password/change").cookie(cookie).header("Origin", "http://localhost:5173").contentType("application/json").content(json.replace("new-password-123", "short"))).andExpect(status().isBadRequest());
		mvc.perform(post("/api/auth/password/change").cookie(cookie).header("Origin", "http://localhost:5173").contentType("application/json").content(json)).andExpect(status().isOk()).andExpect(header().string("Set-Cookie", org.hamcrest.Matchers.containsString("Max-Age=0")));
		verify(passwords, times(1)).change(any(),eq("old-password-123"),eq("new-password-123"));
	}
}
