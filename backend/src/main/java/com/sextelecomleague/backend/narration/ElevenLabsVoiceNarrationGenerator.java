package com.sextelecomleague.backend.narration;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Map;

import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.context.annotation.Profile;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Service
@Profile("db & !test")
@ConditionalOnExpression("'${broadcast.narration.eleven-labs.api-key:}'.length() > 0 && '${broadcast.narration.eleven-labs.voice-id:}'.length() > 0")
public class ElevenLabsVoiceNarrationGenerator implements VoiceNarrationGenerator {

	private final NarrationProperties properties;
	private final RestClient restClient;

	public ElevenLabsVoiceNarrationGenerator(NarrationProperties properties, RestClient.Builder restClientBuilder) {
		this.properties = properties;
		var requestFactory = new SimpleClientHttpRequestFactory();
		requestFactory.setConnectTimeout(java.time.Duration.ofSeconds(properties.getElevenLabs().getTimeoutSeconds()));
		requestFactory.setReadTimeout(java.time.Duration.ofSeconds(properties.getElevenLabs().getTimeoutSeconds()));
		this.restClient = restClientBuilder
				.baseUrl(properties.getElevenLabs().getBaseUrl())
				.defaultHeader("xi-api-key", properties.getElevenLabs().getApiKey())
				.requestFactory(requestFactory)
				.build();
	}

	@Override
	public GeneratedVoice generate(String sourceEventId, String text) {
		var body = Map.of(
				"text", text,
				"model_id", properties.getElevenLabs().getModelId());
		try {
			var response = restClient.post()
					.uri("/text-to-speech/{voiceId}?output_format=mp3_44100_128", properties.getElevenLabs().getVoiceId())
					.contentType(MediaType.APPLICATION_JSON)
					.body(body)
					.retrieve()
					.toEntity(byte[].class);
			var audio = response.getBody();
			if (audio == null || audio.length == 0) throw new IllegalStateException("Empty ElevenLabs audio response");
			var audioPath = writeAudio(sourceEventId, audio);
			var characterCost = parseCharacterCost(response.getHeaders().getFirst("character-cost"), text.length());
			return new GeneratedVoice(audioPath.toString(), characterCost, Instant.now().plus(properties.getStorage().getAudioTtl()));
		}
		catch (RestClientException exception) {
			throw new IllegalStateException("ElevenLabs narration request failed", exception);
		}
		catch (IOException exception) {
			throw new IllegalStateException("Failed to write narration audio", exception);
		}
	}

	private Path writeAudio(String sourceEventId, byte[] audio) throws IOException {
		var directory = Path.of(properties.getStorage().getTempDirectory()).toAbsolutePath().normalize();
		Files.createDirectories(directory);
		var filename = sourceEventId.replaceAll("[^A-Za-z0-9._-]", "_") + ".mp3";
		var audioPath = directory.resolve(filename).normalize();
		if (!audioPath.startsWith(directory)) throw new IllegalArgumentException("Invalid narration audio path");
		Files.write(audioPath, audio);
		return audioPath;
	}

	private int parseCharacterCost(String value, int fallback) {
		if (value == null || value.isBlank()) return fallback;
		try {
			return Integer.parseInt(value.trim());
		}
		catch (NumberFormatException ignored) {
			return fallback;
		}
	}
}
