package com.fantasybroadcast.backend.fpl;

import java.util.List;

public record FplLiveExplanation(
		int fixture,
		List<FplLivePointBreakdown> stats
) {
}
