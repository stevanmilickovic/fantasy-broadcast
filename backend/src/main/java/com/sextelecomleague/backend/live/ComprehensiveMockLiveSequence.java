package com.sextelecomleague.backend.live;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** A deliberately busy sequence for exercising the broadcast UI. */
final class ComprehensiveMockLiveSequence {

	private static final List<TeamSeed> TEAMS = List.of(
			new TeamSeed("alpha", "Ava Reed", "Northbank United", "NBU", "#2684ff", "Arsenal"),
			new TeamSeed("cornelius", "Cornelius Talmadge", "FCCornelius Talmadge", "FCT", "#f04770", "Chelsea"),
			new TeamSeed("cedar", "Maya Stone", "Cedar City", "CDC", "#ffb000", "Liverpool"),
			new TeamSeed("delta", "Jon Bell", "Delta Athletic", "DEA", "#24c47e", "Manchester City"),
			new TeamSeed("ember", "Nia Cole", "Ember Rovers", "EMR", "#9b59ff", "Tottenham Hotspur"),
			new TeamSeed("forge", "Theo Nash", "Forge FC", "FGF", "#ff7a45", "Newcastle United")
	);

	private ComprehensiveMockLiveSequence() {
	}

	static List<LiveStateResponse> snapshots() {
		var points = new HashMap<String, Integer>();
		for (var team : TEAMS) {
			for (var player : playersFor(team)) points.put(player.id(), 0);
		}

		var snapshots = new ArrayList<LiveStateResponse>();
		snapshots.add(state(0, points, List.of(), "Comprehensive mock ready: six clubs and three live matchups."));

		var goalAndAssist = List.of(
			event("alpha-fwd1", "GOAL", 4),
			event("alpha-mid1", "ASSIST", 3));
		apply(points, goalAndAssist);
		snapshots.add(state(1, points, goalAndAssist, "Goal and assist arrive together in Northbank United v FCCornelius Talmadge."));

		var cleanSheets = List.of(
			event("cedar-gk", "CLEAN_SHEET", 4),
			event("cedar-def1", "CLEAN_SHEET", 4),
			event("cedar-def2", "CLEAN_SHEET", 4),
			event("cedar-def3", "CLEAN_SHEET", 4),
			event("cedar-def4", "CLEAN_SHEET", 4));
		apply(points, cleanSheets);
		snapshots.add(state(2, points, cleanSheets, "A clean-sheet batch tests several simultaneous player updates."));

		var cleanSheetRemoved = List.of(
			event("cedar-gk", "CLEAN_SHEET_LOST", -4),
			event("cedar-gk", "GOALS_CONCEDED", -1),
			event("cedar-def1", "CLEAN_SHEET_LOST", -4),
			event("cedar-def2", "CLEAN_SHEET_LOST", -4),
			event("cedar-def3", "CLEAN_SHEET_LOST", -4),
			event("cedar-def4", "CLEAN_SHEET_LOST", -4),
			event("delta-fwd1", "GOAL", 4),
			event("delta-mid1", "ASSIST", 3));
		apply(points, cleanSheetRemoved);
		snapshots.add(state(3, points, cleanSheetRemoved, "A goal removes the clean sheet while another matchup produces a goal and assist."));

		var penalties = List.of(
			event("ember-fwd1", "PENALTY_SCORED", 5),
			event("forge-fwd1", "PENALTY_MISSED", -2),
			event("forge-gk", "PENALTY_SAVED", 5));
		apply(points, penalties);
		snapshots.add(state(4, points, penalties, "Scored, missed, and saved penalties all arrive at once."));

		var disciplineAndBonus = List.of(
			event("alpha-mid2", "YELLOW_CARD", -1),
			event("delta-def1", "RED_CARD", -3),
			event("ember-mid1", "BONUS", 2));
		apply(points, disciplineAndBonus);
		snapshots.add(state(5, points, disciplineAndBonus, "Cards and bonus points test negative and positive updates together."));

		var samePlayerMultiple = List.of(
			event("alpha-fwd1", "GOAL", 4),
			event("alpha-fwd1", "BONUS", 2),
			event("alpha-mid1", "ASSIST", 3),
			event("cornelius-fwd1", "GOAL", 4),
			event("cornelius-mid1", "ASSIST", 3));
		apply(points, samePlayerMultiple);
		snapshots.add(state(6, points, samePlayerMultiple, "One player receives a goal and bonus together, alongside a response at the other end."));

		var finalRush = List.of(
			event("cornelius-gk", "GOALS_CONCEDED", -2),
			event("cornelius-def1", "CLEAN_SHEET_LOST", -4),
			event("cornelius-def2", "CLEAN_SHEET_LOST", -4),
			event("forge-fwd2", "GOAL", 4),
			event("forge-mid2", "ASSIST", 3),
			event("ember-gk", "PENALTY_SAVED", 5));
		apply(points, finalRush);
		snapshots.add(state(7, points, finalRush, "Final rush: concurrent changes across every matchup."));

		return List.copyOf(snapshots);
	}

	private static LiveStateResponse state(int step, Map<String, Integer> points, List<MockEvent> changes, String message) {
		var teams = new ArrayList<TeamView>();
		for (var seed : TEAMS) teams.add(team(seed, points, changes));
		var matchups = List.of(matchup("comprehensive-alpha-cornelius", teams.get(0), teams.get(1)),
				matchup("comprehensive-cedar-delta", teams.get(2), teams.get(3)),
				matchup("comprehensive-ember-forge", teams.get(4), teams.get(5)));
		var events = new ArrayList<FantasyEventView>();
		for (int i = 0; i < changes.size(); i++) {
			var change = changes.get(i);
			var player = playerById(change.playerId());
			var managerId = change.playerId().substring(0, change.playerId().indexOf('-'));
			events.add(new FantasyEventView("comprehensive-" + step + "-" + i, "2026-08-21T20:" + String.format("%02d", step) + ":00Z",
					change.type(), managerId, player.id(), player.displayName() + " " + change.type().replace('_', ' ').toLowerCase(),
					change.delta(), Math.abs(change.delta())));
		}
		events.sort((left, right) -> Integer.compare(right.priority(), left.priority()));
		return new LiveStateResponse(new LiveStatus("COMPREHENSIVE MOCK", "2026-08-21T20:" + String.format("%02d", step) + ":00Z", message),
				new SequenceState(step + 1, 8, true, step == 7), 1, matchups, events, List.of());
	}

	private static MatchupView matchup(String id, TeamView home, TeamView away) {
		var leader = home.score() == away.score() ? "" : home.score() > away.score() ? home.managerId() : away.managerId();
		return new MatchupView(id, home, away, leader, home.score() + "-" + away.score());
	}

	private static TeamView team(TeamSeed seed, Map<String, Integer> points, List<MockEvent> changes) {
		var active = new ArrayList<PlayerView>();
		var bench = new ArrayList<PlayerView>();
		for (var player : playersFor(seed)) {
			var delta = changes.stream().filter(change -> change.playerId().equals(player.id())).mapToInt(MockEvent::delta).sum();
			var view = new PlayerView(player.id(), player.displayName(), player.shortName(), seed.premierLeagueClub(), player.position(),
					player.lineupSlot(), points.get(player.id()), "AVAILABLE", delta);
			if (player.bench()) bench.add(view); else active.add(view);
		}
		var score = active.stream().mapToInt(PlayerView::points).sum();
		return new TeamView(seed.id(), seed.manager(), seed.club(), seed.shortName(), seed.color(), score, active, bench);
	}

	private static List<PlayerSeed> playersFor(TeamSeed team) {
		return List.of(
				player(team, "gk", "Goalkeeper", "GKP", "1", false),
				player(team, "def1", "Defender One", "DEF", "2", false), player(team, "def2", "Defender Two", "DEF", "3", false),
				player(team, "def3", "Defender Three", "DEF", "4", false), player(team, "def4", "Defender Four", "DEF", "5", false),
				player(team, "mid1", "Midfielder One", "MID", "6", false), player(team, "mid2", "Midfielder Two", "MID", "7", false),
				player(team, "mid3", "Midfielder Three", "MID", "8", false), player(team, "mid4", "Midfielder Four", "MID", "9", false),
				player(team, "fwd1", "Forward One", "FWD", "10", false), player(team, "fwd2", "Forward Two", "FWD", "11", false),
				player(team, "bench1", "Bench Defender", "DEF", "12", true), player(team, "bench2", "Bench Midfielder", "MID", "13", true),
				player(team, "bench3", "Bench Forward", "FWD", "14", true), player(team, "bench4", "Reserve Goalkeeper", "GKP", "15", true));
	}

	private static PlayerSeed player(TeamSeed team, String suffix, String role, String position, String slot, boolean bench) {
		return new PlayerSeed(team.id() + "-" + suffix, team.manager().split(" ")[0] + " " + role, role, position, slot, bench);
	}

	private static PlayerSeed playerById(String id) {
		for (var team : TEAMS) for (var player : playersFor(team)) if (player.id().equals(id)) return player;
		throw new IllegalArgumentException("Unknown comprehensive mock player: " + id);
	}

	private static MockEvent event(String playerId, String type, int delta) {
		return new MockEvent(playerId, type, delta);
	}

	private static void apply(Map<String, Integer> points, List<MockEvent> changes) {
		for (var change : changes) points.merge(change.playerId(), change.delta(), Integer::sum);
	}

	private record TeamSeed(String id, String manager, String club, String shortName, String color, String premierLeagueClub) {
	}

	private record PlayerSeed(String id, String displayName, String shortName, String position, String lineupSlot, boolean bench) {
	}

	private record MockEvent(String playerId, String type, int delta) {
	}
}
