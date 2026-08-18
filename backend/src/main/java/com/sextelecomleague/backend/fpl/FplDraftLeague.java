package com.sextelecomleague.backend.fpl;

import java.util.List;

public record FplDraftLeague(
		List<FplDraftLeagueEntry> entries,
		List<FplDraftMatch> matches,
		List<FplDraftStanding> standings
) {
}
