package com.fantasybroadcast.backend.fpl;

public record FplPlayer(
		int id,
		String webName,
		String fullName,
		String premierLeagueClub,
		int premierLeagueClubId,
		String position,
		SeasonStats season
) {
	public record SeasonStats(int totalPoints, int goalsScored, int assists, int cleanSheets) { }
}
