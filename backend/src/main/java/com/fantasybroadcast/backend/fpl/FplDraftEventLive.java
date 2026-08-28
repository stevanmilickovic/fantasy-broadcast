package com.fantasybroadcast.backend.fpl;

import java.util.List;

public record FplDraftEventLive(
		List<FplLivePlayer> players,
		List<FplFixture> fixtures
) {
}
