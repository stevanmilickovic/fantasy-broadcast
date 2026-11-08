package com.fantasybroadcast.backend.live;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** A points-league sequence for exercising the single-team and live-standings broadcast view. */
final class TotalPointsMockLiveSequence {
	private static final List<TeamSeed> TEAMS = List.of(
			new TeamSeed("aurora", "Ava Reed", "Aurora FC", "AFC", "#2684ff", 208),
			new TeamSeed("borough", "Ben Scott", "Borough United", "BUR", "#f04770", 205),
			new TeamSeed("city", "Cara Lee", "City Lions", "CTL", "#ffb000", 201),
			new TeamSeed("dock", "Dan Cole", "Dockside FC", "DSF", "#24c47e", 197),
			new TeamSeed("eagles", "Elle Grant", "Eagles FC", "EFC", "#9b59ff", 193),
			new TeamSeed("forest", "Finn Ray", "Forest Athletic", "FAT", "#ff7a45", 190),
			new TeamSeed("garden", "Gia Moss", "Garden City", "GCT", "#2684ff", 186),
			new TeamSeed("harbour", "Hugh Bell", "Harbour Rovers", "HBR", "#f04770", 181),
			new TeamSeed("island", "Ivy King", "Island Town", "IST", "#ffb000", 177),
			new TeamSeed("jupiter", "Jay Ross", "Jupiter FC", "JFC", "#24c47e", 172),
			new TeamSeed("kings", "Kai Wood", "Kings Park", "KPK", "#9b59ff", 168),
			new TeamSeed("lakes", "Liv Fox", "Lakeside FC", "LSF", "#ff7a45", 164)
	);

	private TotalPointsMockLiveSequence() { }

	static List<LiveStateResponse> snapshots() {
		var points = new HashMap<String, Integer>();
		for (var team : TEAMS) for (var player : playersFor(team)) points.put(player.id(), 0);
		var snapshots = new ArrayList<LiveStateResponse>();
		snapshots.add(state(0, points, List.of(), "Total-points mock ready: twelve live league positions."));
		var opening = List.of(event("aurora-fwd", "GOAL", 4), event("aurora-mid", "ASSIST", 3), event("lakes-fwd", "GOAL", 4), event("lakes-mid", "ASSIST", 3), event("lakes-def", "BONUS", 2));
		apply(points, opening); snapshots.add(state(1, points, opening, "Lakeside opens with the largest live scoring swing."));
		var swing = List.of(event("borough-fwd", "GOAL", 4), event("city-fwd", "GOAL", 4), event("city-fwd", "BONUS", 2), event("city-mid", "GOAL", 4));
		apply(points, swing); snapshots.add(state(2, points, swing, "Borough and City create a live standings swing."));
		var finalRush = List.of(event("lakes-fwd", "GOAL", 4), event("jupiter-mid", "BONUS", 2), event("aurora-def", "CLEAN_SHEET", 4));
		apply(points, finalRush); snapshots.add(state(3, points, finalRush, "Late points test standings movement and player updates."));
		return List.copyOf(snapshots);
	}

	private static LiveStateResponse state(int step, Map<String, Integer> points, List<MockEvent> changes, String message) {
		var teams = new ArrayList<TeamView>();
		for (var seed : TEAMS) teams.add(team(seed, points, changes));
		var standings = new ArrayList<LiveStandingView>();
		teams.sort(Comparator.comparingInt(TeamView::score).reversed());
		teams.sort(Comparator.comparingInt((TeamView team) -> baseTotal(team.managerId()) + team.score()).reversed());
		for (var index = 0; index < teams.size(); index++) {
			var team = teams.get(index);
			var total = baseTotal(team.managerId()) + team.score();
			standings.add(new LiveStandingView(team.managerId(), team.displayName(), team.clubName(), index + 1, total, team.score(), total));
		}
		var events = new ArrayList<FantasyEventView>();
		for (var index = 0; index < changes.size(); index++) {
			var change = changes.get(index);
			var player = playerById(change.playerId());
			var managerId = change.playerId().substring(0, change.playerId().indexOf('-'));
			events.add(new FantasyEventView("total-points-" + step + "-" + index, "2026-08-23T20:0" + step + ":00Z", change.type(), managerId,
					player.id(), player.displayName() + " " + change.type().replace('_', ' ').toLowerCase(), change.delta(), Math.abs(change.delta())));
		}
		events.sort((left, right) -> Integer.compare(right.priority(), left.priority()));
		return new LiveStateResponse(new LiveStatus("TOTAL_POINTS MOCK", "2026-08-23T20:0" + step + ":00Z", message),
				new SequenceState(step + 1, 4, true, step == 3), 1, List.of(), teams, standings, events, List.of());
	}

	private static TeamView team(TeamSeed seed, Map<String, Integer> points, List<MockEvent> changes) {
		var active = new ArrayList<PlayerView>(); var bench = new ArrayList<PlayerView>();
		for (var player : playersFor(seed)) {
			var delta = changes.stream().filter(change -> change.playerId().equals(player.id())).mapToInt(MockEvent::delta).sum();
			// The player token resolves its official shirt from this club name.  A league-wide
			// label here cannot be matched to a shirt code, so the mock must use a real club.
			var view = new PlayerView(player.id(), player.displayName(), player.shortName(), "Arsenal", player.position(), player.slot(), points.get(player.id()), 0, "AVAILABLE", delta,false,null,FixtureProgress.LIVE);
			if (player.bench()) bench.add(view); else active.add(view);
		}
		return new TeamView(seed.id(), seed.manager(), seed.club(), seed.shortName(), seed.color(), active.stream().mapToInt(PlayerView::points).sum(), 0, active, bench);
	}

	private static List<PlayerSeed> playersFor(TeamSeed team) {
		return List.of(player(team, "gk", "Goalkeeper", "GKP", "1", false), player(team, "def", "Defender", "DEF", "2", false),
				player(team, "def2", "Defender Two", "DEF", "3", false), player(team, "def3", "Defender Three", "DEF", "4", false),
				player(team, "def4", "Defender Four", "DEF", "5", false), player(team, "mid", "Midfielder", "MID", "6", false),
				player(team, "mid2", "Midfielder Two", "MID", "7", false), player(team, "mid3", "Midfielder Three", "MID", "8", false),
				player(team, "mid4", "Midfielder Four", "MID", "9", false), player(team, "fwd", "Forward", "FWD", "10", false),
				player(team, "fwd2", "Forward Two", "FWD", "11", false), player(team, "bench", "Bench Defender", "DEF", "12", true),
				player(team, "bench2", "Bench Midfielder", "MID", "13", true), player(team, "bench3", "Bench Forward", "FWD", "14", true),
				player(team, "bench4", "Reserve Goalkeeper", "GKP", "15", true));
	}

	private static PlayerSeed player(TeamSeed team, String suffix, String name, String position, String slot, boolean bench) { return new PlayerSeed(team.id() + "-" + suffix, team.manager().split(" ")[0] + " " + name, name, position, slot, bench); }
	private static PlayerSeed playerById(String id) { for (var team : TEAMS) for (var player : playersFor(team)) if (player.id().equals(id)) return player; throw new IllegalArgumentException("Unknown total-points mock player: " + id); }
	private static int baseTotal(String teamId) { return TEAMS.stream().filter(team -> team.id().equals(teamId)).findFirst().orElseThrow().baseTotal(); }
	private static MockEvent event(String playerId, String type, int delta) { return new MockEvent(playerId, type, delta); }
	private static void apply(Map<String, Integer> points, List<MockEvent> changes) { for (var change : changes) points.merge(change.playerId(), change.delta(), Integer::sum); }
	private record TeamSeed(String id, String manager, String club, String shortName, String color, int baseTotal) { }
	private record PlayerSeed(String id, String displayName, String shortName, String position, String slot, boolean bench) { }
	private record MockEvent(String playerId, String type, int delta) { }
}
