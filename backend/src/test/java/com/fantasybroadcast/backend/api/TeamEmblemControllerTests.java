package com.fantasybroadcast.backend.api;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.fantasybroadcast.backend.customer.CurrentUser;
import com.fantasybroadcast.backend.customer.SessionService;
import com.fantasybroadcast.backend.customer.TeamEmblemService;
import com.fantasybroadcast.backend.customer.UserRole;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.server.ResponseStatusException;

class TeamEmblemControllerTests {
	@Test void imageResponsesArePrivateVersionedAndSupportConditionalRequests() throws Exception {
		var sessions = mock(SessionService.class);
		var emblems = mock(TeamEmblemService.class);
		var user = new CurrentUser(1, "owner@example.com", "Owner", UserRole.USER);
		when(sessions.require(any(HttpServletRequest.class))).thenReturn(user);
		when(emblems.image(user, 1, 9001, "version")).thenReturn(new byte[] { 1, 2, 3 });
		var mvc = MockMvcBuilders.standaloneSetup(new TeamEmblemController(sessions, emblems)).setControllerAdvice(new ApiExceptionHandler()).build();
		String path = "/api/customer/leagues/1/teams/9001/emblem/version.png";
		mvc.perform(get(path)).andExpect(status().isOk()).andExpect(content().contentType("image/png"))
				.andExpect(header().string("Cache-Control", "max-age=2592000, private, immutable"))
				.andExpect(header().string("ETag", "\"version\""))
				.andExpect(header().string("X-Content-Type-Options", "nosniff"));
		mvc.perform(get(path).header("If-None-Match", "\"version\"")).andExpect(status().isNotModified()).andExpect(content().bytes(new byte[0]));
		when(sessions.require(any(HttpServletRequest.class))).thenThrow(new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sign in first."));
		mvc.perform(get(path)).andExpect(status().isUnauthorized());
	}
}
