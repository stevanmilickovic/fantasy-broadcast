package com.fantasybroadcast.backend.live;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

class LiveStateResponseTests {

	@Test
	void exposesTheLeagueVoiceNarrationSettingWithoutChangingTheLivePayload() {
		var state = new LiveStateResponse(new LiveStatus("LIVE", "2026-09-01T12:00:00Z", "Live"), new SequenceState(1, 1, true, false),
				1, List.of(), List.of(), List.of(), List.of(), List.of());

		var voiceEnabled = state.withVoiceNarrationEnabled(true);

		assertThat(voiceEnabled.voiceNarrationEnabled()).isTrue();
		assertThat(voiceEnabled.events()).isEmpty();
	}
}
