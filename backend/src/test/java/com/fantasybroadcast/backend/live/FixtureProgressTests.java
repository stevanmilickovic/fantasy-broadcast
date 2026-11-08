package com.fantasybroadcast.backend.live;

import static org.assertj.core.api.Assertions.*;
import com.fantasybroadcast.backend.fpl.FplFixture;
import java.util.List;
import org.junit.jupiter.api.Test;

class FixtureProgressTests {
	private FplFixture fixture(int id,boolean started,boolean finished,String kickoff) { return new FplFixture(id,8,1,2,null,null,started,finished,finished,0,kickoff); }
	@Test void aClubCanBeLiveBeforeItsPlayerAppearsAndDoublesKeepEveryFixture() {
		var upcoming=fixture(1,false,false,"2026-10-01T12:00:00Z");
		var live=fixture(2,true,false,"2026-10-02T12:00:00Z");
		var complete=fixture(3,true,true,"2026-10-01T12:00:00Z");
		assertThat(FixtureProgress.forClub(1,8,List.of(upcoming))).isEqualTo(FixtureProgress.UPCOMING);
		assertThat(FixtureProgress.forClub(1,8,List.of(live))).isEqualTo(FixtureProgress.LIVE);
		assertThat(FixtureProgress.forClub(1,8,List.of(complete,upcoming))).isEqualTo(FixtureProgress.BETWEEN);
		assertThat(FixtureProgress.forClub(1,8,List.of(complete,live))).isEqualTo(FixtureProgress.LIVE);
		assertThat(FixtureProgress.forClub(1,8,List.of(complete))).isEqualTo(FixtureProgress.COMPLETE);
	}
	@Test void unknownBlankAndTbdAreDistinctAndSubstitutionCopiesPreserveProgress() {
		assertThat(FixtureProgress.forClub(0,8,List.of(fixture(1,true,true,null)))).isEqualTo(FixtureProgress.UNKNOWN);
		assertThat(FixtureProgress.forClub(1,8,List.of())).isEqualTo(FixtureProgress.UNKNOWN);
		assertThat(FixtureProgress.forClub(3,8,List.of(fixture(1,true,true,null)))).isEqualTo(FixtureProgress.BLANK);
		assertThat(FixtureProgress.forClub(1,8,List.of(fixture(1,false,false,null)))).isEqualTo(FixtureProgress.TBD);
		var player=new PlayerView("1","Player","Player","Club","MID","6",5,0,"AVAILABLE",0,false,null,FixtureProgress.BETWEEN);
		assertThat(LiveScoring.markSubstituted(player).fixtureProgress()).isEqualTo(FixtureProgress.BETWEEN);
		var old=new PlayerView("1","Player","Player","Club","MID","6",5,0,"AVAILABLE",0);
		assertThat(old.fixtureProgress()).isEqualTo(FixtureProgress.UNKNOWN);
	}
}
