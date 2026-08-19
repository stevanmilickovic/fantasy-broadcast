package com.sextelecomleague.backend.fpl;

import java.util.List;

public record FplLiveExplanation(
		int fixture,
		List<FplLivePointBreakdown> stats
) {
}
