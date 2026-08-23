package com.sextelecomleague.backend.fpl;

public record FplClassicLeagueEntry(
		long entryId,
		String entryName,
		String playerName,
	int rank,
	int total,
	int eventTotal,
	int pointsFor
) {
}
