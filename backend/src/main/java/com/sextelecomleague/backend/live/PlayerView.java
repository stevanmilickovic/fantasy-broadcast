package com.sextelecomleague.backend.live;

public record PlayerView(
		String id,
		String displayName,
		String shortName,
		String premierLeagueClub,
		String position,
		String lineupSlot,
		int points,
		Integer minutes,
		String status,
		int recentDelta
) {
}
