package com.fantasybroadcast.backend.fpl;

public record FplClassicLeagueEntry(
		long entryId,
		String entryName,
		String playerName,
		int rank,
		Integer lastRank,
		int total,
		int eventTotal,
		int pointsFor
) {
}
