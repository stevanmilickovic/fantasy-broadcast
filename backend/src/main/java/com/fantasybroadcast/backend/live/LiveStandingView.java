package com.fantasybroadcast.backend.live;

/** A projected table row: the FPL table before the current gameweek plus live calculated points. */
public record LiveStandingView(
		String teamId,
		String managerName,
		String teamName,
		int position,
		int total,
		int gameweekPoints,
		int pointsFor
) {
}
