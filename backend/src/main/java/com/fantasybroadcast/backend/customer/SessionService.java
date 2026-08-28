package com.fantasybroadcast.backend.customer;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class SessionService {

	private static final Duration SESSION_LIFETIME = Duration.ofDays(7);
	private final Map<String, Session> sessions = new ConcurrentHashMap<>();

	public String create(CurrentUser user) {
		var token = UUID.randomUUID().toString();
		sessions.put(token, new Session(user, Instant.now().plus(SESSION_LIFETIME)));
		return token;
	}

	public CurrentUser require(String authorization) {
		if (authorization == null || !authorization.startsWith("Bearer ")) throw unauthorized();
		var token = authorization.substring("Bearer ".length());
		var session = sessions.get(token);
		if (session == null || session.expiresAt().isBefore(Instant.now())) {
			sessions.remove(token);
			throw unauthorized();
		}
		return session.user();
	}

	public void remove(String authorization) {
		if (authorization != null && authorization.startsWith("Bearer ")) {
			sessions.remove(authorization.substring("Bearer ".length()));
		}
	}

	private ResponseStatusException unauthorized() {
		return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sign in is required.");
	}

	private record Session(CurrentUser user, Instant expiresAt) {
	}
}
