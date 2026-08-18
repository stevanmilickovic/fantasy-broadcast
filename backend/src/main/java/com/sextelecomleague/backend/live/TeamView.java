package com.sextelecomleague.backend.live;

import java.util.List;

public record TeamView(
		String managerId,
		String displayName,
		String clubName,
		String shortName,
		String color,
		int score,
		List<PlayerView> activePlayers,
		List<PlayerView> benchPlayers
) {
}
