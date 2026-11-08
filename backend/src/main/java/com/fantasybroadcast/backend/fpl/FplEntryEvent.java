package com.fantasybroadcast.backend.fpl;

import java.util.List;
import java.util.HashMap;

public record FplEntryEvent(
		List<FplEntryPick> picks,
	List<FplAutomaticSubstitution> automaticSubstitutions,
	String activeChip,
	int transferCost,
	int officialGameweekPoints,
	Integer transferCount
) {
	public FplEntryEvent(List<FplEntryPick> picks, List<FplAutomaticSubstitution> substitutions, String chip, int cost, int official) {
		this(picks, substitutions, chip, cost, official, null);
	}

	/** Returns the current XI and bench after FPL has applied recorded automatic substitutions. */
	public List<FplEntryPick> resolvedPicks() {
		var picksByElement = new HashMap<Integer, FplEntryPick>();
		for (var pick : picks) picksByElement.put(pick.element(), pick);
		for (var substitution : automaticSubstitutions) {
			var outgoing = picksByElement.get(substitution.elementOut());
			var incoming = picksByElement.get(substitution.elementIn());
			if (outgoing == null || incoming == null) continue;
			if (!outgoing.starter() || incoming.starter()) continue;
			picksByElement.put(substitution.elementIn(), new FplEntryPick(substitution.elementIn(), outgoing.position(), 1,
					incoming.captain(), incoming.viceCaptain()));
			picksByElement.put(substitution.elementOut(), new FplEntryPick(substitution.elementOut(), incoming.position(), 0,
					outgoing.captain(), outgoing.viceCaptain()));
		}
		promoteViceCaptainWhenNeeded(picksByElement);
		return picks.stream().map(pick -> picksByElement.get(pick.element())).toList();
	}

	public boolean benchBoost() {
		return "bboost".equals(activeChip);
	}

	private void promoteViceCaptainWhenNeeded(java.util.Map<Integer, FplEntryPick> picksByElement) {
		var captain = picks.stream().filter(FplEntryPick::captain).findFirst().orElse(null);
		var viceCaptain = picks.stream().filter(FplEntryPick::viceCaptain).findFirst().orElse(null);
		if (captain == null || viceCaptain == null) return;
		var resolvedCaptain = picksByElement.get(captain.element());
		var resolvedViceCaptain = picksByElement.get(viceCaptain.element());
		if (resolvedCaptain == null || resolvedCaptain.starter() || resolvedViceCaptain == null || !resolvedViceCaptain.starter()) return;
		picksByElement.put(captain.element(), new FplEntryPick(resolvedCaptain.element(), resolvedCaptain.position(), 0, false,
				resolvedCaptain.viceCaptain()));
		picksByElement.put(viceCaptain.element(), new FplEntryPick(resolvedViceCaptain.element(), resolvedViceCaptain.position(),
				captain.multiplier(), true, false));
	}
}
