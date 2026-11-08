package com.fantasybroadcast.backend.live;

import com.fantasybroadcast.backend.fpl.*;
import java.util.*;

/** Deterministic scoring shared by league overviews and real broadcasts. */
public final class LiveScoring {
	private static final String[] COLORS = { "#2684ff", "#f04770", "#ffb000", "#24c47e", "#9b59ff", "#ff7a45" };
	private LiveScoring() { }

	public static TeamView team(long id, String manager, String name, String shortName, FplEntryEvent event,
			Map<Integer,FplPlayer> players, Map<Integer,FplLivePlayer> points, Collection<FplFixture> fixtures, int gameweek, boolean classic) {
		if (event == null || event.picks().isEmpty()) throw new IllegalStateException("FPL lineups are unavailable.");
		if(event.transferCost() < 0 || event.picks().stream().anyMatch(p -> p.position() < 1 || p.position() > 15 || p.multiplier() < 0 || p.multiplier() > 3)
				|| event.picks().stream().map(FplEntryPick::element).distinct().count() != event.picks().size())
			throw new IllegalStateException("FPL lineup data is invalid.");
		var active = new ArrayList<PlayerView>(); var bench = new ArrayList<PlayerView>();
		var substitutions = new ArrayList<AutoSubstitutionView>();
		var recordedIn = new HashSet<Integer>();
		for(var sub : event.automaticSubstitutions()) recordedIn.add(sub.elementIn());
		for(var pick : event.resolvedPicks().stream().sorted(Comparator.comparingInt(FplEntryPick::position)).toList()) {
			var player = players.get(pick.element()); var live = points.get(pick.element());
			if (player == null || live == null) throw new IllegalStateException("FPL player points or identities are incomplete.");
			var view = new PlayerView(String.valueOf(player.id()), player.fullName(), player.webName(), player.premierLeagueClub(),
					player.position(), String.valueOf(pick.position()), live.totalPoints(), live.stats().minutes(), "AVAILABLE", 0, recordedIn.contains(player.id()), player.availability());
			(pick.starter() ? active : bench).add(view);
		}
		var currentFixtures = fixtures.stream().filter(f -> f.event() == gameweek).toList();
		var settled = !currentFixtures.isEmpty() && currentFixtures.stream().allMatch(f -> f.finished() || f.finishedProvisional());
		if (settled && !(classic && event.benchBoost())) {
			for(var outgoing : List.copyOf(active)) {
				var playerId = Integer.parseInt(outgoing.id());
				if (appeared(points.get(playerId)) || players.get(playerId).premierLeagueClubId() <= 0) continue;
				var incoming = bench.stream().filter(p -> appeared(points.get(Integer.parseInt(p.id()))))
						.filter(p -> legalSubstitution(active, outgoing, p)).findFirst().orElse(null);
				if(incoming == null) continue;
				active.remove(outgoing); bench.remove(incoming); active.add(markSubstituted(incoming)); bench.add(outgoing);
				substitutions.add(new AutoSubstitutionView(incoming.id(), outgoing.id(), incoming.points()));
			}
		}
		var score = active.stream().mapToInt(PlayerView::points).sum();
		if(classic) {
			if(event.benchBoost()) score += bench.stream().mapToInt(PlayerView::points).sum();
			var captain = event.picks().stream().filter(FplEntryPick::captain).findFirst().orElse(null);
			var selected = captain;
			var captainSubstituted = captain != null && event.automaticSubstitutions().stream().anyMatch(sub -> sub.elementOut() == captain.element());
			var viceAlreadyPromoted = event.picks().stream().anyMatch(p -> p.viceCaptain() && p.multiplier() > 1);
			if(captain != null && !appeared(points.get(captain.element())) && (settled || captainSubstituted || viceAlreadyPromoted))
				selected = event.picks().stream().filter(FplEntryPick::viceCaptain).filter(p -> appeared(points.get(p.element()))).findFirst().orElse(null);
			if(selected != null && (event.benchBoost() || active.stream().map(PlayerView::id).toList().contains(String.valueOf(selected.element())))) {
				var multiplier = "3xc".equals(event.activeChip()) ? 3 : captain == null ? 2 : Math.max(2, captain.multiplier());
				score += points.get(selected.element()).totalPoints() * (multiplier - 1);
			}
			score -= event.transferCost();
		}
		return new TeamView(String.valueOf(id), manager, name, shortName, COLORS[(int)Math.floorMod(id,COLORS.length)], score,
				event.officialGameweekPoints(), active, bench, substitutions);
	}

	private static boolean appeared(FplLivePlayer player) {
		return player != null && (player.stats().minutes() > 0 || player.stats().yellowCards() > 0 || player.stats().redCards() > 0);
	}
	private static boolean legalSubstitution(List<PlayerView> active, PlayerView outgoing, PlayerView incoming) {
		if("GKP".equals(outgoing.position()) || "GKP".equals(incoming.position())) return outgoing.position().equals(incoming.position());
		var positions = new ArrayList<>(active.stream().filter(p -> !p.id().equals(outgoing.id())).map(PlayerView::position).toList());
		positions.add(incoming.position());
		return Collections.frequency(positions,"DEF") >= 3 && Collections.frequency(positions,"DEF") <= 5
				&& Collections.frequency(positions,"MID") >= 2 && Collections.frequency(positions,"MID") <= 5
				&& Collections.frequency(positions,"FWD") >= 1 && Collections.frequency(positions,"FWD") <= 3;
	}
	public static PlayerView markSubstituted(PlayerView player) {
		return new PlayerView(player.id(), player.displayName(), player.shortName(), player.premierLeagueClub(), player.position(), player.lineupSlot(),
				player.points(), player.minutes(), player.status(), player.recentDelta(), true, player.availability());
	}

	public static List<LiveStandingView> standings(List<TeamView> teams, List<Baseline> baselines, List<MatchupView> matchups, boolean h2h, int gameweek) {
		var byId = new HashMap<String,Baseline>();
		for(var baseline : baselines) {
			if(baseline.throughGameweek() != gameweek-1) throw new IllegalStateException("The live standings baseline belongs to another gameweek.");
			byId.put(baseline.managerId(), baseline);
		}
		var results = new HashMap<String,Integer>();
		for(var match : matchups) {
			if(match.home().managerId().equals(match.away().managerId()) || results.containsKey(match.home().managerId()) || results.containsKey(match.away().managerId()))
				throw new IllegalStateException("The current matchup schedule is incomplete or duplicated.");
			results.merge(match.home().managerId(), result(match.home().score(),match.away().score()), Integer::sum);
			results.merge(match.away().managerId(), result(match.away().score(),match.home().score()), Integer::sum);
		}
		var projected = new ArrayList<LiveStandingView>();
		for(var team : teams) {
			var baseline = byId.get(team.managerId());
			if(baseline == null || h2h && !results.containsKey(team.managerId())) throw new IllegalStateException("The live standings baseline or schedule is incomplete.");
			var fantasyTotal = baseline.fantasyPoints()+team.score()+baseline.currentTransferCredit();
			projected.add(new LiveStandingView(team.managerId(),team.displayName(),team.clubName(),0,
					h2h ? baseline.leaguePoints()+results.get(team.managerId()) : fantasyTotal,
					team.score(),fantasyTotal));
		}
		var transfersKnown = !h2h && baselines.stream().allMatch(b -> b.transfers() != null);
		Comparator<LiveStandingView> order = Comparator.comparingInt(LiveStandingView::total).reversed();
		if(h2h) order = order.thenComparing(Comparator.comparingInt(LiveStandingView::pointsFor).reversed());
		else if(transfersKnown) order = order.thenComparingInt(s -> byId.get(s.teamId()).transfers());
		projected.sort(order.thenComparing(LiveStandingView::teamName));
		var result = new ArrayList<LiveStandingView>(); int rank = 0;
		for(int i=0;i<projected.size();i++) {
			var row = projected.get(i);
			if(i == 0 || order.compare(projected.get(i-1),row) != 0) rank = i+1;
			result.add(new LiveStandingView(row.teamId(),row.managerName(),row.teamName(),rank,row.total(),row.gameweekPoints(),row.pointsFor()));
		}
		return result;
	}
	private static int result(int score, int opponent) { return score > opponent ? 3 : score == opponent ? 1 : 0; }
	public record Baseline(String managerId, int throughGameweek, int leaguePoints, int fantasyPoints, Integer transfers, int currentTransferCredit) {
		public Baseline(String managerId,int throughGameweek,int leaguePoints,int fantasyPoints,Integer transfers) { this(managerId,throughGameweek,leaguePoints,fantasyPoints,transfers,0); }
	}
}
