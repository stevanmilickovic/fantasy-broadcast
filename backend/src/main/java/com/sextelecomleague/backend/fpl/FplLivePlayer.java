package com.sextelecomleague.backend.fpl;

public record FplLivePlayer(
		int id,
		int totalPoints,
		int goalsScored,
		int assists,
		int cleanSheets,
		int yellowCards,
		int redCards,
		int bonus
) {
}
