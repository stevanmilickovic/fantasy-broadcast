package com.fantasybroadcast.backend.fpl;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class CustomerFplDataTests {
	@Test void customerProjectionKeepsDisplayFieldsAndDropsUnknownIdentityFields() throws Exception {
		var mapper = new ObjectMapper();
		var source = mapper.readTree("""
				{"email":"secret@example.test","league":{"id":1,"name":"League","email":"secret@example.test"},
				"league_entries":[{"id":2,"entry_name":"Club","email":"secret@example.test"}],
				"matches":[{"id":3,"event":4,"league_entry_1_points":0}],"standings":[],
				"element_status":[{"element":5,"owner":2,"email":"secret@example.test"}]}
				""");
		var details = CustomerFplData.leagueDetails(source);
		assertThat(details.path("league").path("name").asString()).isEqualTo("League");
		assertThat(details.path("matches").get(0).path("league_entry_1_points").asInt()).isZero();
		assertThat(mapper.writeValueAsString(details)).doesNotContain("email", "secret@example.test");
		assertThat(mapper.writeValueAsString(CustomerFplData.elementStatus(source)))
				.contains("element", "owner").doesNotContain("email", "secret@example.test");
		assertThat(source.has("email")).isTrue();
	}
}
