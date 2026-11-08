package com.fantasybroadcast.backend.fpl;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class PlayerFixtureScheduleTests {
	@Test void scheduleKeepsDoublesBlanksSideSpecificDifficultyAndUnscheduledFixtures() {
		var fixtures=List.of(
				new FplFixture(1,8,1,2,2,1,true,true,true,90,"2026-10-01T23:30:00Z",2,4),
				new FplFixture(2,8,3,1,null,null,false,false,false,0,null,3,5),
				new FplFixture(3,9,1,2,null,null,false,false,false,0,"2026-10-08T18:00:00Z",1,5),
				new FplFixture(4,9,3,1,null,null,false,false,false,0,"2026-10-10T18:00:00Z",2,4),
				new FplFixture(5,0,1,2,null,null,false,false,false,0,null,null,null));
		var result=PlayerFixtureSchedule.build(1,8,fixtures,Map.of(2,"Liverpool",3,"Chelsea"),Instant.EPOCH);
		assertThat(result.current()).hasSize(2); assertThat(result.current().getFirst().teamScore()).isEqualTo(2);
		assertThat(result.current().get(1).home()).isFalse(); assertThat(result.current().get(1).difficulty()).isEqualTo(5);
		assertThat(result.current().get(1).kickoffTime()).isNull(); assertThat(result.current().get(1).teamScore()).isNull();
		assertThat(result.upcoming()).hasSize(5); assertThat(result.upcoming().getFirst().fixtures()).hasSize(2);
		assertThat(result.upcoming().get(1).fixtures()).isEmpty(); assertThat(result.unscheduled()).hasSize(1);
		assertThat(result.current().getFirst().kickoffTime()).isEqualTo("2026-10-01T23:30:00Z");
	}
	@Test void missingMappingOrSourceFailureIsExplicit() {
		var client=mock(FplDraftClient.class); var json=new ObjectMapper(); var mapper=new FplDraftMapper();
		assertThat(PlayerFixtureSchedule.load(client,mapper,json.readTree("{}"),0,8).unavailableReason()).contains("mapped");
		verifyNoInteractions(client);
		when(client.getCurrentFixtures()).thenThrow(new IllegalStateException("upstream"));
		assertThat(PlayerFixtureSchedule.load(client,mapper,json.readTree("{\"elements\":[{\"id\":2,\"team\":1}]}"),2,8).unavailableReason()).contains("temporarily unavailable");
	}
}
