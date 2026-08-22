package com.sextelecomleague.backend.fpl;

import java.util.List;

/** Regular FPL head-to-head league data, normalized from the Fantasy API. */
public record FplClassicLeague(
		List<FplClassicLeagueEntry> entries,
		List<FplClassicMatch> matches
) {
}
