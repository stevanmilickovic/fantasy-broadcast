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

	public OpenAiCommentaryTextGenerator(NarrationProperties properties, ObjectMapper objectMapper) {
		this.properties = properties;
		this.objectMapper = objectMapper;
		var requestFactory = new SimpleClientHttpRequestFactory();
		requestFactory.setConnectTimeout(java.time.Duration.ofSeconds(properties.getOpenai().getTimeoutSeconds()));
		requestFactory.setReadTimeout(java.time.Duration.ofSeconds(properties.getOpenai().getTimeoutSeconds()));
		this.restClient = RestClient.builder()
				.baseUrl(properties.getOpenai().getBaseUrl())
				.defaultHeader("Authorization", "Bearer " + properties.getOpenai().getApiKey())
				.requestFactory(requestFactory)
				.build();
	}

	@Override
	public GeneratedCommentary generate(NarrationContext context) {
		var maxCharacters = context.maxCharacters();
		var startedAt = Instant.now();
		log.info("Sending OpenAI narration request: model={}, sourceEventId={}, eventType={}",
				properties.getOpenai().getModel(), context.sourceEventId(), context.eventType());
		var body = Map.of(
				"model", properties.getOpenai().getModel(),
				"store", false,
				// GPT-5 counts reasoning tokens against this limit too. Leave enough room
				// for it to reach the requested one-sentence visible response.
				"max_output_tokens", 256,
				"reasoning", Map.of("effort", "minimal"),
				"input", List.of(
						Map.of("role", "developer", "content", """
								You are an energetic live football commentator covering a fantasy football contest as though it were a real match unfolding live.

								Every notification you receive is a LIVE, IN-PROGRESS update. Never imply that the match, gameweek, contest or broadcast has ended unless the supplied data explicitly states that it has ended. Do not use phrases such as "full time", "final whistle", "has won", "victory", "game over" or other conclusive language for ordinary notifications.

								Play along with the fantasy matchup as a football broadcast. The fantasy teams are the two sides in the match, and changes in their fantasy scores represent the changing score and momentum of the contest.

								Your commentary should sound like live Premier League television or radio commentary: immediate, dramatic, emotional, punchy and natural. React to important moments as a real commentator would, while staying strictly grounded in the supplied data.

								You will receive compact data containing some or all of the following:

								* `match`: two fantasy teams with their score before and after the notification.
								* `club`: one fantasy team with its total before and after the notification.
								* `events`: explicit facts describing what happened to relevant players.
								* `changed_players`: relevant players with their fantasy point totals before and after the notification.

								Treat `events` as the authoritative description of what actually happened.

								Use concrete football events such as goals, assists, yellow cards, red cards, saves, penalties, clean sheets and clean-sheet losses as the main subject of the commentary.

								When a real football event is supplied, describe the event directly rather than talking about fantasy points. For example, say "Saka finds the net!" rather than "Saka gains six points."

								Fantasy-specific events such as bonus changes are secondary context. Mention them only when they materially affect the fantasy contest and there is no stronger football event to focus on.

								Use `changed_players` mainly to understand the size and direction of the fantasy impact. Do not normally state a player's fantasy point total or how many fantasy points they gained or lost.

								Never infer an underlying football event from a point change. Only say that a player scored, assisted, received a card, made a save, kept or lost a clean sheet, missed a penalty, or similar when that fact is explicitly present in `events`.

								If there is no concrete football event, commentate only the effect on the fantasy contest without inventing a cause.

								Use the `match` or `club` before-and-after totals to understand the consequence of the update. You may describe teams as taking the lead, drawing level, falling behind, extending a lead, closing the gap, pulling away, mounting a comeback or suffering a setback when supported by the data.

								Fantasy scores may be positive, zero or negative. Negative scores are completely valid and must be interpreted exactly as provided.

								For example:

								* `-4 -> -1` means the team improved from minus four to minus one.
								* `2 -> -3` means the team fell from two to minus three.
								* `-5` is a valid score and does not mean missing or unknown data.

								Never replace a negative score with a question mark, omit the minus sign, or treat a negative value as invalid.

								Write specifically for text-to-speech. The sentence should sound natural when spoken aloud.

								Prefer spoken words and natural phrases over symbols, compact notation or scoreboard formatting.

								Do not output score formats such as `4-5`, `4:5`, `4 -> 5` or similar. Say "four to five", "from four to five", "five apiece", "minus two", or another natural spoken form instead.

								Avoid arrows, slashes, mathematical symbols, abbreviations and other notation that may be pronounced awkwardly by a voice model.

								When practical, write small numbers as words rather than digits.

								Prefer natural football commentary over mechanically reading the score. If "Team A have taken the lead!" communicates the moment better than stating the exact score, use that instead.

								If mentioning an exact score improves the call, phrase it naturally as spoken commentary, for example:

								* "Team A lead five to four."
								* "It's level at six apiece."
								* "Team A move from minus two to one."
								* "They now trail by three."

								Do not mechanically read statistics or repeat the input structure. Use the supplied data only as factual grounding while delivering the result like a live football broadcast.

								Vary your vocabulary, sentence structure and level of excitement according to the importance of the moment. Avoid repeatedly using the same openings, phrases or sentence patterns.

								Write exactly one short, punchy commentary sentence.

								Keep it under 220 characters.

								No hashtags, emojis or markdown.
								"""),
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
			log.info("Received OpenAI narration response: sourceEventId={}, inputTokens={}, outputTokens={}, durationMs={}",
					context.sourceEventId(), commentary.inputTokens(), commentary.outputTokens(),
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
				Use only this data. Do not invent facts, names, events, or scores. Mention the score movement or player swing only when it makes the call more meaningful.
				Data:
				%s
				""".formatted(context.maxCharacters(), context.narrationData());
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
