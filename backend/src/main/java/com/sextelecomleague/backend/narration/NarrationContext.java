package com.sextelecomleague.backend.narration;

public record NarrationContext(
		String sourceEventId,
		String eventType,
		String narrationData,
		int maxCharacters,
		boolean voiceNarrationEnabled) {
}
