package com.fantasybroadcast.backend.fpl;

public record FplEntryPick(
		int element,
		int position,
		int multiplier,
		boolean captain,
		boolean viceCaptain
) {

	public boolean starter() {
		return position <= 11;
	}

	public boolean benched() {
		return position > 11;
	}
}
