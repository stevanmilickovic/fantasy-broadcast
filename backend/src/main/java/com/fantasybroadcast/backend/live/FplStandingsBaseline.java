package com.fantasybroadcast.backend.live;

import com.fantasybroadcast.backend.fpl.*;
import java.util.*;
import tools.jackson.databind.JsonNode;

/** Rebuilds closed-week totals from history, independent of a process's start time. */
public final class FplStandingsBaseline {
	private final FplDraftClient client;
	public FplStandingsBaseline(FplDraftClient client) { this.client = client; }

	public Result load(FplLeagueType type, FplLeagueScoring scoring, long leagueId, int gameweek,
			List<Manager> managers, Map<Long,FplEntryEvent> picks) {
		try {
			var root = type == FplLeagueType.DRAFT ? client.getLeagueDetails(leagueId)
					: scoring == FplLeagueScoring.H2H ? client.getClassicLeagueStandings(leagueId) : client.getClassicPointsLeagueStandings(leagueId);
			var start = root.path("league").path("start_event").asInt(0);
			if(start < 1 || start > gameweek) return unavailable("FPL league start round is unavailable or has not started.");
			var bootstrap = client.getCurrentFantasyBootstrapStatic();
			var closed = new HashSet<Integer>();
			for(var event : bootstrap.path("events")) if(event.path("finished").asBoolean()) closed.add(event.path("id").asInt());
			for(int week=start;week<gameweek;week++) if(!closed.contains(week)) return unavailable("FPL has not settled the previous gameweek.");
			var wins = new HashMap<String,Integer>();
			if(scoring == FplLeagueScoring.H2H) {
				for(int week=start;week<gameweek;week++) {
					var matches = type == FplLeagueType.DRAFT ? root.path("matches") : client.getHistoricalClassicLeagueMatches(leagueId,week).path("results");
					if(!matches.isArray()) return unavailable("FPL's closed matchup schedule is incomplete.");
					var seen = new HashSet<String>();
					for(var match : matches) {
						if(match.path("event").asInt() != week) continue;
						if(match.path("is_knockout").asBoolean()) return unavailable("Live knockout standings are not supported.");
						if(type == FplLeagueType.DRAFT && !match.path("finished").asBoolean()) return unavailable("A closed Draft matchup is not settled.");
						var a = match.path(type == FplLeagueType.DRAFT ? "league_entry_1" : "entry_1_entry").asText();
						var b = match.path(type == FplLeagueType.DRAFT ? "league_entry_2" : "entry_2_entry").asText();
						var ap = match.path(type == FplLeagueType.DRAFT ? "league_entry_1_points" : "entry_1_points");
						var bp = match.path(type == FplLeagueType.DRAFT ? "league_entry_2_points" : "entry_2_points");
						if(!ap.isNumber() || !bp.isNumber() || !seen.add(a) || !seen.add(b)) return unavailable("FPL's closed matchup scores are incomplete.");
						wins.merge(a, result(ap.asInt(),bp.asInt()), Integer::sum);
						wins.merge(b, result(bp.asInt(),ap.asInt()), Integer::sum);
					}
					if(managers.stream().anyMatch(manager -> !seen.contains(manager.managerId()))) return unavailable("FPL's closed matchup schedule is incomplete.");
				}
			}
			var baselines = new ArrayList<LiveScoring.Baseline>();
			for(var manager : managers) {
				var fantasyPoints = 0; Integer transfers = 0;
				if(gameweek > start) {
					var historyRoot = client.getEntryHistory(type, manager.entryId());
					if(historyRoot == null) return unavailable("FPL manager history is unavailable.");
					var history = historyRoot.path(type == FplLeagueType.DRAFT ? "history" : "current");
					if(!history.isArray()) return unavailable("FPL manager history is incomplete.");
					var rounds = new HashMap<Integer,JsonNode>();
					for(var round : history) rounds.put(round.path(type == FplLeagueType.DRAFT ? "event" : "event").asInt(),round);
					var prior = rounds.get(gameweek-1);
					if(prior == null || !prior.path("total_points").isNumber()) return unavailable("FPL's previous-week total is unavailable.");
					if(start == 1) fantasyPoints = prior.path("total_points").asInt();
					else {
						for(int week=start;week<gameweek;week++) {
							var round = rounds.get(week);
							if(round == null || !round.path("points").isNumber()) return unavailable("FPL league-phase history is incomplete.");
							var deduct = type == FplLeagueType.CLASSIC && (scoring == FplLeagueScoring.H2H || week > start);
							if(deduct && !round.path("event_transfers_cost").isNumber()) return unavailable("FPL transfer deductions are incomplete.");
							fantasyPoints += round.path("points").asInt() - (deduct ? round.path("event_transfers_cost").asInt() : 0);
						}
					}
					var chipRounds = new HashSet<Integer>();
					for(var chip : historyRoot.path("chips")) if(Set.of("wildcard","freehit").contains(chip.path("name").asText())) chipRounds.add(chip.path("event").asInt());
					for(var round : history) if(round.path("event").asInt() < gameweek && !chipRounds.contains(round.path("event").asInt())) {
						if(!round.path("event_transfers").isNumber()) transfers = null;
						else if(transfers != null) transfers += round.path("event_transfers").asInt();
					}
				}
				var current = picks.get(manager.entryId());
				var phaseCredit = type == FplLeagueType.CLASSIC && scoring == FplLeagueScoring.TOTAL_POINTS && gameweek == start && start > 1;
				if(phaseCredit && current == null) return unavailable("FPL phase-start transfer data is unavailable.");
				if(type == FplLeagueType.CLASSIC && transfers != null) {
					if(current == null || current.transferCount() == null) transfers = null;
				else if(!"wildcard".equals(current.activeChip()) && !"freehit".equals(current.activeChip())) transfers += current.transferCount();
				}
				baselines.add(new LiveScoring.Baseline(manager.managerId(),gameweek-1,wins.getOrDefault(manager.managerId(),0),fantasyPoints,
						type == FplLeagueType.DRAFT ? null : transfers, phaseCredit ? current.transferCost() : 0));
			}
			return new Result(baselines,null);
		} catch(RuntimeException failed) { return unavailable("FPL history could not establish a live standings baseline."); }
	}
	private Result unavailable(String reason) { return new Result(List.of(),reason); }
	private int result(int a,int b) { return a>b ? 3 : a==b ? 1 : 0; }
	public record Manager(String managerId,long entryId) { }
	public record Result(List<LiveScoring.Baseline> rows,String unavailableReason) { }
}
