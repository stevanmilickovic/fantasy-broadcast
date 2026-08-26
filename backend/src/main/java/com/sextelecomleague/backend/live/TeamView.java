package com.sextelecomleague.backend.live;

import java.util.List;

public record TeamView(
		String managerId,
		String displayName,
		String clubName,
		String shortName,
	String color,
	int score,
	Integer officialGameweekPoints,
	List<PlayerView> activePlayers,
	List<PlayerView> benchPlayers,
	List<AutoSubstitutionView> automaticSubstitutions
) {
	public TeamView {
		if (officialGameweekPoints == null) officialGameweekPoints = 0;
	}

	public TeamView(String managerId, String displayName, String clubName, String shortName, String color, int score,
			Integer officialGameweekPoints, List<PlayerView> activePlayers, List<PlayerView> benchPlayers) {
		this(managerId, displayName, clubName, shortName, color, score, officialGameweekPoints, activePlayers, benchPlayers, List.of());
	}
}
