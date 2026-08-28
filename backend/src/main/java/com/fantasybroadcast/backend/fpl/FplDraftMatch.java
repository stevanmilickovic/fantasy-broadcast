package com.fantasybroadcast.backend.fpl;

public record FplDraftMatch(
		int id,
		int event,
		int firstLeagueEntryId,
		int secondLeagueEntryId,
		int firstPoints,
		int secondPoints,
		boolean finished
) {
}
