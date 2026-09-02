package com.fantasybroadcast.backend.live;

import java.util.List;

public record LiveStateResponse(
		LiveStatus status,
		SequenceState sequence,
		int gameweek,
		List<MatchupView> matchups,
		List<TeamView> teams,
		List<LiveStandingView> standings,
		List<FantasyEventView> events,
		List<CommentaryView> commentary,
		Boolean voiceNarrationEnabled
) {
	public LiveStateResponse(LiveStatus status, SequenceState sequence, int gameweek, List<MatchupView> matchups,
			List<TeamView> teams, List<LiveStandingView> standings, List<FantasyEventView> events, List<CommentaryView> commentary) {
		this(status, sequence, gameweek, matchups, teams, standings, events, commentary, false);
	}

	public LiveStateResponse(LiveStatus status, SequenceState sequence, int gameweek, List<MatchupView> matchups,
			List<FantasyEventView> events, List<CommentaryView> commentary) {
		this(status, sequence, gameweek, matchups, List.of(), List.of(), events, commentary, false);
	}

	public LiveStateResponse(LiveStatus status, SequenceState sequence, int gameweek, List<MatchupView> matchups,
			List<TeamView> teams, List<FantasyEventView> events, List<CommentaryView> commentary) {
		this(status, sequence, gameweek, matchups, teams, List.of(), events, commentary, false);
	}

	public LiveStateResponse withVoiceNarrationEnabled(boolean enabled) {
		return new LiveStateResponse(status, sequence, gameweek, matchups, teams, standings, events, commentary, enabled);
	}
}
