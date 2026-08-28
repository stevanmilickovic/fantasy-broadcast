package com.fantasybroadcast.backend.narration;

import java.time.Instant;

public record BroadcastNarration(
		long id,
		long leagueId,
		int gameweek,
		String sourceEventId,
		NarrationStatus status,
		String text,
		String audioPath,
		int textInputTokens,
		int textOutputTokens,
		int ttsCharacters,
		String errorMessage,
		Instant expiresAt,
		Instant createdAt,
		Instant updatedAt) {
}
