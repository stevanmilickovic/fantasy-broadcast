package com.sextelecomleague.backend.narration;

public interface VoiceNarrationGenerator {
	GeneratedVoice generate(String sourceEventId, String text);
}
