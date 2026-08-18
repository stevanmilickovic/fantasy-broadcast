package com.sextelecomleague.backend.live;

import java.util.List;

public record LiveStateResponse(
		LiveStatus status,
		SequenceState sequence,
		int gameweek,
		List<MatchupView> matchups,
		List<FantasyEventView> events,
		List<CommentaryView> commentary
) {
}
