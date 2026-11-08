package com.fantasybroadcast.backend.live;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.fantasybroadcast.backend.fpl.*;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class LeagueLiveProjectionTests {
	private final ObjectMapper json = new ObjectMapper();
	@Test void freshManagerScoresReplaceStaleMatchupsWhileTheBaselineRemainsExplicit() {
		var client=mock(FplDraftClient.class); var data=mock(FplGameweekData.class);
		var bootstrap=json.createObjectNode(); bootstrap.putArray("events").addObject().put("id",1).put("is_current",true);
		bootstrap.putArray("teams").addObject().put("id",1).put("code",3).put("name","Arsenal");
		var elements=bootstrap.putArray("elements"); var points=new ArrayList<FplLivePlayer>(); var picks=json.createObjectNode(); var pickArray=picks.putArray("picks");
		for(int id=1;id<=15;id++) {
			elements.addObject().put("id",id).put("code",100+id).put("team",1).put("web_name","Player");
			points.add(new FplLivePlayer(id,new FplLiveStats(90,0,0,0,0,0,0,0,0,0,0,0,0,5),List.of()));
			pickArray.addObject().put("element",id).put("position",id).put("multiplier",id<=11?1:0);
		}
		when(client.getCurrentFantasyBootstrapStatic()).thenReturn(bootstrap); when(client.getCurrentDraftBootstrapStatic()).thenReturn(bootstrap);
		var league=json.readTree("""
			{"league":{"start_event":1},"league_entries":[{"id":101,"entry_id":1,"entry_name":"One"},{"id":102,"entry_id":2,"entry_name":"Two"}],
			"matches":[{"id":9,"event":1,"league_entry_1":101,"league_entry_2":102,"league_entry_1_points":0,"league_entry_2_points":0,"finished":false}],"standings":[]}
			""");
		when(client.getLeagueDetails(4)).thenReturn(league);
		when(client.getEntryEvent(anyLong(),eq(1))).thenReturn(picks);
		var time=Instant.parse("2026-10-01T12:00:00Z");
		when(data.load(FplLeagueType.DRAFT,1)).thenReturn(new FplGameweekData.Snapshot(FplLeagueType.DRAFT,1,points,List.of(new FplFixture(1,1,1,2,1,0,true,false,false,30,null)),time,time,true,null));
		var service=new LeagueLiveProjection(client,new FplDraftMapper(),data);
		var result=service.load(4,FplLeagueType.DRAFT,FplLeagueScoring.H2H);
		assertThat(result.scoresUnavailableReason()).isNull(); assertThat(result.standingsUnavailableReason()).isNull();
		assertThat(result.matchups().getFirst().firstPoints()).isEqualTo(55);
		assertThat(result.status()).isEqualTo("LIVE"); assertThat(result.pointsFetchedAt()).isEqualTo(time);
		assertThat(result.standings()).extracting(LiveStandingView::total).containsExactly(1,1);
		pickArray.remove(14);
		assertThat(service.load(4,FplLeagueType.DRAFT,FplLeagueScoring.H2H).scoresUnavailableReason()).contains("complete");
	}
}
