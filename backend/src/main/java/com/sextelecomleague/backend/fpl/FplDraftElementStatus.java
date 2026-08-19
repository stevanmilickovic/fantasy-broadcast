package com.sextelecomleague.backend.fpl;

public record FplDraftElementStatus(
		int element,
		Integer owner,
		String status,
		boolean inAcceptedTrade
) {
}
