package com.sextelecomleague.backend.narration;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.context.annotation.Profile;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
@Profile("db & !test")
public class BroadcastNarrationRepository {

	private final JdbcTemplate jdbcTemplate;

	public BroadcastNarrationRepository(JdbcTemplate jdbcTemplate) {
		this.jdbcTemplate = jdbcTemplate;
	}

	@Transactional
	public BroadcastNarration createPending(long leagueId, int gameweek, String sourceEventId) {
		return createPendingIfAbsent(leagueId, gameweek, sourceEventId)
				.or(() -> findBySourceEvent(leagueId, gameweek, sourceEventId))
				.orElseThrow();
	}

	@Transactional
	public Optional<BroadcastNarration> createPendingIfAbsent(long leagueId, int gameweek, String sourceEventId) {
		try {
			jdbcTemplate.update("""
					insert into broadcast_narration (league_id, gameweek, source_event_id, status)
					values (?, ?, ?, ?)
					""", leagueId, gameweek, sourceEventId, NarrationStatus.PENDING.name());
		}
		catch (DuplicateKeyException ignored) {
			return Optional.empty();
		}
		return findBySourceEvent(leagueId, gameweek, sourceEventId);
	}

	public Optional<BroadcastNarration> findById(long id) {
		var narrations = jdbcTemplate.query("""
				select id, league_id, gameweek, source_event_id, status, generated_text, audio_path,
				       text_input_tokens, text_output_tokens, tts_characters, error_message,
				       expires_at, created_at, updated_at
				from broadcast_narration where id = ?
				""", this::mapNarration, id);
		return narrations.stream().findFirst();
	}

	public Optional<BroadcastNarration> findBySourceEvent(long leagueId, int gameweek, String sourceEventId) {
		var narrations = jdbcTemplate.query("""
				select id, league_id, gameweek, source_event_id, status, generated_text, audio_path,
				       text_input_tokens, text_output_tokens, tts_characters, error_message,
				       expires_at, created_at, updated_at
				from broadcast_narration
				where league_id = ? and gameweek = ? and source_event_id = ?
				""", this::mapNarration, leagueId, gameweek, sourceEventId);
		return narrations.stream().findFirst();
	}

	public List<BroadcastNarration> readyForLeagueGameweek(long leagueId, int gameweek) {
		return jdbcTemplate.query("""
				select id, league_id, gameweek, source_event_id, status, generated_text, audio_path,
				       text_input_tokens, text_output_tokens, tts_characters, error_message,
				       expires_at, created_at, updated_at
				from broadcast_narration
				where league_id = ? and gameweek = ? and status in (?, ?)
				order by created_at desc, id desc
				""", this::mapNarration, leagueId, gameweek, NarrationStatus.TEXT_READY.name(), NarrationStatus.AUDIO_READY.name());
	}

	public Optional<BroadcastNarration> markTextReady(long id, String text, int inputTokens, int outputTokens) {
		jdbcTemplate.update("""
				update broadcast_narration
				set status = ?, generated_text = ?, text_input_tokens = ?, text_output_tokens = ?,
				    error_message = null, updated_at = current_timestamp
				where id = ?
				""", NarrationStatus.TEXT_READY.name(), text, inputTokens, outputTokens, id);
		return findById(id);
	}

	public Optional<BroadcastNarration> markAudioReady(long id, String audioPath, int ttsCharacters, Instant expiresAt) {
		jdbcTemplate.update("""
				update broadcast_narration
				set status = ?, audio_path = ?, tts_characters = ?, expires_at = ?,
				    error_message = null, updated_at = current_timestamp
				where id = ?
				""", NarrationStatus.AUDIO_READY.name(), audioPath, ttsCharacters, Timestamp.from(expiresAt), id);
		return findById(id);
	}

	public Optional<BroadcastNarration> markFailed(long id, String errorMessage) {
		jdbcTemplate.update("""
				update broadcast_narration
				set status = ?, error_message = ?, updated_at = current_timestamp
				where id = ?
				""", NarrationStatus.FAILED.name(), truncate(errorMessage, 500), id);
		return findById(id);
	}

	public Optional<BroadcastNarration> markSkippedBudget(long id, String reason) {
		jdbcTemplate.update("""
				update broadcast_narration
				set status = ?, error_message = ?, updated_at = current_timestamp
				where id = ?
				""", NarrationStatus.SKIPPED_BUDGET.name(), truncate(reason, 500), id);
		return findById(id);
	}

	public int countForLeagueGameweek(long leagueId, int gameweek) {
		var count = jdbcTemplate.queryForObject("""
				select count(*) from broadcast_narration
				where league_id = ? and gameweek = ?
				""", Integer.class, leagueId, gameweek);
		return count == null ? 0 : count;
	}

	public long ttsCharactersCreatedBetween(Instant startsAt, Instant endsAt) {
		var count = jdbcTemplate.queryForObject("""
				select coalesce(sum(tts_characters), 0) from broadcast_narration
				where created_at >= ? and created_at < ?
				""", Long.class, Timestamp.from(startsAt), Timestamp.from(endsAt));
		return count == null ? 0 : count;
	}

	private BroadcastNarration mapNarration(ResultSet resultSet, int rowNumber) throws SQLException {
		return new BroadcastNarration(
				resultSet.getLong("id"),
				resultSet.getLong("league_id"),
				resultSet.getInt("gameweek"),
				resultSet.getString("source_event_id"),
				NarrationStatus.valueOf(resultSet.getString("status")),
				resultSet.getString("generated_text"),
				resultSet.getString("audio_path"),
				resultSet.getInt("text_input_tokens"),
				resultSet.getInt("text_output_tokens"),
				resultSet.getInt("tts_characters"),
				resultSet.getString("error_message"),
				toInstant(resultSet.getTimestamp("expires_at")),
				resultSet.getTimestamp("created_at").toInstant(),
				resultSet.getTimestamp("updated_at").toInstant());
	}

	private static Instant toInstant(Timestamp timestamp) {
		return timestamp == null ? null : timestamp.toInstant();
	}

	private static String truncate(String value, int maxLength) {
		if (value == null || value.length() <= maxLength) {
			return value;
		}
		return value.substring(0, maxLength);
	}
}
