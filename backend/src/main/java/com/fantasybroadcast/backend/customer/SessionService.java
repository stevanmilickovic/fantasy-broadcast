package com.fantasybroadcast.backend.customer;

import java.time.Duration;
import java.time.Instant;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;

@Service
public class SessionService {

	public static final String COOKIE_NAME = "fantasy_broadcast_session";
	private static final Duration SESSION_LIFETIME = Duration.ofDays(7);
	private final SecureRandom secureRandom = new SecureRandom();
	private final Map<String, Session> sessions = new ConcurrentHashMap<>();

	public String create(CurrentUser user) {
		var bytes = new byte[32];
		secureRandom.nextBytes(bytes);
		var token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
		sessions.put(token, new Session(user, Instant.now().plus(SESSION_LIFETIME)));
		return token;
	}

	public CurrentUser require(HttpServletRequest request) {
		if (request.getCookies() == null) throw unauthorized();
		for (Cookie cookie : request.getCookies()) {
			if (COOKIE_NAME.equals(cookie.getName())) return requireToken(cookie.getValue());
		}
		throw unauthorized();
	}

	private CurrentUser requireToken(String token) {
		var session = sessions.get(token);
		if (session == null || session.expiresAt().isBefore(Instant.now())) {
			sessions.remove(token);
			throw unauthorized();
		}
		return session.user();
	}

	public void remove(HttpServletRequest request) {
		if (request.getCookies() == null) return;
		for (Cookie cookie : request.getCookies()) {
			if (COOKIE_NAME.equals(cookie.getName())) sessions.remove(cookie.getValue());
		}
	}

	private ResponseStatusException unauthorized() {
		return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sign in is required.");
	}

	private record Session(CurrentUser user, Instant expiresAt) {
	}
}
