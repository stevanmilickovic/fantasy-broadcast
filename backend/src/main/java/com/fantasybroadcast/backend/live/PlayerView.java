package com.fantasybroadcast.backend.live;

public record PlayerView(
		String id,
		String displayName,
		String shortName,
		String premierLeagueClub,
		String position,
		String lineupSlot,
		int points,
		Integer minutes,
		String status,
		int recentDelta,
		Boolean autoSubstituted,
		com.fantasybroadcast.backend.fpl.FplPlayer.Availability availability,
		FixtureProgress fixtureProgress
) {
	public PlayerView {
		if (autoSubstituted == null) autoSubstituted = false;
		if (fixtureProgress == null) fixtureProgress = FixtureProgress.UNKNOWN;
	}
	public PlayerView(String id,String displayName,String shortName,String club,String position,String slot,int points,Integer minutes,String status,int delta,Boolean substituted,com.fantasybroadcast.backend.fpl.FplPlayer.Availability availability) {
		this(id,displayName,shortName,club,position,slot,points,minutes,status,delta,substituted,availability,FixtureProgress.UNKNOWN);
	}
	public PlayerView(String id, String displayName, String shortName, String premierLeagueClub, String position,
			String lineupSlot, int points, Integer minutes, String status, int recentDelta) {
		this(id, displayName, shortName, premierLeagueClub, position, lineupSlot, points, minutes, status, recentDelta, false, null);
	}
}
