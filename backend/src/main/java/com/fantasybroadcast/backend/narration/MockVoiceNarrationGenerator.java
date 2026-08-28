package com.fantasybroadcast.backend.narration;

import java.time.Instant;

import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

@Service
@Profile("db & !test")
@ConditionalOnExpression("'${broadcast.narration.eleven-labs.api-key:}'.length() == 0 || '${broadcast.narration.eleven-labs.voice-id:}'.length() == 0")
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
