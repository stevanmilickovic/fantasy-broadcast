package com.fantasybroadcast.backend.narration;

import org.springframework.context.annotation.Profile;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.stereotype.Service;

@Service
@Profile("db & !test")
@ConditionalOnExpression("'${broadcast.narration.openai.api-key:}'.length() == 0")
public class MockCommentaryTextGenerator implements CommentaryTextGenerator {

	@Override
	public GeneratedCommentary generate(NarrationContext context) {
		var text = context.narrationData().replaceAll("\\s+", " ").trim();
		if (text.length() > context.maxCharacters()) {
			text = text.substring(0, Math.max(0, context.maxCharacters() - 1)).trim() + ".";
		}
		return new GeneratedCommentary(text, 0, 0);
	}
}
