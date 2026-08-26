package com.sextelecomleague.backend.live;

public record CommentaryView(
		String id,
		String createdAt,
		String text,
		int priority,
		String status,
		String audioUrl
) {
	public CommentaryView(String id, String createdAt, String text, int priority, String status) {
		this(id, createdAt, text, priority, status, null);
	}
}
