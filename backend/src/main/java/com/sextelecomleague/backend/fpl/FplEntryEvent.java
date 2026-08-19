package com.sextelecomleague.backend.fpl;

import java.util.List;

public record FplEntryEvent(
		List<FplEntryPick> picks
) {
}
