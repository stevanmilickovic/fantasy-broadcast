package com.fantasybroadcast.backend.narration;

import java.util.Set;

import com.fantasybroadcast.backend.live.FantasyEventView;

import org.springframework.stereotype.Component;

@Component
public class NarrationEventSelector {
	private static final Set<String> NARRATED_EVENT_TYPES = Set.of(
			"GOAL",
			"ASSIST",
			"RED_CARD",
			"PENALTY_SAVED",
			"PENALTY_MISSED",
			"PENALTY_SCORED",
			"CLEAN_SHEET",
			"CLEAN_SHEET_LOST",
			"BONUS");

	public boolean shouldNarrate(FantasyEventView event) {
		return event != null && NARRATED_EVENT_TYPES.contains(event.type());
	}
}
