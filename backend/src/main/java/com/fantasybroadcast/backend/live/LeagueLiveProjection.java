package com.fantasybroadcast.backend.live;

import com.fantasybroadcast.backend.fpl.*;
import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

@Service
public class LeagueLiveProjection {
	private final FplDraftClient client;
	private final FplDraftMapper mapper;
	private final FplGameweekData data;
	public LeagueLiveProjection(FplDraftClient client, FplDraftMapper mapper, FplGameweekData data) {
		this.client=client; this.mapper=mapper; this.data=data;
	}

	public Projection load(long leagueId, FplLeagueType type, FplLeagueScoring scoring) {
		var bootstrap = client.getCurrentFantasyBootstrapStatic();
		var gameweek = FplGameweekData.currentGameweek(bootstrap);
		var source = data.load(type,gameweek);
		var fixtures = source.fixtures().stream().filter(f -> f.event() == gameweek).toList();
		var status = status(bootstrap,gameweek,fixtures);
		if(!source.complete()) return unavailable(source,status,source.unavailableReason());
		var root = type == FplLeagueType.DRAFT ? client.getLeagueDetails(leagueId)
				: scoring == FplLeagueScoring.H2H ? client.getClassicLeagueStandings(leagueId) : client.getClassicPointsLeagueStandings(leagueId);
		var managers = new ArrayList<Manager>();
		var pairings = new ArrayList<Pairing>();
		var averageIds = new HashSet<String>();
		List<FplPlayer> players;
		if(type == FplLeagueType.DRAFT) {
			var league = mapper.mapLeagueDetails(root);
			for(var entry : league.entries()) if(entry.entryId()>0)
				managers.add(new Manager(String.valueOf(entry.leagueEntryId()),entry.entryId(),entry.playerName(),entry.entryName()));
			else averageIds.add(String.valueOf(entry.leagueEntryId()));
			for(var match : root.path("matches")) if(scoring == FplLeagueScoring.H2H && match.path("event").asInt() == gameweek)
				pairings.add(new Pairing(match.path("id").asInt(),match.path("league_entry_1").asText(),match.path("league_entry_2").asText(),
						match.path("league_entry_1_points").isNumber()?match.path("league_entry_1_points").asInt():null,
						match.path("league_entry_2_points").isNumber()?match.path("league_entry_2_points").asInt():null,false));
			players = mapper.mapDraftPlayers(client.getCurrentDraftBootstrapStatic(),bootstrap);
		} else {
			if(root.path("standings").path("has_next").asBoolean()) return unavailable(source,status,"The FPL manager list is incomplete.");
			for(var entry : mapper.mapClassicLeagueEntries(root)) if(entry.entryId()>0)
				managers.add(new Manager(String.valueOf(entry.entryId()),entry.entryId(),entry.playerName(),entry.entryName()));
			if(scoring == FplLeagueScoring.H2H) {
				var schedule = client.getClassicLeagueMatches(leagueId,gameweek);
				if(schedule.path("has_next").asBoolean()) return unavailable(source,status,"The current FPL matchup schedule is incomplete.");
				for(var match : schedule.path("results")) pairings.add(new Pairing(match.path("id").asInt(),match.path("entry_1_entry").asText(),match.path("entry_2_entry").asText(),
						match.path("entry_1_points").isNumber()?match.path("entry_1_points").asInt():null,
						match.path("entry_2_points").isNumber()?match.path("entry_2_points").asInt():null,match.path("is_knockout").asBoolean()));
			}
			players = mapper.mapPlayers(bootstrap);
		}
		if(managers.isEmpty() || managers.size()>50) return unavailable(source,status,"Live scores require a complete league of up to 50 managers.");
		var byPlayer = new HashMap<Integer,FplPlayer>(); for(var player : players) byPlayer.put(player.id(),player);
		var byPoints = new HashMap<Integer,FplLivePlayer>(); for(var player : source.players()) byPoints.put(player.id(),player);
		var teams = new LinkedHashMap<String,TeamView>();
		var entryEvents = new LinkedHashMap<Long,FplEntryEvent>();
		try {
			for(var manager : managers) {
				var picks = mapper.mapEntryEvent(type == FplLeagueType.DRAFT ? client.getEntryEvent(manager.entryId(),gameweek) : client.getFantasyEntryEvent(manager.entryId(),gameweek));
				if(picks.picks().size()!=15 || type==FplLeagueType.CLASSIC && picks.picks().stream().noneMatch(FplEntryPick::captain))
					return unavailable(source,status,"FPL has not returned complete current-gameweek lineups.");
				entryEvents.put(manager.entryId(),picks);
				teams.put(manager.id(),LiveScoring.team(Long.parseLong(manager.id()),manager.name(),manager.club(),manager.club(),picks,byPlayer,byPoints,source.fixtures(),gameweek,type==FplLeagueType.CLASSIC));
			}
		} catch(IllegalStateException incomplete) { return unavailable(source,status,"FPL player points or identities are incomplete."); }
		var matches = new ArrayList<MatchupView>(); var matchViews = new ArrayList<CurrentMatch>();
		String scheduleReason = null;
		for(var pair : pairings) {
			var home = teams.get(pair.home()); var away = teams.get(pair.away());
			if(home==null && (averageIds.contains(pair.home()) || average(pair.home())) && "FINAL".equals(status) && pair.homeOfficial()!=null) home=averageTeam(pair.home(),pair.homeOfficial());
			if(away==null && (averageIds.contains(pair.away()) || average(pair.away())) && "FINAL".equals(status) && pair.awayOfficial()!=null) away=averageTeam(pair.away(),pair.awayOfficial());
			if(home==null || away==null || pair.knockout()) scheduleReason="Live standings require complete non-knockout pairings; an average opponent needs a settled FPL score.";
			else matches.add(new MatchupView(String.valueOf(pair.id()),home,away,home.score()==away.score()?"":home.score()>away.score()?home.managerId():away.managerId(),home.score()+"-"+away.score()));
			matchViews.add(new CurrentMatch(pair.id(),gameweek,pair.home(),pair.away(),home==null?null:home.score(),away==null?null:away.score(),home==null||away==null?"UNAVAILABLE":status));
		}
		var baseline = new FplStandingsBaseline(client).load(type,scoring,leagueId,gameweek,
				managers.stream().map(m -> new FplStandingsBaseline.Manager(m.id(),m.entryId())).toList(),entryEvents);
		var standings = List.<LiveStandingView>of();
		var reason = scheduleReason == null ? baseline.unavailableReason() : scheduleReason;
		if(reason==null) {
			try { standings=LiveScoring.standings(List.copyOf(teams.values()),baseline.rows(),matches,scoring==FplLeagueScoring.H2H,gameweek); }
			catch(IllegalStateException incomplete) { reason="FPL's current matchup schedule is incomplete."; }
		}
		var scores = new LinkedHashMap<String,Integer>(); teams.forEach((id,team) -> scores.put(id,team.score()));
		return new Projection(type,gameweek,source.pointsFetchedAt(),source.fixturesFetchedAt(),status,gameweek-1,scores,matchViews,standings,null,reason);
	}
	private boolean average(String id) { try { return Long.parseLong(id)<=0; } catch(NumberFormatException invalid) { return false; } }
	private TeamView averageTeam(String id,int score) { return new TeamView(id,"Average","Average","Average","#777",score,score,List.of(),List.of()); }
	private Projection unavailable(FplGameweekData.Snapshot source,String status,String reason) {
		return new Projection(source.source(),source.gameweek(),source.pointsFetchedAt(),source.fixturesFetchedAt(),status,source.gameweek()-1,Map.of(),List.of(),List.of(),reason,reason);
	}
	private String status(JsonNode bootstrap,int gameweek,List<FplFixture> fixtures) {
		for(var event : bootstrap.path("events")) if(event.path("id").asInt()==gameweek && event.path("finished").asBoolean() && event.path("data_checked").asBoolean()) return "FINAL";
		if(fixtures.stream().anyMatch(f -> f.started() && !f.finished() && !f.finishedProvisional())) return "LIVE";
		if(fixtures.stream().anyMatch(FplFixture::started)) return "PROVISIONAL";
		return "UPCOMING";
	}
	private record Manager(String id,long entryId,String name,String club) { }
	private record Pairing(int id,String home,String away,Integer homeOfficial,Integer awayOfficial,boolean knockout) { }
	public record CurrentMatch(int id,int event,String firstManagerId,String secondManagerId,Integer firstPoints,Integer secondPoints,String status) { }
	public record Projection(FplLeagueType source,int gameweek,Instant pointsFetchedAt,Instant fixturesFetchedAt,String status,int baselineGameweek,
			Map<String,Integer> managerScores,List<CurrentMatch> matchups,List<LiveStandingView> standings,String scoresUnavailableReason,String standingsUnavailableReason) { }
}
