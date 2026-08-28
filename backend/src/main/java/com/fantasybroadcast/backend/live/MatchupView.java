package com.fantasybroadcast.backend.live;

public record MatchupView(
		String id,
		TeamView home,
		TeamView away,
		String leaderManagerId,
		String scoreline
) {
}
