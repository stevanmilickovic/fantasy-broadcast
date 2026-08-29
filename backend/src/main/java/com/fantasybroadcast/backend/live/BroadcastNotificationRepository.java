package com.fantasybroadcast.backend.live;

import java.sql.Timestamp;
import java.time.Instant;

import org.springframework.context.annotation.Profile;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
@Profile("db & !test")
public class BroadcastNotificationRepository {

	private final JdbcTemplate jdbcTemplate;

	public BroadcastNotificationRepository(JdbcTemplate jdbcTemplate) {
		this.jdbcTemplate = jdbcTemplate;
	}

	/** Records each notification once, even when the same state is sent to several viewers. */
	public void recordPublished(long leagueId, int gameweek, FantasyEventView event) {
		try {
			jdbcTemplate.update("""
					insert into broadcast_notification (league_id, gameweek, source_event_id, event_type, occurred_at)
					values (?, ?, ?, ?, ?)
					""", leagueId, gameweek, event.id(), event.type(), Timestamp.from(Instant.parse(event.occurredAt())));
		}
		catch (DuplicateKeyException ignored) {
			// The event was already recorded when this broadcast state was first published.
		}
	}

	public int countForLeague(long leagueId) {
		return count("select count(*) from broadcast_notification where league_id = ?", leagueId);
	}

	public int countForLeagueGameweek(long leagueId, int gameweek) {
		return count("select count(*) from broadcast_notification where league_id = ? and gameweek = ?", leagueId, gameweek);
	}

	private int count(String sql, Object... parameters) {
		var count = jdbcTemplate.queryForObject(sql, Integer.class, parameters);
		return count == null ? 0 : count;
	}
}
