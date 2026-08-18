package com.sextelecomleague.backend.fpl;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class FplDraftMapperTests {

	private final ObjectMapper objectMapper = new ObjectMapper();
	private final FplDraftMapper mapper = new FplDraftMapper();

	@Test
	void mapsDraftLeagueDetails() throws IOException {
		var league = mapper.mapLeagueDetails(readJson("fpl/draft-league-details.sample.json"));

		assertThat(league.entries()).hasSize(2);
		assertThat(league.entries().getFirst())
				.extracting(FplDraftLeagueEntry::leagueEntryId, FplDraftLeagueEntry::entryName,
						FplDraftLeagueEntry::playerName)
				.containsExactly(101, "Stevan FC", "Stevan Petrovic");
		assertThat(league.matches().getFirst())
				.extracting(FplDraftMatch::event, FplDraftMatch::firstLeagueEntryId, FplDraftMatch::secondLeagueEntryId,
						FplDraftMatch::firstPoints, FplDraftMatch::secondPoints)
				.containsExactly(1, 101, 102, 39, 37);
		assertThat(league.standings().getFirst())
				.extracting(FplDraftStanding::leagueEntryId, FplDraftStanding::rank,
						FplDraftStanding::headToHeadPoints, FplDraftStanding::pointsFor)
				.containsExactly(101, 1, 3, 39);
	}

	@Test
	void mapsBootstrapPlayers() throws IOException {
		var players = mapper.mapPlayers(readJson("fpl/bootstrap-static.sample.json"));

		assertThat(players).hasSize(2);
		assertThat(players.getFirst())
				.extracting(FplPlayer::id, FplPlayer::webName, FplPlayer::fullName, FplPlayer::premierLeagueClub,
						FplPlayer::position)
				.containsExactly(328, "Salah", "Mohamed Salah", "Liverpool", "MID");
	}

	@Test
	void mapsLivePlayerPointsAndStats() throws IOException {
		var livePlayers = mapper.mapLivePlayers(readJson("fpl/event-live.sample.json"));

		assertThat(livePlayers).hasSize(2);
		assertThat(livePlayers.getFirst())
				.extracting(FplLivePlayer::id, FplLivePlayer::totalPoints, FplLivePlayer::goalsScored,
						FplLivePlayer::assists, FplLivePlayer::bonus)
				.containsExactly(328, 7, 1, 0, 0);
	}

	private JsonNode readJson(String path) throws IOException {
		var resource = new ClassPathResource(path);
		return objectMapper.readTree(resource.getInputStream());
	}
}
