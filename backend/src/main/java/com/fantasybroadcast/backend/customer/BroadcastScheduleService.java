package com.fantasybroadcast.backend.customer;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import com.fantasybroadcast.backend.fpl.FplDraftClient;
import java.util.List;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Profile("db & !test")
public class BroadcastScheduleService {
	private static final ZoneId SCHEDULE_ZONE = ZoneId.of("Europe/Budapest");
	private static final Duration PRE_MATCH = Duration.ofMinutes(15);
	private static final Duration BROADCAST_LENGTH = Duration.ofHours(3);
	private static final Duration MERGE_GAP = Duration.ofMinutes(30);

	private final JdbcTemplate jdbcTemplate;
	private final FplDraftClient fplClient;

	public BroadcastScheduleService(JdbcTemplate jdbcTemplate, FplDraftClient fplClient) {
		this.jdbcTemplate = jdbcTemplate;
		this.fplClient = fplClient;
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

	public void delete(CurrentUser user, long id) {
		requireAdmin(user);
		if (jdbcTemplate.update("delete from broadcast_schedule where id = ?", id) == 0) {
			throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Broadcast schedule was not found.");
		}
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

	@Transactional
	public List<BroadcastSchedule> generateForToday(CurrentUser user) {
		requireAdmin(user);
		return generateFor(LocalDate.now(SCHEDULE_ZONE), true);
	}

	@Transactional
	public List<BroadcastSchedule> generateForToday() {
		return generateFor(LocalDate.now(SCHEDULE_ZONE), false);
	}

	private List<BroadcastSchedule> generateFor(LocalDate date, boolean replaceAllSchedules) {
		var dayStart = date.atStartOfDay(SCHEDULE_ZONE).toInstant();
		var nextDayStart = date.plusDays(1).atStartOfDay(SCHEDULE_ZONE).toInstant();
		var windows = new ArrayList<ScheduleWindow>();
		for (var fixture : fplClient.getFantasyFixtures()) {
			if (fixture.path("finished").asBoolean(false)) continue;
			var kickoffText = fixture.path("kickoff_time").asString("");
			if (kickoffText.isBlank()) continue;
			var kickoff = Instant.parse(kickoffText);
			if (!ZonedDateTime.ofInstant(kickoff, SCHEDULE_ZONE).toLocalDate().equals(date)) continue;
			windows.add(new ScheduleWindow(kickoff.minus(PRE_MATCH), kickoff.plus(BROADCAST_LENGTH)));
		}
		windows.sort(java.util.Comparator.comparing(ScheduleWindow::startsAt));
		var merged = merge(windows);
		var deleteSql = replaceAllSchedules
				? "delete from broadcast_schedule where starts_at >= ? and starts_at < ?"
				: "delete from broadcast_schedule where auto_generated = true and starts_at >= ? and starts_at < ?";
		jdbcTemplate.update(deleteSql, Timestamp.from(dayStart.minus(PRE_MATCH)), Timestamp.from(nextDayStart.minus(PRE_MATCH)));
		for (var window : merged) jdbcTemplate.update("insert into broadcast_schedule (starts_at, ends_at, auto_generated) values (?, ?, true)", Timestamp.from(window.startsAt()), Timestamp.from(window.endsAt()));
		return jdbcTemplate.query("select id, starts_at, ends_at from broadcast_schedule where auto_generated = true and starts_at >= ? and starts_at < ? order by starts_at", this::mapSchedule,
				Timestamp.from(dayStart.minus(PRE_MATCH)), Timestamp.from(nextDayStart.minus(PRE_MATCH)));
	}

	private List<ScheduleWindow> merge(List<ScheduleWindow> windows) {
		var merged = new ArrayList<ScheduleWindow>();
		for (var window : windows) {
			if (merged.isEmpty()) { merged.add(window); continue; }
			var previous = merged.getLast();
			if (!window.startsAt().isAfter(previous.endsAt().plus(MERGE_GAP))) {
				merged.set(merged.size() - 1, new ScheduleWindow(previous.startsAt(), previous.endsAt().isAfter(window.endsAt()) ? previous.endsAt() : window.endsAt()));
			}
			else merged.add(window);
		}
		return merged;
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
	private record ScheduleWindow(Instant startsAt, Instant endsAt) { }
}
