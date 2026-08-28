package com.fantasybroadcast.backend.fpl;

public record FplFixture(
		int id,
		int event,
		int homeTeamId,
		int awayTeamId,
		Integer homeScore,
		Integer awayScore,
		boolean started,
		boolean finished,
		boolean finishedProvisional,
		int minutes,
		String kickoffTime
) {
}
