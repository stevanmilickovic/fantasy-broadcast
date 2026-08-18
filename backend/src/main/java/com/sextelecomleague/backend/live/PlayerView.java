package com.sextelecomleague.backend.live;

public record PlayerView(
		String id,
		String displayName,
		String premierLeagueClub,
		String position,
		String lineupSlot,
		int points,
		String status,
		int recentDelta
) {
}
