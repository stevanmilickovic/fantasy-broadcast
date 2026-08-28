package com.fantasybroadcast.backend.live;

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
		int recentDelta,
		Boolean autoSubstituted
) {
	public PlayerView {
		if (autoSubstituted == null) autoSubstituted = false;
	}
	public PlayerView(String id, String displayName, String shortName, String premierLeagueClub, String position,
			String lineupSlot, int points, Integer minutes, String status, int recentDelta) {
		this(id, displayName, shortName, premierLeagueClub, position, lineupSlot, points, minutes, status, recentDelta, false);
	}
}
