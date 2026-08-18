package com.sextelecomleague.backend.live;

public record CommentaryView(
		String id,
		String createdAt,
		String text,
		int priority,
		String status
) {
}
