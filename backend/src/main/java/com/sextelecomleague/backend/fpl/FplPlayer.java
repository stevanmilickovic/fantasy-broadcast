package com.sextelecomleague.backend.fpl;

public record FplPlayer(
		int id,
		String webName,
		String fullName,
		String premierLeagueClub,
		int premierLeagueClubId,
		String position
) {
}
