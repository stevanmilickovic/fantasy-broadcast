package com.fantasybroadcast.backend.live;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** A deliberately busy sequence for exercising the broadcast UI. */
final class ComprehensiveMockLiveSequence {

	private static final List<TeamSeed> TEAMS = List.of(
			new TeamSeed("alpha", "Ava Reed", "lospolloshermanos", "LPH", "#2684ff", "Arsenal"),
			new TeamSeed("cornelius", "Cornelius Talmadge", "FCCornelius Talmadge", "FCT", "#f04770", "Chelsea"),
			new TeamSeed("cedar", "Maya Stone", "fudbaleri soker", "FSK", "#ffb000", "Liverpool"),
			new TeamSeed("delta", "Jon Bell", "zemun cowboys", "ZCB", "#24c47e", "Manchester City"),
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
		snapshots.add(state(1, points, goalAndAssist, "Goal and assist arrive together in lospolloshermanos v FCCornelius Talmadge."));

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
		var standings = standings(teams, matchups);
		return new LiveStateResponse(new LiveStatus("COMPREHENSIVE MOCK", "2026-08-21T20:" + String.format("%02d", step) + ":00Z", message),
				new SequenceState(step + 1, 8, true, step == 7), 1, matchups, List.of(), standings, events, List.of());
	}

	private static List<LiveStandingView> standings(List<TeamView> teams, List<MatchupView> matchups) {
		var liveTablePoints = new HashMap<String, Integer>();
		for (var matchup : matchups) {
			if (matchup.home().score() > matchup.away().score()) liveTablePoints.put(matchup.home().managerId(), 3);
			else if (matchup.home().score() < matchup.away().score()) liveTablePoints.put(matchup.away().managerId(), 3);
			else {
				liveTablePoints.put(matchup.home().managerId(), 1);
				liveTablePoints.put(matchup.away().managerId(), 1);
			}
		}
		var orderedTeams = new ArrayList<>(teams);
		orderedTeams.sort(Comparator
				.comparingInt((TeamView team) -> 18 + liveTablePoints.getOrDefault(team.managerId(), 0)).reversed()
				.thenComparing(Comparator.comparingInt(TeamView::score).reversed())
				.thenComparing(TeamView::clubName));
		var standings = new ArrayList<LiveStandingView>();
		for (var index = 0; index < orderedTeams.size(); index++) {
			var team = orderedTeams.get(index);
			var total = 18 + liveTablePoints.getOrDefault(team.managerId(), 0);
			standings.add(new LiveStandingView(team.managerId(), team.displayName(), team.clubName(), index + 1, total, team.score(), 38 + team.score()));
		}
		return standings;
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
					player.lineupSlot(), points.get(player.id()), 0, "AVAILABLE", delta);
			if (player.bench()) bench.add(view); else active.add(view);
		}
		var score = active.stream().mapToInt(PlayerView::points).sum();
		return new TeamView(seed.id(), seed.manager(), seed.club(), seed.shortName(), seed.color(), score, 0, active, bench);
	}

	private static List<PlayerSeed> playersFor(TeamSeed team) {
		return switch (team.id()) {
			case "alpha" -> players(team,
					player(team, "gk", "Raya", "GKP", "1", false),
					player(team, "def1", "Saliba", "DEF", "2", false), player(team, "def2", "Gabriel", "DEF", "3", false),
					player(team, "def3", "Timber", "DEF", "4", false), player(team, "def4", "Calafiori", "DEF", "5", false),
					player(team, "mid1", "Saka", "MID", "6", false), player(team, "mid2", "Rice", "MID", "7", false),
					player(team, "mid3", "Odegaard", "MID", "8", false), player(team, "mid4", "Martinelli", "MID", "9", false),
					player(team, "fwd1", "Havertz", "FWD", "10", false), player(team, "fwd2", "Jesus", "FWD", "11", false),
					player(team, "bench1", "White", "DEF", "12", true), player(team, "bench2", "Trossard", "MID", "13", true),
					player(team, "bench3", "Nwaneri", "FWD", "14", true), player(team, "bench4", "Kepa", "GKP", "15", true));
			case "cornelius" -> players(team,
					player(team, "gk", "Sanchez", "GKP", "1", false),
					player(team, "def1", "James", "DEF", "2", false), player(team, "def2", "Colwill", "DEF", "3", false),
					player(team, "def3", "Cucurella", "DEF", "4", false), player(team, "def4", "Gusto", "DEF", "5", false),
					player(team, "mid1", "Palmer", "MID", "6", false), player(team, "mid2", "Fernandez", "MID", "7", false),
					player(team, "mid3", "Caicedo", "MID", "8", false), player(team, "mid4", "Neto", "MID", "9", false),
					player(team, "fwd1", "Jackson", "FWD", "10", false), player(team, "fwd2", "Pedro", "FWD", "11", false),
					player(team, "bench1", "Chalobah", "DEF", "12", true), player(team, "bench2", "Madueke", "MID", "13", true),
					player(team, "bench3", "Nkunku", "FWD", "14", true), player(team, "bench4", "Jorgensen", "GKP", "15", true));
			case "cedar" -> players(team,
					player(team, "gk", "Alisson", "GKP", "1", false),
					player(team, "def1", "Van Dijk", "DEF", "2", false), player(team, "def2", "Konate", "DEF", "3", false),
					player(team, "def3", "Robertson", "DEF", "4", false), player(team, "def4", "Bradley", "DEF", "5", false),
					player(team, "mid1", "Salah", "MID", "6", false), player(team, "mid2", "Mac Allister", "MID", "7", false),
					player(team, "mid3", "Szoboszlai", "MID", "8", false), player(team, "mid4", "Diaz", "MID", "9", false),
					player(team, "fwd1", "Nunez", "FWD", "10", false), player(team, "fwd2", "Jota", "FWD", "11", false),
					player(team, "bench1", "Gomez", "DEF", "12", true), player(team, "bench2", "Jones", "MID", "13", true),
					player(team, "bench3", "Gakpo", "FWD", "14", true), player(team, "bench4", "Kelleher", "GKP", "15", true));
			case "delta" -> players(team,
					player(team, "gk", "Ederson", "GKP", "1", false),
					player(team, "def1", "Dias", "DEF", "2", false), player(team, "def2", "Gvardiol", "DEF", "3", false),
					player(team, "def3", "Akanji", "DEF", "4", false), player(team, "def4", "Ake", "DEF", "5", false),
					player(team, "mid1", "De Bruyne", "MID", "6", false), player(team, "mid2", "Foden", "MID", "7", false),
					player(team, "mid3", "Rodri", "MID", "8", false), player(team, "mid4", "Savinho", "MID", "9", false),
					player(team, "fwd1", "Haaland", "FWD", "10", false), player(team, "fwd2", "Marmoush", "FWD", "11", false),
					player(team, "bench1", "Stones", "DEF", "12", true), player(team, "bench2", "Silva", "MID", "13", true),
					player(team, "bench3", "Doku", "FWD", "14", true), player(team, "bench4", "Ortega", "GKP", "15", true));
			case "ember" -> players(team,
					player(team, "gk", "Vicario", "GKP", "1", false),
					player(team, "def1", "Porro", "DEF", "2", false), player(team, "def2", "Romero", "DEF", "3", false),
					player(team, "def3", "Van de Ven", "DEF", "4", false), player(team, "def4", "Udogie", "DEF", "5", false),
					player(team, "mid1", "Maddison", "MID", "6", false), player(team, "mid2", "Kulusevski", "MID", "7", false),
					player(team, "mid3", "Sarr", "MID", "8", false), player(team, "mid4", "Johnson", "MID", "9", false),
					player(team, "fwd1", "Son", "FWD", "10", false), player(team, "fwd2", "Richarlison", "FWD", "11", false),
					player(team, "bench1", "Davies", "DEF", "12", true), player(team, "bench2", "Bentancur", "MID", "13", true),
					player(team, "bench3", "Solanke", "FWD", "14", true), player(team, "bench4", "Forster", "GKP", "15", true));
			case "forge" -> players(team,
					player(team, "gk", "Pope", "GKP", "1", false),
					player(team, "def1", "Trippier", "DEF", "2", false), player(team, "def2", "Schar", "DEF", "3", false),
					player(team, "def3", "Botman", "DEF", "4", false), player(team, "def4", "Livramento", "DEF", "5", false),
					player(team, "mid1", "Gordon", "MID", "6", false), player(team, "mid2", "Guimaraes", "MID", "7", false),
					player(team, "mid3", "Tonali", "MID", "8", false), player(team, "mid4", "Barnes", "MID", "9", false),
					player(team, "fwd1", "Isak", "FWD", "10", false), player(team, "fwd2", "Wilson", "FWD", "11", false),
					player(team, "bench1", "Burn", "DEF", "12", true), player(team, "bench2", "Willock", "MID", "13", true),
					player(team, "bench3", "Murphy", "FWD", "14", true), player(team, "bench4", "Dubravka", "GKP", "15", true));
			default -> throw new IllegalArgumentException("Unknown comprehensive mock team: " + team.id());
		};
	}

	private static List<PlayerSeed> players(TeamSeed team, PlayerSeed... players) {
		return List.of(players);
	}

	private static PlayerSeed player(TeamSeed team, String suffix, String name, String position, String slot, boolean bench) {
		return new PlayerSeed(team.id() + "-" + suffix, name, name, position, slot, bench);
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
