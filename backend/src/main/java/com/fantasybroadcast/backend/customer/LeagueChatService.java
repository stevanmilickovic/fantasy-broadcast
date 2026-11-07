package com.fantasybroadcast.backend.customer;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Profile("db & !test")
public class LeagueChatService {
	private static final Duration RETENTION = Duration.ofHours(24);
	private static final int PAGE_SIZE = 50;
	private static final String MESSAGE_SELECT = "select m.id, m.league_id, m.user_id, m.send_id, m.body, m.created_at, u.display_name from league_chat_message m join app_user u on u.id = m.user_id";
	private final JdbcTemplate jdbc;
	private final LeagueRegistrationService leagues;
	private final Clock clock;
	@Autowired
	public LeagueChatService(JdbcTemplate jdbc, LeagueRegistrationService leagues) { this(jdbc, leagues, Clock.systemUTC()); }
	LeagueChatService(JdbcTemplate jdbc, LeagueRegistrationService leagues, Clock clock) {
		this.jdbc = jdbc; this.leagues = leagues; this.clock = clock;
	}

	public MessagePage messages(CurrentUser user, long leagueId, Long before, Long after) {
		leagues.accessibleLeague(user, leagueId);
		if (before != null && after != null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Use either an older or newer message cursor.");
		var now = clock.instant();
		var args = new ArrayList<Object>();
		args.add(leagueId); args.add(Timestamp.from(now.minus(RETENTION)));
		var cursor = before == null ? after : before;
		if (cursor != null) args.add(cursor);
		var rows = new ArrayList<>(jdbc.query(MESSAGE_SELECT + " where m.league_id = ? and m.created_at > ?"
				+ (cursor == null ? "" : before != null ? " and m.id < ?" : " and m.id > ?")
				+ " order by m.id " + (after == null ? "desc" : "asc") + " limit " + (PAGE_SIZE + 1), this::mapMessage, args.toArray()));
		var more = rows.size() > PAGE_SIZE;
		if (more) rows.removeLast();
		if (after == null) Collections.reverse(rows);
		return new MessagePage(rows, after == null && more, after != null && more, now.toString());
	}

	@Transactional
	public Message send(CurrentUser user, long leagueId, String body, String sendId) {
		var text = body == null ? "" : body.strip();
		if (text.isBlank() || text.length() > 1000 || text.codePoints().anyMatch(c -> Character.isISOControl(c) && c != '\n' && c != '\t'))
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Message must contain 1–1,000 text characters.");
		try { if (!UUID.fromString(sendId).toString().equalsIgnoreCase(sendId)) throw new IllegalArgumentException(); }
		catch (IllegalArgumentException | NullPointerException invalid) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A valid message send ID is required."); }
		// Serialize league sends so committed message IDs remain safe polling cursors.
		jdbc.queryForList("select id from league where id = ? for update", leagueId);
		leagues.accessibleLeague(user, leagueId);
		jdbc.queryForList("select id from app_user where id = ? for update", user.id());
		var existing = jdbc.query(MESSAGE_SELECT + " where m.user_id = ? and m.send_id = ?", this::mapMessage, user.id(), sendId);
		if (!existing.isEmpty()) {
			var message = existing.getFirst();
			if (message.leagueId() != leagueId || !message.body().equals(text) || !java.time.Instant.parse(message.expiresAt()).isAfter(clock.instant()))
				throw new ResponseStatusException(HttpStatus.CONFLICT, "This send ID belongs to another or expired message.");
			return message;
		}
		var now = clock.instant();
		var burst = jdbc.queryForObject("select count(*) from league_chat_message where user_id = ? and created_at > ?", Integer.class, user.id(), Timestamp.from(now.minusSeconds(10)));
		var minute = jdbc.queryForObject("select count(*) from league_chat_message where user_id = ? and created_at > ?", Integer.class, user.id(), Timestamp.from(now.minusSeconds(60)));
		if (burst >= 5 || minute >= 20) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Please wait before sending more messages.");
		jdbc.update("insert into league_chat_message (league_id, user_id, send_id, body, created_at) values (?, ?, ?, ?, ?)", leagueId, user.id(), sendId, text, Timestamp.from(now));
		return jdbc.query(MESSAGE_SELECT + " where m.user_id = ? and m.send_id = ?", this::mapMessage, user.id(), sendId).getFirst();
	}

	@Scheduled(fixedDelay = 60_000)
	public void deleteExpired() {
		jdbc.update("delete from league_chat_message where created_at <= ? limit 5000", Timestamp.from(clock.instant().minus(RETENTION)));
	}

	private Message mapMessage(ResultSet rs, int row) throws SQLException {
		var created = rs.getTimestamp("created_at").toInstant();
		return new Message(Long.toString(rs.getLong("id")), rs.getLong("league_id"), rs.getLong("user_id"), rs.getString("display_name"),
				rs.getString("body"), created.toString(), created.plus(RETENTION).toString());
	}
	public record Message(String id, long leagueId, long userId, String displayName, String body, String createdAt, String expiresAt) { }
	public record MessagePage(List<Message> messages, boolean hasOlder, boolean hasMore, String serverTime) { }
}
