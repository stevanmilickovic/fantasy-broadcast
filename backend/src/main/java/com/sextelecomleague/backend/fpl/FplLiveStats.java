package com.sextelecomleague.backend.fpl;

public record FplLiveStats(
		int minutes,
		int goalsScored,
		int assists,
		int cleanSheets,
		int goalsConceded,
		int ownGoals,
		int penaltiesSaved,
		int penaltiesMissed,
		int yellowCards,
		int redCards,
		int saves,
		int bonus,
		int bps,
		int totalPoints
) {
}
