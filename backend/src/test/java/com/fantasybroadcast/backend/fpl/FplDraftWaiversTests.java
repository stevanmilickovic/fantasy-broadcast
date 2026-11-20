package com.fantasybroadcast.backend.fpl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

class FplDraftWaiversTests {

	private final ObjectMapper json = new ObjectMapper();
	private final FplDraftClient client = mock(FplDraftClient.class);
	private final FplDraftWaivers waivers = new FplDraftWaivers(client, new FplDraftMapper());

	@BeforeEach
	void setUp() {
		when(client.getLeagueElementStatus(50)).thenReturn(json.readTree("""
				{"element_status":[
				  {"element":1,"owner":10,"status":"o"},
				  {"element":2,"owner":null,"status":"a"},
				  {"element":3,"owner":20,"status":"o"},
				  {"element":4,"owner":null,"status":"l"},
				  {"element":5,"owner":null,"status":"a","in_accepted_trade":true},
				  {"element":6,"owner":null,"status":"a"},
				  {"element":7,"owner":null,"status":"a"}
				]}
				"""));
		when(client.getCurrentDraftBootstrapStatic()).thenReturn(json.readTree("""
				{
				  "events":{"next":11,"data":[{"id":11,"waivers_time":"2026-11-20T11:00:00Z","deadline_time":"2026-11-21T11:00:00Z"}]},
				  "element_types":[{"id":2,"singular_name_short":"DEF"},{"id":3,"singular_name_short":"MID"}],
				  "elements":[
				    {"id":1,"code":101,"element_type":2},
				    {"id":2,"code":102,"element_type":2,"starts":9,"news_updated":null,"news_added":"2026-11-19T17:30:00Z","news":"Returned to training"},
				    {"id":3,"code":103,"element_type":2},
				    {"id":4,"code":104,"element_type":2},
				    {"id":5,"code":105,"element_type":2},
				    {"id":6,"code":106,"element_type":3},
				    {"id":7,"code":107,"element_type":2,"chance_of_playing_next_round":0},
				    {"id":8,"code":108,"element_type":2}
				  ]
				}
				"""));
	}

	@Test
	void returnsLiveOwnershipAndRanksOnlyEligibleSamePositionUpgradesByProjection() {
		when(client.getCurrentFantasyBootstrapStatic()).thenReturn(json.readTree("""
				{
				  "events":[{"id":11,"is_next":true}],
				  "elements":[
				    {"id":2,"code":101,"ep_next":"0.7"},
				    {"id":20,"code":102,"ep_next":"4.3"},
				    {"id":30,"code":103,"ep_next":"8.0"},
				    {"id":40,"code":104,"ep_next":"8.0"},
				    {"id":50,"code":105,"ep_next":"8.0"},
				    {"id":60,"code":106,"ep_next":"7.0"},
				    {"id":70,"code":107,"ep_next":"6.0"},
				    {"id":80,"code":108,"ep_next":"8.0"}
				  ]
				}
				"""));

		var result = waivers.load(50, 10);

		assertThat(result.gameweek()).isEqualTo(11);
		assertThat(result.waiverDeadline()).isEqualTo("2026-11-20T11:00:00Z");
		assertThat(result.squad()).extracting(player -> player.player().id()).containsExactly(1);
		assertThat(result.availablePlayers()).extracting(player -> player.player().id()).containsExactly(6, 7, 2);
		var pickup = result.availablePlayers().getLast();
		assertThat(pickup.player().availability().news()).isEqualTo("Returned to training");
		assertThat(pickup.newsUpdatedAt()).isEqualTo("2026-11-19T17:30:00Z");
		assertThat(result.upgrades()).singleElement().satisfies(upgrade -> {
			assertThat(upgrade.dropPlayerId()).isEqualTo(1);
			assertThat(upgrade.addPlayerId()).isEqualTo(2);
			assertThat(upgrade.expectedPointsGain()).isEqualByComparingTo("3.6");
		});
	}

	@Test
	void keepsAvailabilityWhenProjectionGameweekDiffers() {
		when(client.getCurrentFantasyBootstrapStatic()).thenReturn(json.readTree("""
				{"events":[{"id":12,"is_next":true}],"elements":[{"code":102,"ep_next":"4.3"}]}
				"""));

		var result = waivers.load(50, 10);

		assertThat(result.availablePlayers()).hasSize(3).allSatisfy(player -> assertThat(player.expectedPoints()).isNull());
		assertThat(result.upgrades()).isEmpty();
		assertThatThrownBy(() -> waivers.load(50, 99)).isInstanceOfSatisfying(ResponseStatusException.class,
				exception -> assertThat(exception.getStatusCode().value()).isEqualTo(404));
	}
}
