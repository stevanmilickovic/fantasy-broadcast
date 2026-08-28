package com.fantasybroadcast.backend.fpl;

public record FplLivePointBreakdown(
		String identifier,
		int points,
		int value,
		int pointsModification
) {
}
