package com.sextelecomleague.backend.live;

public record FantasyEventView(
		String id,
		String occurredAt,
		String type,
		String managerId,
		String playerId,
		String summary,
		int pointDelta,
		int priority
) {
}
