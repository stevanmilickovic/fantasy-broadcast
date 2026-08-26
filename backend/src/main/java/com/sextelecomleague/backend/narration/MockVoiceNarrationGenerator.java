package com.sextelecomleague.backend.narration;

import java.time.Instant;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

@Service
@Profile("db & !test")
public class MockVoiceNarrationGenerator implements VoiceNarrationGenerator {

	private final NarrationProperties properties;

	public MockVoiceNarrationGenerator(NarrationProperties properties) {
		this.properties = properties;
	}

	@Override
	public GeneratedVoice generate(String sourceEventId, String text) {
		var audioPath = properties.getStorage().getTempDirectory() + "/" + sourceEventId + ".mock.mp3";
		return new GeneratedVoice(audioPath, text.length(), Instant.now().plus(properties.getStorage().getAudioTtl()));
	}
}
