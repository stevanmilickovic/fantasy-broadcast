package com.fantasybroadcast.backend.customer;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class PasswordAttemptLimiter {

	private static final Duration WINDOW = Duration.ofMinutes(10);
	private final Map<String, Attempts> attempts = new HashMap<>();
	private final Clock clock;
	public PasswordAttemptLimiter() { this(Clock.systemUTC()); }
	PasswordAttemptLimiter(Clock clock) { this.clock = clock; }

	public synchronized boolean allow(String key, int limit) {
		var now = clock.instant();
		attempts.values().removeIf(value -> !value.expiresAt().isAfter(now));
		var previous = attempts.get(key);
		if (previous == null && attempts.size() >= 10_000) return false;
		if (previous != null && previous.count() >= limit) return false;
		attempts.put(key, new Attempts(previous == null ? 1 : previous.count() + 1,
				previous == null ? now.plus(WINDOW) : previous.expiresAt()));
		return true;
	}

	private record Attempts(int count, Instant expiresAt) { }
}
