package com.fantasybroadcast.backend.fpl;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class FplGameweekDataTests {
	private final ObjectMapper json = new ObjectMapper();
	@Test void draftClubMappingUsesVerifiedCodesInsteadOfCoincidentIds() throws Exception {
		var sample = json.readTree(new org.springframework.core.io.ClassPathResource("fpl/current-fixtures-mapping.sample.json").getInputStream());
		var draft = json.createObjectNode();
		var classic = json.createObjectNode();
		draft.putArray("elements").add(sample.path("draftPlayer"));
		classic.putArray("elements").add(sample.path("classicPlayer"));
		draft.putArray("teams").add(sample.path("draftClub"));
		var club = sample.path("classicClub").deepCopy();
		((tools.jackson.databind.node.ObjectNode) club).put("id", 91);
		classic.putArray("teams").add(club);
		var mapped = new FplDraftMapper().mapDraftPlayers(draft, classic).getFirst();
		assertThat(mapped.id()).isEqualTo(sample.path("draftPlayer").path("id").asInt());
		assertThat(mapped.premierLeagueClubId()).isEqualTo(91);
		assertThat(sample.path("draftPlayer").path("id").asInt()).isNotEqualTo(sample.path("classicPlayer").path("id").asInt());
	}
	@Test void preservesUnknownFixtureFieldsAndSideSpecificDifficulty() {
		var fixtures = new FplDraftMapper().mapFixtures(json.readTree("""
			[{"id":1,"event":null,"team_h":2,"team_a":3,"team_h_difficulty":2,"team_a_difficulty":5,"kickoff_time":null,"team_h_score":null,"team_a_score":0},
			 {"id":2,"event":8,"team_h":2,"team_a":4,"team_h_difficulty":0,"team_a_difficulty":null}]
			"""));
		assertThat(fixtures.getFirst().kickoffTime()).isNull();
		assertThat(fixtures.getFirst().homeScore()).isNull();
		assertThat(fixtures.getFirst().awayScore()).isZero();
		assertThat(fixtures.getFirst().homeDifficulty()).isEqualTo(2);
		assertThat(fixtures.getFirst().awayDifficulty()).isEqualTo(5);
		assertThat(fixtures.get(1).homeDifficulty()).isNull();
	}
	@Test void sourceTimesAndIncompleteDataRemainHonestAcrossGameweeks() {
		var client = mock(FplDraftClient.class);
		var now = Instant.parse("2026-10-01T00:00:00Z");
		when(client.getCurrentPoints(FplLeagueType.CLASSIC, 8)).thenReturn(new FplDraftClient.SourceJson(json.readTree("{\"elements\":[]}"), now));
		when(client.getCurrentPoints(FplLeagueType.CLASSIC, 9)).thenReturn(new FplDraftClient.SourceJson(json.readTree("{\"elements\":[{\"id\":1,\"stats\":{\"total_points\":0}}]}"), now.plusSeconds(30)));
		when(client.getCurrentFixtures()).thenReturn(new FplDraftClient.SourceJson(json.readTree("[]"), now));
		var service = new FplGameweekData(client, new FplDraftMapper());
		assertThat(service.load(FplLeagueType.CLASSIC, 8).complete()).isFalse();
		var next = service.load(FplLeagueType.CLASSIC, 9);
		assertThat(next.complete()).isTrue(); assertThat(next.gameweek()).isEqualTo(9);
		assertThat(next.pointsFetchedAt()).isEqualTo(now.plusSeconds(30));
		assertThat(next.fixturesFetchedAt()).isEqualTo(now);
		assertThat(FplGameweekData.currentGameweek(json.readTree("{\"events\":[{\"id\":9,\"is_current\":true}]}"))).isEqualTo(9);
	}
}
