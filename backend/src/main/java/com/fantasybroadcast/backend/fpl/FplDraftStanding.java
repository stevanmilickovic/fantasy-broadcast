package com.fantasybroadcast.backend.fpl;

public record FplDraftStanding(
		int leagueEntryId,
		int rank,
		Integer lastRank,
		int headToHeadPoints,
		int pointsFor
) {
}
