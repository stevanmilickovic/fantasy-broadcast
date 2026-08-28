package com.fantasybroadcast.backend.fpl;

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
	void mapsClassicHeadToHeadLeague() throws IOException {
		var league = mapper.mapClassicLeague(
				readJson("fpl/classic-h2h-standings.sample.json"), readJson("fpl/classic-h2h-matches.sample.json"));

		assertThat(league.entries()).hasSize(2);
		assertThat(league.entries().getFirst())
				.extracting(FplClassicLeagueEntry::entryId, FplClassicLeagueEntry::entryName, FplClassicLeagueEntry::playerName)
				.containsExactly(9001L, "Red Star FC", "Stevan Petrovic");
		assertThat(league.matches().getFirst())
				.extracting(FplClassicMatch::firstEntryId, FplClassicMatch::secondEntryId,
						FplClassicMatch::firstPoints, FplClassicMatch::secondPoints)
				.containsExactly(9001L, 9002L, 48, 42);
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
		assertThat(livePlayers.getFirst().stats())
				.extracting(FplLiveStats::minutes, FplLiveStats::goalsConceded, FplLiveStats::bps)
				.containsExactly(90, 1, 22);
		assertThat(livePlayers.getFirst().explain()).hasSize(1);
		assertThat(livePlayers.getFirst().explain().getFirst().stats())
				.extracting(FplLivePointBreakdown::identifier, FplLivePointBreakdown::points,
						FplLivePointBreakdown::value)
				.containsExactly(
						org.assertj.core.groups.Tuple.tuple("minutes", 2, 90),
						org.assertj.core.groups.Tuple.tuple("goals_scored", 5, 1));
	}

	@Test
	void mapsElementStatusOwnership() throws IOException {
		var statuses = mapper.mapElementStatuses(readJson("fpl/element-status.sample.json"));

		assertThat(statuses).hasSize(2);
		assertThat(statuses.getFirst())
				.extracting(FplDraftElementStatus::element, FplDraftElementStatus::owner,
						FplDraftElementStatus::status, FplDraftElementStatus::inAcceptedTrade)
				.containsExactly(328, 101, "o", false);
		assertThat(statuses.get(1).owner()).isNull();
	}

	@Test
	void mapsEntryEventPicksWithStarterAndBenchClassification() throws IOException {
		var entryEvent = mapper.mapEntryEvent(readJson("fpl/entry-event.sample.json"));

		assertThat(entryEvent.picks()).hasSize(2);
		assertThat(entryEvent.picks().getFirst())
				.extracting(FplEntryPick::element, FplEntryPick::position, FplEntryPick::multiplier,
						FplEntryPick::captain, FplEntryPick::starter, FplEntryPick::benched)
				.containsExactly(328, 4, 3, true, true, false);
		assertThat(entryEvent.picks().get(1))
				.extracting(FplEntryPick::element, FplEntryPick::position, FplEntryPick::starter,
						FplEntryPick::benched)
				.containsExactly(3, 12, false, true);
		assertThat(entryEvent.resolvedPicks())
				.extracting(FplEntryPick::element, FplEntryPick::position, FplEntryPick::multiplier, FplEntryPick::captain)
				.containsExactly(
						org.assertj.core.groups.Tuple.tuple(328, 12, 0, false),
						org.assertj.core.groups.Tuple.tuple(3, 4, 3, true));
		assertThat(entryEvent.benchBoost()).isTrue();
		assertThat(entryEvent.transferCost()).isEqualTo(4);
	}

	@Test
	void mapsDraftEventLivePlayersAndFixtures() throws IOException {
		var live = mapper.mapDraftEventLive(readJson("fpl/draft-event-live.sample.json"));

		assertThat(live.players()).hasSize(1);
		assertThat(live.players().getFirst())
				.extracting(FplLivePlayer::id, FplLivePlayer::totalPoints)
				.containsExactly(328, 7);
		assertThat(live.fixtures()).hasSize(1);
		assertThat(live.fixtures().getFirst())
				.extracting(FplFixture::id, FplFixture::event, FplFixture::homeTeamId, FplFixture::awayTeamId,
						FplFixture::homeScore, FplFixture::awayScore, FplFixture::started, FplFixture::minutes)
				.containsExactly(1, 1, 1, 7, 2, 1, true, 63);
	}

	private JsonNode readJson(String path) throws IOException {
		var resource = new ClassPathResource(path);
		return objectMapper.readTree(resource.getInputStream());
	}
}
