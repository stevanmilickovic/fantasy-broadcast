package com.fantasybroadcast.backend.narration;

import static org.assertj.core.api.Assertions.assertThat;

import com.fantasybroadcast.backend.live.FantasyEventView;

import org.junit.jupiter.api.Test;

class NarrationEventSelectorTests {
	private final NarrationEventSelector selector = new NarrationEventSelector();

	@Test
	void selectsHighSignalFantasyEvents() {
		assertThat(selector.shouldNarrate(event("GOAL"))).isTrue();
		assertThat(selector.shouldNarrate(event("ASSIST"))).isTrue();
		assertThat(selector.shouldNarrate(event("RED_CARD"))).isTrue();
		assertThat(selector.shouldNarrate(event("PENALTY_SAVED"))).isTrue();
		assertThat(selector.shouldNarrate(event("CLEAN_SHEET_LOST"))).isTrue();
		assertThat(selector.shouldNarrate(event("BONUS"))).isTrue();
	}

	@Test
	void skipsLowSignalPointUpdates() {
		assertThat(selector.shouldNarrate(event("POINTS_UPDATE"))).isFalse();
		assertThat(selector.shouldNarrate(event("YELLOW_CARD"))).isFalse();
	}

	private FantasyEventView event(String type) {
		return new FantasyEventView("event-" + type, "2026-08-26T12:00:00Z", type, "10", "20", "Player " + type, 4, 4);
	}
}
