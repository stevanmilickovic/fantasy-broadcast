package com.fantasybroadcast.backend.live;

import com.fantasybroadcast.backend.fpl.FplFixture;
import java.util.Collection;

public enum FixtureProgress {
	UPCOMING, LIVE, BETWEEN, COMPLETE, BLANK, TBD, UNKNOWN;

	public static FixtureProgress forClub(int clubId,int gameweek,Collection<FplFixture> fixtures) {
		if(clubId<=0 || fixtures.isEmpty()) return UNKNOWN;
		var games=fixtures.stream().filter(f -> f.event()==gameweek && (f.homeTeamId()==clubId || f.awayTeamId()==clubId)).toList();
		if(games.isEmpty()) return fixtures.stream().anyMatch(f -> f.event()==0 && (f.homeTeamId()==clubId || f.awayTeamId()==clubId) && !f.finished()) ? TBD : BLANK;
		if(games.stream().anyMatch(f -> f.started() && !f.finished() && !f.finishedProvisional())) return LIVE;
		if(games.stream().allMatch(f -> f.finished() || f.finishedProvisional())) return COMPLETE;
		if(games.stream().anyMatch(f -> f.finished() || f.finishedProvisional())) return BETWEEN;
		if(games.stream().anyMatch(f -> f.kickoffTime()==null || f.kickoffTime().isBlank())) return TBD;
		return UPCOMING;
	}
}
