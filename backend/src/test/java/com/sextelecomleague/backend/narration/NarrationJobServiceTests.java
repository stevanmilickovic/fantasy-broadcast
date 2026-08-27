package com.sextelecomleague.backend.narration;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;

import com.sextelecomleague.backend.live.FantasyEventView;
import com.sextelecomleague.backend.live.LiveStateResponse;
import com.sextelecomleague.backend.live.LiveStatus;
import com.sextelecomleague.backend.live.PlayerView;
import com.sextelecomleague.backend.live.SequenceState;
import com.sextelecomleague.backend.live.TeamView;

import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class NarrationJobServiceTests {
	private BroadcastNarrationRepository repository;
	private NarrationProperties properties;

	@BeforeEach
	void setUp() {
		var dataSource = new JdbcDataSource();
		dataSource.setURL("jdbc:h2:mem:narration-job-" + System.nanoTime() + ";MODE=MySQL;DATABASE_TO_UPPER=false;DB_CLOSE_DELAY=-1");
		var jdbcTemplate = new JdbcTemplate(dataSource);
		jdbcTemplate.execute("""
				create table broadcast_narration (
					id bigint auto_increment primary key,
					league_id bigint not null,
					gameweek int not null,
					source_event_id varchar(190) not null,
					status varchar(40) not null default 'PENDING',
					generated_text varchar(500),
					audio_path varchar(1024),
					text_input_tokens int not null default 0,
					text_output_tokens int not null default 0,
					tts_characters int not null default 0,
					error_message varchar(500),
					expires_at timestamp,
					created_at timestamp not null default current_timestamp,
					updated_at timestamp not null default current_timestamp,
					constraint uq_broadcast_narration_source_event unique (league_id, gameweek, source_event_id)
				)
				""");
		repository = new BroadcastNarrationRepository(jdbcTemplate);
		properties = new NarrationProperties();
		properties.setEnabled(true);
	}

	@Test
	void createsTextReadyNarrationJobsForSelectedEventsOnly() {
		properties.setAudioEnabled(false);
		var service = service();
		var state = state(List.of(event("event-1", "GOAL"), event("event-2", "POINTS_UPDATE")));

		var staged = service.enqueueForEvents(1L, state);

		assertThat(staged).isTrue();
		var narration = repository.findBySourceEvent(1L, 7, "event-1").orElseThrow();
		assertThat(narration.status()).isEqualTo(NarrationStatus.TEXT_READY);
		assertThat(narration.text()).isEqualTo("club: - Test Club: 2 -> 10 events: - Test Club / Player GOAL: goal changed_players: - Test Club / Player GOAL: 2 -> 10");
		assertThat(repository.findBySourceEvent(1L, 7, "event-2")).isEmpty();
	}

	@Test
	void deduplicatesRepeatedSourceEvents() {
		var service = service();
		var state = state(List.of(event("event-1", "GOAL")));

		assertThat(service.enqueueForEvents(1L, state)).isTrue();
		assertThat(service.enqueueForEvents(1L, state)).isTrue();

		assertThat(repository.countForLeagueGameweek(1L, 7)).isEqualTo(1);
	}

	@Test
	void createsMockAudioMetadataWhenAudioIsEnabled() {
		properties.setAudioEnabled(true);
		var service = service();

		service.enqueueForEvents(1L, state(List.of(event("event-1", "ASSIST"))));

		var narration = repository.findBySourceEvent(1L, 7, "event-1").orElseThrow();
		assertThat(narration.status()).isEqualTo(NarrationStatus.AUDIO_READY);
		assertThat(narration.audioPath()).endsWith("/event-1.mock.mp3");
		assertThat(narration.ttsCharacters()).isEqualTo(narration.text().length());
		assertThat(narration.expiresAt()).isAfter(Instant.now());
	}

	@Test
	void skipsNewJobsAfterLeagueGameweekLimit() {
		properties.getLimits().setMaxNarrationsPerLeagueGameweek(1);
		var service = service();

		var staged = service.enqueueForEvents(1L, state(List.of(event("event-1", "GOAL"), event("event-2", "ASSIST"))));

		assertThat(staged).isTrue();
		assertThat(repository.findBySourceEvent(1L, 7, "event-1")).isPresent();
		assertThat(repository.findBySourceEvent(1L, 7, "event-2")).isEmpty();
	}

	@Test
	void monthlyAudioBudgetFallsBackToTextOnly() {
		properties.setAudioEnabled(true);
		properties.getLimits().setMonthlyTtsCharacterBudget(5);
		var service = service();

		service.enqueueForEvents(1L, state(List.of(event("event-1", "GOAL"))));

		var narration = repository.findBySourceEvent(1L, 7, "event-1").orElseThrow();
		assertThat(narration.status()).isEqualTo(NarrationStatus.TEXT_READY);
		assertThat(narration.text()).isNotBlank();
		assertThat(narration.audioPath()).isNull();
		assertThat(narration.ttsCharacters()).isZero();
	}

	@Test
	void doesNotStageWhenOnlyLowSignalEventsArePresent() {
		var service = service();

		var staged = service.enqueueForEvents(1L, state(List.of(event("event-1", "POINTS_UPDATE"))));

		assertThat(staged).isFalse();
		assertThat(repository.countForLeagueGameweek(1L, 7)).isZero();
	}

	private NarrationJobService service() {
		return new NarrationJobService(properties, repository, new NarrationEventSelector(), new NarrationBudgetService(properties, repository),
				new MockCommentaryTextGenerator(), new MockVoiceNarrationGenerator(properties), Runnable::run);
	}

	private LiveStateResponse state(List<FantasyEventView> events) {
		var player = new PlayerView("20", "Player GOAL", "Player", "ARS", "MID", "STARTER", 10, 90, "LIVE", 4);
		var team = new TeamView("10", "Test Manager", "Test Club", "TST", "#123456", 10, 10, List.of(player), List.of());
		return new LiveStateResponse(new LiveStatus("REAL", Instant.now().toString(), "Testing."),
				new SequenceState(1, 0, true, false), 7, List.of(), List.of(team), List.of(), events, List.of());
	}

	private FantasyEventView event(String id, String type) {
		return new FantasyEventView(id, Instant.now().toString(), type, "10", "20", "Player " + type, 4, 4);
	}
}
