package com.sextelecomleague.backend.narration;

public record NarrationContext(
		long leagueId,
		int gameweek,
		String sourceEventId,
		String eventType,
		String managerId,
		String playerId,
		String eventSummary,
		int pointDelta,
		int maxCharacters,
		boolean voiceNarrationEnabled) {
}
