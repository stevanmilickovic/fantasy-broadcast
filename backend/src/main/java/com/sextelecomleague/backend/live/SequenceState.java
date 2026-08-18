package com.sextelecomleague.backend.live;

public record SequenceState(
		int currentStep,
		int totalSteps,
		boolean started,
		boolean complete
) {
}
