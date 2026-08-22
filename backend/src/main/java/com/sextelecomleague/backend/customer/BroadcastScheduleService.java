package com.sextelecomleague.backend.customer;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
@Profile("db & !test")
public class BroadcastScheduleService {

	private final JdbcTemplate jdbcTemplate;

	public BroadcastScheduleService(JdbcTemplate jdbcTemplate) {
		this.jdbcTemplate = jdbcTemplate;
	}

	public List<BroadcastSchedule> allForAdmin(CurrentUser user) {
		requireAdmin(user);
		return jdbcTemplate.query("select id, starts_at, ends_at from broadcast_schedule order by starts_at desc, id desc", this::mapSchedule);
	}

	public BroadcastSchedule create(CurrentUser user, Instant startsAt, Instant endsAt) {
		requireAdmin(user);
		validateRange(startsAt, endsAt);
		jdbcTemplate.update("insert into broadcast_schedule (starts_at, ends_at) values (?, ?)", Timestamp.from(startsAt), Timestamp.from(endsAt));
		return jdbcTemplate.query("select id, starts_at, ends_at from broadcast_schedule order by id desc limit 1", this::mapSchedule).getFirst();
	}

	public BroadcastSchedule update(CurrentUser user, long id, Instant startsAt, Instant endsAt) {
		requireAdmin(user);
		validateRange(startsAt, endsAt);
		var changed = jdbcTemplate.update("update broadcast_schedule set starts_at = ?, ends_at = ?, updated_at = current_timestamp where id = ?", Timestamp.from(startsAt), Timestamp.from(endsAt), id);
		if (changed == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Broadcast schedule was not found.");
		return jdbcTemplate.query("select id, starts_at, ends_at from broadcast_schedule where id = ?", this::mapSchedule, id).getFirst();
	}

	public List<BroadcastSchedule> activeFor(CurrentUser user) {
		var now = Timestamp.from(Instant.now());
		return jdbcTemplate.query("select id, starts_at, ends_at from broadcast_schedule where starts_at <= ? and ends_at >= ? order by starts_at", this::mapSchedule, now, now);
	}

	public boolean hasActiveSchedule() {
		var now = Timestamp.from(Instant.now());
		var count = jdbcTemplate.queryForObject("select count(*) from broadcast_schedule where starts_at <= ? and ends_at >= ?", Long.class, now, now);
		return count != null && count > 0;
	}

	private void requireAdmin(CurrentUser user) {
		if (!user.admin()) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Administrator access is required.");
	}

	private void validateRange(Instant startsAt, Instant endsAt) {
		if (!endsAt.isAfter(startsAt)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The broadcast must end after it starts.");
	}

	private BroadcastSchedule mapSchedule(ResultSet resultSet, int rowNumber) throws SQLException {
		return new BroadcastSchedule(resultSet.getLong("id"), resultSet.getTimestamp("starts_at").toInstant().toString(), resultSet.getTimestamp("ends_at").toInstant().toString());
	}

	public record BroadcastSchedule(long id, String startsAt, String endsAt) { }
}
