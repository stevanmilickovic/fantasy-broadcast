package com.fantasybroadcast.backend.live;

import static org.assertj.core.api.Assertions.*;
import com.fantasybroadcast.backend.fpl.*;
import java.util.*;
import org.junit.jupiter.api.Test;

class LiveScoringTests {
	private final Map<Integer,FplPlayer> players = new HashMap<>();
	private final Map<Integer,FplLivePlayer> points = new HashMap<>();
	private final List<FplEntryPick> picks = new ArrayList<>();
	LiveScoringTests() {
		for(int id=1;id<=15;id++) {
			var position = id==1 || id==12 ? "GKP" : id<=5 || id==13 ? "DEF" : id<=9 || id==14 ? "MID" : "FWD";
			players.put(id,new FplPlayer(id,"Player "+id,"Player "+id,"Club",1,position,null,null));
			points.put(id,live(id,5,90));
			picks.add(new FplEntryPick(id,id,id==6 ? 2 : id<=11 ? 1 : 0,id==6,id==7));
		}
	}
	private FplLivePlayer live(int id,int score,int minutes) {
		return new FplLivePlayer(id,new FplLiveStats(minutes,0,0,0,0,0,0,0,0,0,0,0,0,score),List.of());
	}
	private FplFixture fixture(int id, boolean finished) { return new FplFixture(id,8,1,2,finished?0:null,finished?0:null,true,finished,finished,finished?90:30,null); }
	private TeamView team(String chip, boolean classic,List<FplFixture> fixtures) {
		return LiveScoring.team(1,"Manager","Club","Club",new FplEntryEvent(picks,List.of(),chip,4,0),players,points,fixtures,8,classic);
	}
	@Test void classicCaptainChipsTransferCostAndDraftRulesRemainDistinct() {
		assertThat(team("",true,List.of()).score()).isEqualTo(56);
		assertThat(team("3xc",true,List.of()).score()).isEqualTo(61);
		assertThat(team("bboost",true,List.of()).score()).isEqualTo(76);
		assertThat(team("3xc",false,List.of()).score()).isEqualTo(55);
	}
	@Test void doubleGameweekDoesNotTriggerPrematureSubstitutionOrCaptainFallback() {
		points.put(6,live(6,0,0));
		var between = team("",true,List.of(fixture(1,true),fixture(2,false)));
		assertThat(between.score()).isEqualTo(46); assertThat(between.automaticSubstitutions()).isEmpty();
		var complete = team("",true,List.of(fixture(1,true),fixture(2,true)));
		assertThat(complete.score()).isEqualTo(56);
		assertThat(complete.automaticSubstitutions()).hasSize(1);
		assertThat(complete.automaticSubstitutions().getFirst().playerInId()).isEqualTo("13");
		assertThat(team("3xc",true,List.of(fixture(1,true))).score()).isEqualTo(61);
	}
	@Test void keeperSubstitutionsAndBenchOrderRespectFormation() {
		points.put(1,live(1,0,0));
		var complete = team("",false,List.of(fixture(1,true)));
		assertThat(complete.automaticSubstitutions().getFirst().playerInId()).isEqualTo("12");
		assertThat(complete.activePlayers()).hasSize(11);
		assertThat(complete.activePlayers().stream().filter(p -> p.position().equals("GKP"))).hasSize(1);
	}
	@Test void missingDataIsNotZeroAndNegativeCorrectionsDoNotAccumulate() {
		points.remove(3);
		assertThatThrownBy(() -> team("",false,List.of())).hasMessageContaining("incomplete");
		points.put(3,live(3,-2,90));
		assertThat(team("",false,List.of()).score()).isEqualTo(48);
		assertThat(team("",false,List.of()).score()).isEqualTo(48);
	}
	@Test void recordedSubstitutionIsNotSwappedAgainWhenPositionsAreAlreadyResolved() {
		var resolved = new FplEntryEvent(List.of(new FplEntryPick(1,12,0,false,false),new FplEntryPick(12,1,1,false,false)),List.of(new FplAutomaticSubstitution(12,1)),"",0,0);
		assertThat(resolved.resolvedPicks()).isEqualTo(resolved.picks());
	}
	@Test void aBlankTeamCanResolveOnlyWhenTheWeekIsCompleteAndCardsCountAsAnAppearance() {
		points.put(6,live(6,0,0));
		var otherClub = new FplFixture(1,8,2,3,0,0,true,true,true,90,null);
		assertThat(team("",true,List.of(otherClub)).score()).isEqualTo(56);
		points.put(6,new FplLivePlayer(6,new FplLiveStats(0,0,0,0,0,0,0,0,1,0,0,0,0,-1),List.of()));
		var card = team("",true,List.of(otherClub));
		assertThat(card.automaticSubstitutions()).isEmpty(); assertThat(card.score()).isEqualTo(44);
	}
	@Test void closedBaselineKeepsAlreadyCountedOfficialScoresOutOfLiveTotals() {
		var one = team("",false,List.of());
		var two = new TeamView("2","Other","Other","Other","#fff",50,50,List.of(),List.of());
		var baselines = List.of(new LiveScoring.Baseline("1",7,9,300,null),new LiveScoring.Baseline("2",7,9,300,null));
		var matchup = new MatchupView("match",one,two,"1","55-50");
		var h2h = LiveScoring.standings(List.of(one,two),baselines,List.of(matchup),true,8);
		assertThat(h2h.getFirst().total()).isEqualTo(12); assertThat(h2h.getFirst().pointsFor()).isEqualTo(355);
		var total = LiveScoring.standings(List.of(one,two),baselines,List.of(),false,8);
		assertThat(total.getFirst().total()).isEqualTo(355);
		assertThatThrownBy(() -> LiveScoring.standings(List.of(one,two),baselines,List.of(matchup),true,9)).hasMessageContaining("another gameweek");
		assertThatThrownBy(() -> LiveScoring.standings(List.of(one,two),baselines,List.of(),true,8)).hasMessageContaining("incomplete");
	}
	@Test void equalScoresShareRankAndClassicTransferCountsBreakTiesWhenKnown() {
		var one = team("",false,List.of());
		var two = new TeamView("2","Other","Other","Other","#fff",55,0,List.of(),List.of());
		var tie = LiveScoring.standings(List.of(one,two),List.of(new LiveScoring.Baseline("1",7,0,300,null),new LiveScoring.Baseline("2",7,0,300,null)),List.of(),false,8);
		assertThat(tie).extracting(LiveStandingView::position).containsExactly(1,1);
		var ranked = LiveScoring.standings(List.of(one,two),List.of(new LiveScoring.Baseline("1",7,0,300,2),new LiveScoring.Baseline("2",7,0,300,1)),List.of(),false,8);
		assertThat(ranked.getFirst().teamId()).isEqualTo("2");
	}
}
