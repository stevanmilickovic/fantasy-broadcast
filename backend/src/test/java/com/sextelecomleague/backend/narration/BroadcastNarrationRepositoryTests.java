package com.sextelecomleague.backend.narration;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;

import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class BroadcastNarrationRepositoryTests {

	private BroadcastNarrationRepository repository;
	private JdbcTemplate jdbcTemplate;

	@BeforeEach
	void setUp() {
		var dataSource = new JdbcDataSource();
		dataSource.setURL("jdbc:h2:mem:narration-" + System.nanoTime() + ";MODE=MySQL;DATABASE_TO_UPPER=false;DB_CLOSE_DELAY=-1");
		jdbcTemplate = new JdbcTemplate(dataSource);
		jdbcTemplate.execute("""
				create table league (
					id bigint auto_increment primary key,
					fpl_league_id bigint not null,
					display_name varchar(200) not null,
					league_type varchar(20) not null default 'DRAFT',
					scoring_type varchar(20) not null default 'H2H',
					service_enabled boolean not null default true,
					created_at timestamp not null default current_timestamp,
					updated_at timestamp not null default current_timestamp
				)
				""");
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
		jdbcTemplate.update("insert into league (fpl_league_id, display_name) values (?, ?)", 42L, "Test League");
		repository = new BroadcastNarrationRepository(jdbcTemplate);
	}

	@Test
	void createPendingDeduplicatesSourceEvent() {
		var first = repository.createPending(1L, 3, "event-1");
		var second = repository.createPending(1L, 3, "event-1");

		assertThat(second.id()).isEqualTo(first.id());
		assertThat(second.status()).isEqualTo(NarrationStatus.PENDING);
		assertThat(repository.createPendingIfAbsent(1L, 3, "event-1")).isEmpty();
		assertThat(repository.countForLeagueGameweek(1L, 3)).isEqualTo(1);
	}

	@Test
	void updatesNarrationTextAndAudioMetadata() {
		var pending = repository.createPending(1L, 3, "event-2");
		var textReady = repository.markTextReady(pending.id(), "Goal changes everything.", 121, 9).orElseThrow();
		var expiresAt = Instant.now().plusSeconds(900);

		var audioReady = repository.markAudioReady(textReady.id(), "/tmp/narration/event-2.mp3", 25, expiresAt).orElseThrow();

		assertThat(audioReady.status()).isEqualTo(NarrationStatus.AUDIO_READY);
		assertThat(audioReady.text()).isEqualTo("Goal changes everything.");
		assertThat(audioReady.audioPath()).isEqualTo("/tmp/narration/event-2.mp3");
		assertThat(audioReady.textInputTokens()).isEqualTo(121);
		assertThat(audioReady.textOutputTokens()).isEqualTo(9);
		assertThat(audioReady.ttsCharacters()).isEqualTo(25);
		assertThat(audioReady.expiresAt()).isNotNull();
		assertThat(repository.readyForLeagueGameweek(1L, 3)).extracting(BroadcastNarration::id).containsExactly(pending.id());
	}

	@Test
	void tracksMonthlyTtsCharactersByCreationTime() {
		var narration = repository.createPending(1L, 3, "event-3");
		repository.markAudioReady(narration.id(), "/tmp/narration/event-3.mp3", 37, Instant.now().plusSeconds(900));

		assertThat(repository.ttsCharactersCreatedBetween(Instant.now().minusSeconds(60), Instant.now().plusSeconds(60))).isEqualTo(37);
		assertThat(repository.ttsCharactersCreatedBetween(Instant.now().plusSeconds(60), Instant.now().plusSeconds(120))).isZero();
	}

	@Test
	void storesFailureAndBudgetStatuses() {
		var failed = repository.createPending(1L, 3, "event-4");
		var skipped = repository.createPending(1L, 3, "event-5");

		assertThat(repository.markFailed(failed.id(), "provider failed").orElseThrow().status()).isEqualTo(NarrationStatus.FAILED);
		assertThat(repository.markSkippedBudget(skipped.id(), "monthly budget exceeded").orElseThrow().status()).isEqualTo(NarrationStatus.SKIPPED_BUDGET);
		assertThat(repository.findBySourceEvent(1L, 3, "event-5").orElseThrow().errorMessage()).isEqualTo("monthly budget exceeded");
	}
}
