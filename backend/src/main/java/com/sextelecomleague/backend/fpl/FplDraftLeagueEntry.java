package com.sextelecomleague.backend.fpl;

public record FplDraftLeagueEntry(
		int leagueEntryId,
		int entryId,
		String entryName,
		String playerName
) {
}
