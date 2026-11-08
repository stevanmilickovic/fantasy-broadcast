package com.fantasybroadcast.backend.live;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.fantasybroadcast.backend.fpl.*;
import java.util.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

class FplStandingsBaselineTests {
	private final ObjectMapper json = new ObjectMapper();
	private final FplDraftClient client = mock(FplDraftClient.class);

	@ParameterizedTest @EnumSource(FplLeagueType.class)
	void allLeagueFormatsReconstructClosedTotalsWithoutSubtractingOrAddingOfficialCurrentScores(FplLeagueType type) {
		for(var scoring : FplLeagueScoring.values()) {
			var root = json.createObjectNode(); root.putObject("league").put("start_event",1);
			root.putArray("standings").addObject().put("total",999).put("points_for",999);
			var matches = root.putArray("matches");
			for(int week=1;week<=7;week++) {
				matches.addObject().put("event",week).put("league_entry_1",1).put("league_entry_2",2)
						.put("league_entry_1_points",50).put("league_entry_2_points",40).put("finished",true);
				var classic = json.createObjectNode();
				classic.putArray("results").addObject().put("event",week).put("entry_1_entry",1).put("entry_2_entry",2).put("entry_1_points",50).put("entry_2_points",40);
				when(client.getHistoricalClassicLeagueMatches(4,week)).thenReturn(classic);
			}
			when(client.getLeagueDetails(4)).thenReturn(root); when(client.getClassicLeagueStandings(4)).thenReturn(root); when(client.getClassicPointsLeagueStandings(4)).thenReturn(root);
			var bootstrap = json.createObjectNode(); var events = bootstrap.putArray("events");
			for(int week=1;week<=7;week++) events.addObject().put("id",week).put("finished",true);
			when(client.getCurrentFantasyBootstrapStatic()).thenReturn(bootstrap);
			for(long id=1;id<=2;id++) {
				var history = json.createObjectNode(); history.putArray(type == FplLeagueType.DRAFT ? "history" : "current").addObject().put("event",7).put("total_points",300).put("event_transfers",1);
				when(client.getEntryHistory(type,id)).thenReturn(history);
			}
			var managers = List.of(new FplStandingsBaseline.Manager("1",1),new FplStandingsBaseline.Manager("2",2));
			var picks = Map.of(1L,new FplEntryEvent(List.of(),List.of(),"",0,55,2),2L,new FplEntryEvent(List.of(),List.of(),"",0,50,1));
			var result = new FplStandingsBaseline(client).load(type,scoring,4,8,managers,picks);
			assertThat(result.unavailableReason()).isNull();
			assertThat(result.rows()).extracting(LiveScoring.Baseline::fantasyPoints).containsExactly(300,300);
			assertThat(result.rows().getFirst().leaguePoints()).isEqualTo(scoring == FplLeagueScoring.H2H ? 21 : 0);
			assertThat(new FplStandingsBaseline(client).load(type,scoring,4,8,managers,picks)).isEqualTo(result);
		}
	}
	@Test void missingHistoryAndUnsettledPriorRoundsAreUnavailableInsteadOfZero() {
		var root = json.createObjectNode(); root.putObject("league").put("start_event",1);
		when(client.getLeagueDetails(4)).thenReturn(root);
		when(client.getCurrentFantasyBootstrapStatic()).thenReturn(json.readTree("{\"events\":[{\"id\":1,\"finished\":false}]}"));
		var result = new FplStandingsBaseline(client).load(FplLeagueType.DRAFT,FplLeagueScoring.TOTAL_POINTS,4,2,List.of(new FplStandingsBaseline.Manager("1",1)),Map.of());
		assertThat(result.rows()).isEmpty(); assertThat(result.unavailableReason()).contains("not settled");
		((ObjectNode)root.path("league")).remove("start_event");
		assertThat(new FplStandingsBaseline(client).load(FplLeagueType.DRAFT,FplLeagueScoring.TOTAL_POINTS,4,2,List.of(),Map.of()).unavailableReason()).contains("start round");
	}
	@Test void aClassicLeagueStartingThisWeekDoesNotDeductPrePhaseTransferCost() {
		var root = json.createObjectNode(); root.putObject("league").put("start_event",8);
		when(client.getClassicPointsLeagueStandings(4)).thenReturn(root);
		when(client.getCurrentFantasyBootstrapStatic()).thenReturn(json.readTree("{\"events\":[]}"));
		var result = new FplStandingsBaseline(client).load(FplLeagueType.CLASSIC,FplLeagueScoring.TOTAL_POINTS,4,8,
				List.of(new FplStandingsBaseline.Manager("1",1)),Map.of(1L,new FplEntryEvent(List.of(),List.of(),"",4,0,1)));
		assertThat(result.unavailableReason()).isNull();
		assertThat(result.rows().getFirst().fantasyPoints()).isZero();
		assertThat(result.rows().getFirst().currentTransferCredit()).isEqualTo(4);
	}
}
