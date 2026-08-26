package com.sextelecomleague.backend.narration;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.time.Duration;
import java.time.Instant;

import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.context.annotation.Profile;
import org.springframework.http.MediaType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
	private static final Logger log = LoggerFactory.getLogger(OpenAiCommentaryTextGenerator.class);

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
		var startedAt = Instant.now();
		log.info("Sending OpenAI narration request: model={}, gameweek={}, sourceEventId={}, eventType={}",
				properties.getOpenai().getModel(), context.gameweek(), context.sourceEventId(), context.eventType());
		var body = Map.of(
				"model", properties.getOpenai().getModel(),
				"store", false,
				// GPT-5 counts reasoning tokens against this limit too. Leave enough room
				// for it to reach the requested one-sentence visible response.
				"max_output_tokens", 256,
				"reasoning", Map.of("effort", "minimal"),
				"input", List.of(
						Map.of("role", "developer", "content", "You are a live fantasy football commentator. Treat every side as a club: refer only to club names, never managers or manager names. Use simple, natural broadcast language and write one punchy sentence only. Always mention the highlighted score exactly once. Emphasise goals, lead changes, and large point swings; for especially dramatic moments, you may shout with an exclamation mark. Stay measured for small point changes or events that do not change the lead. Never invent facts. No hashtags, no emojis, no markdown."),
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
			var commentary = new GeneratedCommentary(text, root.path("usage").path("input_tokens").asInt(0),
					root.path("usage").path("output_tokens").asInt(0));
			log.info("Received OpenAI narration response: gameweek={}, sourceEventId={}, inputTokens={}, outputTokens={}, durationMs={}",
					context.gameweek(), context.sourceEventId(), commentary.inputTokens(), commentary.outputTokens(),
					Duration.between(startedAt, Instant.now()).toMillis());
			return commentary;
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
				Generate one broadcast line under %d characters for the whole notification.
				The featured event identifies why this line was requested. The notification context is limited to the match the broadcast is showing; treat its single result and its listed changes as the source of truth. Do not invent facts. Mention the scoreline or combined swing when it makes the call more meaningful rather than mechanically listing data.
				Context:
				- league_id: %d
				- gameweek: %d
				- player_id: %s
				- event_type: %s
				- point_delta: %+d
				- source_summary: %s
				- notification_context:
				%s
				""".formatted(context.maxCharacters(), context.leagueId(), context.gameweek(), context.playerId(),
				context.eventType(), context.pointDelta(), context.eventSummary(), context.notificationContext());
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
		var outputTypes = new ArrayList<String>();
		for (var item : root.path("output")) {
			outputTypes.add(item.path("type").asString("unknown"));
			for (var content : item.path("content")) {
				outputTypes.add("content:" + content.path("type").asString("unknown"));
			}
		}
		var status = root.path("status").asString("unknown");
		var incompleteReason = root.path("incomplete_details").path("reason").asString("none");
		var errorCode = root.path("error").path("code").asString("none");
		var inputTokens = root.path("usage").path("input_tokens").asInt(0);
		var outputTokens = root.path("usage").path("output_tokens").asInt(0);
		log.warn("OpenAI narration response contained no text: status={}, incompleteReason={}, errorCode={}, outputTypes={}, inputTokens={}, outputTokens={}",
				status, incompleteReason, errorCode, outputTypes, inputTokens, outputTokens);
		throw new IllegalStateException("Missing output text: status=" + status + ", incompleteReason="
				+ incompleteReason + ", errorCode=" + errorCode + ", outputTypes=" + outputTypes);
	}

	private String normalize(String text, int maxCharacters) {
		var normalized = text == null ? "" : text.replaceAll("\\s+", " ").trim();
		if (normalized.isBlank()) throw new IllegalStateException("Empty output text");
		if (normalized.length() <= maxCharacters) return normalized;
		return normalized.substring(0, Math.max(0, maxCharacters - 1)).trim() + ".";
	}
}
