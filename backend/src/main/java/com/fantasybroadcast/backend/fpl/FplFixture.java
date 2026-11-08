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
		String kickoffTime,
		Integer homeDifficulty,
		Integer awayDifficulty
) {
	public FplFixture(int id, int event, int homeTeamId, int awayTeamId, Integer homeScore, Integer awayScore,
			boolean started, boolean finished, boolean finishedProvisional, int minutes, String kickoffTime) {
		this(id, event, homeTeamId, awayTeamId, homeScore, awayScore, started, finished, finishedProvisional, minutes, kickoffTime, null, null);
	}
}
