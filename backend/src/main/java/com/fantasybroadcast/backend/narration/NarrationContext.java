package com.fantasybroadcast.backend.narration;

public record NarrationContext(
		String sourceEventId,
		String eventType,
		String narrationData,
		int maxCharacters,
		boolean voiceNarrationEnabled) {
}
