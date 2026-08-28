package com.fantasybroadcast.backend.narration;

public interface VoiceNarrationGenerator {
	GeneratedVoice generate(String sourceEventId, String text);
}
