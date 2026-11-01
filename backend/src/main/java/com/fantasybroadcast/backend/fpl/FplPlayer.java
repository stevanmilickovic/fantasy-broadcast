package com.fantasybroadcast.backend.fpl;

public record FplPlayer(
		int id,
		String webName,
		String fullName,
		String premierLeagueClub,
		int premierLeagueClubId,
		String position,
		SeasonStats season,
		Availability availability
) {
	public record SeasonStats(int totalPoints, int goalsScored, int assists, int cleanSheets) { }
	public record Availability(String status, Integer chanceOfPlayingThisRound, Integer chanceOfPlayingNextRound, String news) { }
}
