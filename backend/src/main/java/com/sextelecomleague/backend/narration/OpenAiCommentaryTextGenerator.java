package com.sextelecomleague.backend.narration;

import java.util.List;
import java.util.Map;

import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.context.annotation.Profile;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Service
@Profile("db & !test")
@ConditionalOnExpression("'${broadcast.narration.openai.api-key:}'.length() > 0")
public class OpenAiCommentaryTextGenerator implements CommentaryTextGenerator {

	private final NarrationProperties properties;
	private final ObjectMapper objectMapper;
	private final RestClient restClient;

	public OpenAiCommentaryTextGenerator(NarrationProperties properties, ObjectMapper objectMapper, RestClient.Builder restClientBuilder) {
		this.properties = properties;
		this.objectMapper = objectMapper;
		var requestFactory = new SimpleClientHttpRequestFactory();
		requestFactory.setConnectTimeout(java.time.Duration.ofSeconds(properties.getOpenai().getTimeoutSeconds()));
		requestFactory.setReadTimeout(java.time.Duration.ofSeconds(properties.getOpenai().getTimeoutSeconds()));
		this.restClient = restClientBuilder
				.baseUrl(properties.getOpenai().getBaseUrl())
				.defaultHeader("Authorization", "Bearer " + properties.getOpenai().getApiKey())
				.requestFactory(requestFactory)
				.build();
	}

	@Override
	public GeneratedCommentary generate(NarrationContext context) {
		var maxCharacters = context.maxCharacters();
		var body = Map.of(
				"model", properties.getOpenai().getModel(),
				"store", false,
				"max_output_tokens", 80,
				"input", List.of(
						Map.of("role", "developer", "content", "You are a live fantasy football commentator. Write one punchy sentence only. No hashtags, no emojis, no markdown."),
						Map.of("role", "user", "content", prompt(context))));
		try {
			var response = restClient.post()
					.uri("/responses")
					.contentType(MediaType.APPLICATION_JSON)
					.body(body)
					.retrieve()
					.body(String.class);
			var root = objectMapper.readTree(response);
			var text = normalize(extractOutputText(root), maxCharacters);
			return new GeneratedCommentary(text, root.path("usage").path("input_tokens").asInt(0),
					root.path("usage").path("output_tokens").asInt(0));
		}
		catch (RestClientException exception) {
			throw new IllegalStateException("OpenAI narration request failed", exception);
		}
		catch (RuntimeException exception) {
			throw new IllegalStateException("OpenAI narration response was invalid", exception);
		}
	}

	private String prompt(NarrationContext context) {
		return """
				Generate one broadcast line under %d characters.
				Context:
				- league_id: %d
				- gameweek: %d
				- manager_id: %s
				- player_id: %s
				- event_type: %s
				- point_delta: %+d
				- source_summary: %s
				""".formatted(context.maxCharacters(), context.leagueId(), context.gameweek(), context.managerId(),
				context.playerId(), context.eventType(), context.pointDelta(), context.eventSummary());
	}

	private String extractOutputText(JsonNode root) {
		var outputText = root.path("output_text").asString("");
		if (!outputText.isBlank()) return outputText;
		for (var item : root.path("output")) {
			for (var content : item.path("content")) {
				if ("output_text".equals(content.path("type").asString(""))) {
					var text = content.path("text").asString("");
					if (!text.isBlank()) return text;
				}
			}
		}
		throw new IllegalStateException("Missing output text");
	}

	private String normalize(String text, int maxCharacters) {
		var normalized = text == null ? "" : text.replaceAll("\\s+", " ").trim();
		if (normalized.isBlank()) throw new IllegalStateException("Empty output text");
		if (normalized.length() <= maxCharacters) return normalized;
		return normalized.substring(0, Math.max(0, maxCharacters - 1)).trim() + ".";
	}
}
