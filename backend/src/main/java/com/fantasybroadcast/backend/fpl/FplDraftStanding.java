package com.fantasybroadcast.backend.fpl;

public record FplDraftStanding(
		int leagueEntryId,
		int rank,
		int headToHeadPoints,
		int pointsFor
) {
}
