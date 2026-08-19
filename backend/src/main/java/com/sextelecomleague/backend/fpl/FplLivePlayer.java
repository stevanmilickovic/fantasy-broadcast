package com.sextelecomleague.backend.fpl;

import java.util.List;

public record FplLivePlayer(
		int id,
		FplLiveStats stats,
		List<FplLiveExplanation> explain
) {

	public int totalPoints() {
		return stats.totalPoints();
	}

	public int goalsScored() {
		return stats.goalsScored();
	}

	public int assists() {
		return stats.assists();
	}

	public int cleanSheets() {
		return stats.cleanSheets();
	}

	public int yellowCards() {
		return stats.yellowCards();
	}

	public int redCards() {
		return stats.redCards();
	}

	public int bonus() {
		return stats.bonus();
	}
}
