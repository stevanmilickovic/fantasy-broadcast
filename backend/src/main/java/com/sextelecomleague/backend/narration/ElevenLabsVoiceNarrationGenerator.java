package com.sextelecomleague.backend.narration;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.Duration;
import java.util.Map;

import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.context.annotation.Profile;
import org.springframework.http.MediaType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpStatusCodeException;

@Service
@Profile("db & !test")
@ConditionalOnExpression("'${broadcast.narration.eleven-labs.api-key:}'.length() > 0 && '${broadcast.narration.eleven-labs.voice-id:}'.length() > 0")
public class ElevenLabsVoiceNarrationGenerator implements VoiceNarrationGenerator {
	private static final Logger log = LoggerFactory.getLogger(ElevenLabsVoiceNarrationGenerator.class);

	private final NarrationProperties properties;
	private final RestClient restClient;

	public ElevenLabsVoiceNarrationGenerator(NarrationProperties properties) {
		this.properties = properties;
		log.info("ElevenLabs narration configured: baseUrl={}, model={}, voiceId={}, apiKey={}",
				properties.getElevenLabs().getBaseUrl(), properties.getElevenLabs().getModelId(),
				properties.getElevenLabs().getVoiceId(), maskedKey(properties.getElevenLabs().getApiKey()));
		var requestFactory = new SimpleClientHttpRequestFactory();
		requestFactory.setConnectTimeout(java.time.Duration.ofSeconds(properties.getElevenLabs().getTimeoutSeconds()));
		requestFactory.setReadTimeout(java.time.Duration.ofSeconds(properties.getElevenLabs().getTimeoutSeconds()));
		this.restClient = RestClient.builder()
				.baseUrl(properties.getElevenLabs().getBaseUrl())
				.defaultHeader("xi-api-key", properties.getElevenLabs().getApiKey())
				.requestFactory(requestFactory)
				.build();
	}

	@Override
	public GeneratedVoice generate(String sourceEventId, String text) {
		var startedAt = Instant.now();
		log.info("Sending ElevenLabs narration request: model={}, voiceId={}, sourceEventId={}, characters={}",
				properties.getElevenLabs().getModelId(), properties.getElevenLabs().getVoiceId(), sourceEventId, text.length());
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
			log.info("Received ElevenLabs narration response: sourceEventId={}, characters={}, durationMs={}", sourceEventId,
					characterCost, Duration.between(startedAt, Instant.now()).toMillis());
			return new GeneratedVoice(audioPath.toString(), characterCost, Instant.now().plus(properties.getStorage().getAudioTtl()));
		}
		catch (HttpClientErrorException.Unauthorized exception) {
			logElevenLabsHttpError(exception);
			throw new IllegalStateException("ElevenLabs authentication failed. Check ELEVENLABS_API_KEY or broadcast.narration.eleven-labs.api-key. "
					+ elevenLabsErrorSummary(exception), exception);
		}
		catch (HttpStatusCodeException exception) {
			logElevenLabsHttpError(exception);
			throw new IllegalStateException("ElevenLabs narration request failed. " + elevenLabsErrorSummary(exception), exception);
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

	private void logElevenLabsHttpError(HttpStatusCodeException exception) {
		log.warn("ElevenLabs narration HTTP error: status={}, statusText={}, requestId={}, body={}",
				exception.getStatusCode().value(), exception.getStatusText(),
				firstHeader(exception, "request-id", "x-request-id", "xi-request-id", "elevenlabs-request-id"),
				responseBodyPreview(exception));
	}

	private String elevenLabsErrorSummary(HttpStatusCodeException exception) {
		return "status=" + exception.getStatusCode().value()
				+ ", requestId=" + firstHeader(exception, "request-id", "x-request-id", "xi-request-id", "elevenlabs-request-id")
				+ ", body=" + responseBodyPreview(exception);
	}

	private String firstHeader(HttpStatusCodeException exception, String... names) {
		for (var name : names) {
			var value = exception.getResponseHeaders() == null ? null : exception.getResponseHeaders().getFirst(name);
			if (value != null && !value.isBlank()) return value;
		}
		return "none";
	}

	private String responseBodyPreview(HttpStatusCodeException exception) {
		var body = exception.getResponseBodyAsString();
		if (body == null || body.isBlank()) return "empty";
		var compact = body.replaceAll("\\s+", " ").trim();
		return compact.length() <= 500 ? compact : compact.substring(0, 500);
	}

	private String maskedKey(String key) {
		if (key == null || key.isBlank()) return "missing";
		var trimmed = key.trim();
		var suffix = trimmed.length() <= 4 ? trimmed : trimmed.substring(trimmed.length() - 4);
		return "present(length=" + trimmed.length() + ", last4=" + suffix + ")";
	}
}
