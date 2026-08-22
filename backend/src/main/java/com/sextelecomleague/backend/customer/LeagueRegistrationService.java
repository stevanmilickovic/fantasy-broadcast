package com.sextelecomleague.backend.customer;

import com.sextelecomleague.backend.fpl.FplDraftClient;
import com.sextelecomleague.backend.fpl.FplLeagueType;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
@Profile("db & !test")
public class LeagueRegistrationService {

	private final JdbcTemplate jdbcTemplate;
	private final FplDraftClient fplClient;

	public LeagueRegistrationService(JdbcTemplate jdbcTemplate, FplDraftClient fplClient) {
		this.jdbcTemplate = jdbcTemplate;
		this.fplClient = fplClient;
	}

	public RegisteredLeague register(CurrentUser user, long fplLeagueId, FplLeagueType leagueType) {
		if (fplLeagueId <= 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "League ID must be positive.");
		var league = findLeague(fplLeagueId, leagueType);
		if (league == null) {
			var displayName = fetchLeagueName(fplLeagueId, leagueType);
			jdbcTemplate.update("insert into league (fpl_league_id, display_name, owner_user_id, league_type) values (?, ?, ?, ?)",
					fplLeagueId, displayName, user.id(), leagueType.name());
			league = findLeague(fplLeagueId, leagueType);
		}
		jdbcTemplate.update("insert ignore into league_registration (user_id, league_id) values (?, ?)", user.id(), league.id());
		return league;
	}

	public List<RegisteredLeague> forUser(CurrentUser user) {
		if (user.admin()) {
			return jdbcTemplate.query("select id, fpl_league_id, display_name, league_type, service_enabled, owner_user_id from league order by created_at desc, id desc", this::mapLeague);
		}
		return jdbcTemplate.query("""
				select l.id, l.fpl_league_id, l.display_name, l.league_type, l.service_enabled, l.owner_user_id
				from league l join league_registration r on r.league_id = l.id
				where r.user_id = ? order by r.created_at desc
				""", this::mapLeague, user.id());
	}

	public AdminLeaguePage allForAdmin(CurrentUser user, int page, int size, String search) {
		if (!user.admin()) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Administrator access is required.");
		var searchTerm = search == null ? "" : search.trim();
		var total = jdbcTemplate.queryForObject("select count(*) from league where lower(display_name) like concat('%', lower(?), '%') or cast(fpl_league_id as char) like concat('%', ?, '%')", Long.class, searchTerm, searchTerm);
		var leagues = jdbcTemplate.query("""
				select l.id, l.fpl_league_id, l.display_name, l.league_type, l.service_enabled, owner.email as owner_email,
				       group_concat(member.email order by member.email separator ', ') as registered_users, l.created_at
				from (
					select id, fpl_league_id, display_name, league_type, service_enabled, owner_user_id, created_at
					from league
					where lower(display_name) like concat('%', lower(?), '%') or cast(fpl_league_id as char) like concat('%', ?, '%')
					order by created_at desc, id desc limit ? offset ?
				) l
				left join app_user owner on owner.id = l.owner_user_id
				left join league_registration r on r.league_id = l.id
				left join app_user member on member.id = r.user_id
				group by l.id, l.fpl_league_id, l.display_name, l.league_type, l.service_enabled, owner.email, l.created_at
				order by l.created_at desc, l.id desc
				""", this::mapAdminLeague, searchTerm, searchTerm, size, (long) page * size);
		return new AdminLeaguePage(leagues, page, size, total == null ? 0 : total);
	}

	public AdminLeague updateForAdmin(CurrentUser user, long id, boolean serviceEnabled) {
		if (!user.admin()) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Administrator access is required.");
		var updated = jdbcTemplate.update("update league set service_enabled = ?, updated_at = current_timestamp where id = ?", serviceEnabled, id);
		if (updated == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "League was not found.");
		return adminLeague(id);
	}

	private AdminLeague adminLeague(long id) {
		var leagues = jdbcTemplate.query("""
				select l.id, l.fpl_league_id, l.display_name, l.league_type, l.service_enabled, owner.email as owner_email,
				       group_concat(member.email order by member.email separator ', ') as registered_users, l.created_at
				from league l
				left join app_user owner on owner.id = l.owner_user_id
				left join league_registration r on r.league_id = l.id
				left join app_user member on member.id = r.user_id
				where l.id = ?
				group by l.id, l.fpl_league_id, l.display_name, l.league_type, l.service_enabled, owner.email, l.created_at
				""", this::mapAdminLeague, id);
		return leagues.getFirst();
	}

	private String fetchLeagueName(long fplLeagueId, FplLeagueType leagueType) {
		var root = leagueType == FplLeagueType.DRAFT
				? fplClient.getLeagueDetails(fplLeagueId)
				: fplClient.getClassicLeagueStandings(fplLeagueId);
		var name = root.path("league").path("name").asString("").trim();
		if (name.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "FPL did not return a league name.");
		return name;
	}

	private RegisteredLeague findLeague(long fplLeagueId, FplLeagueType leagueType) {
		var leagues = jdbcTemplate.query("select id, fpl_league_id, display_name, league_type, service_enabled, owner_user_id from league where fpl_league_id = ? and league_type = ?",
				this::mapLeague, fplLeagueId, leagueType.name());
		return leagues.isEmpty() ? null : leagues.getFirst();
	}

	private RegisteredLeague mapLeague(ResultSet resultSet, int rowNumber) throws SQLException {
		return new RegisteredLeague(resultSet.getLong("id"), resultSet.getLong("fpl_league_id"), resultSet.getString("display_name"),
				FplLeagueType.valueOf(resultSet.getString("league_type")), resultSet.getBoolean("service_enabled"), resultSet.getLong("owner_user_id"));
	}

	private AdminLeague mapAdminLeague(ResultSet resultSet, int rowNumber) throws SQLException {
		return new AdminLeague(resultSet.getLong("id"), resultSet.getLong("fpl_league_id"), resultSet.getString("display_name"),
				FplLeagueType.valueOf(resultSet.getString("league_type")), resultSet.getBoolean("service_enabled"), resultSet.getString("owner_email"), resultSet.getString("registered_users"), resultSet.getTimestamp("created_at").toInstant().toString());
	}

	public record RegisteredLeague(long id, long fplLeagueId, String displayName, FplLeagueType leagueType,
			boolean serviceEnabled, long ownerUserId) {
	}

	public record AdminLeague(long id, long fplLeagueId, String displayName, FplLeagueType leagueType, boolean serviceEnabled,
			String ownerEmail, String registeredUsers, String createdAt) {
	}

	public record AdminLeaguePage(List<AdminLeague> items, int page, int size, long totalItems) {
	}
}
