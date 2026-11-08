package com.fantasybroadcast.backend.fpl;

import java.time.Instant;
import java.util.*;
import tools.jackson.databind.JsonNode;

public final class PlayerFixtureSchedule {
	private PlayerFixtureSchedule() { }
	public static Schedule load(FplDraftClient client,FplDraftMapper mapper,JsonNode classicBootstrap,int classicPlayerId,int gameweek) {
		int clubId=0;
		for(var player : classicBootstrap.path("elements")) if(player.path("id").asInt()==classicPlayerId) clubId=player.path("team").asInt();
		if(classicPlayerId<=0 || clubId<=0) return unavailable("The player's club could not be mapped to the FPL fixture source.");
		var names=new HashMap<Integer,String>();
		for(var club : classicBootstrap.path("teams")) names.put(club.path("id").asInt(),club.path("name").asText());
		try {
			var source=client.getCurrentFixtures();
			if(!source.value().isArray() || source.value().isEmpty()) return unavailable("FPL fixture data is not available.");
			return build(clubId,gameweek,mapper.mapFixtures(source.value()),names,source.fetchedAt());
		} catch(RuntimeException failed) { return unavailable("FPL fixtures are temporarily unavailable."); }
	}
	public static Schedule build(int clubId,int gameweek,List<FplFixture> fixtures,Map<Integer,String> names,Instant fetchedAt) {
		var clubFixtures=fixtures.stream().filter(f -> f.homeTeamId()==clubId || f.awayTeamId()==clubId)
				.sorted(Comparator.comparing(FplFixture::kickoffTime,Comparator.nullsLast(Comparator.naturalOrder())).thenComparingInt(FplFixture::id))
				.map(f -> fixture(f,clubId,names)).toList();
		var upcoming=new ArrayList<Week>();
		for(int week=gameweek+1;week<=Math.min(38,gameweek+5);week++) {
			final int target=week;
			upcoming.add(new Week(week,clubFixtures.stream().filter(f -> f.gameweek()==target).toList()));
		}
		return new Schedule(clubFixtures.stream().filter(f -> f.gameweek()==gameweek).toList(),upcoming,
				clubFixtures.stream().filter(f -> f.gameweek()==0 && !f.status().equals("FINAL")).toList(),null,fetchedAt);
	}
	private static Fixture fixture(FplFixture source,int clubId,Map<Integer,String> names) {
		var home=source.homeTeamId()==clubId;
		String kickoff=null;
		try { if(source.kickoffTime()!=null) kickoff=Instant.parse(source.kickoffTime()).toString(); } catch(java.time.format.DateTimeParseException invalid) { /* Unknown kickoff stays TBD. */ }
		var status=source.finished() || source.finishedProvisional()?"FINAL":source.started()?"LIVE":kickoff==null?"TBD":"SCHEDULED";
		return new Fixture(source.id(),source.event(),names.getOrDefault(home?source.awayTeamId():source.homeTeamId(),"Club #"+(home?source.awayTeamId():source.homeTeamId())),home,kickoff,
				home?source.homeScore():source.awayScore(),home?source.awayScore():source.homeScore(),status,home?source.homeDifficulty():source.awayDifficulty());
	}
	private static Schedule unavailable(String reason) { return new Schedule(List.of(),List.of(),List.of(),reason,null); }
	public record Fixture(int id,int gameweek,String opponent,boolean home,String kickoffTime,Integer teamScore,Integer opponentScore,String status,Integer difficulty) { }
	public record Week(int gameweek,List<Fixture> fixtures) { }
	public record Schedule(List<Fixture> current,List<Week> upcoming,List<Fixture> unscheduled,String unavailableReason,Instant fetchedAt) { }
}
