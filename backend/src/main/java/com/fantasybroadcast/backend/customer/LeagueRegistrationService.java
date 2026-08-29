package com.fantasybroadcast.backend.customer;

import com.fantasybroadcast.backend.fpl.FplDraftClient;
import com.fantasybroadcast.backend.fpl.FplDraftClientException;
import com.fantasybroadcast.backend.fpl.FplLeagueType;
import com.fantasybroadcast.backend.fpl.FplLeagueScoring;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import org.springframework.context.annotation.Profile;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import com.fantasybroadcast.backend.security.BroadcastSecurityProperties;

@Service
@Profile("db & !test")
public class LeagueRegistrationService {
	private static final int MAX_TRACKED_PLAYERS = 200;
	private static final String LEAGUE_COLUMNS = "id, fpl_league_id, display_name, league_type, scoring_type, service_enabled, ai_narration_enabled, voice_narration_enabled, owner_user_id";

	private final JdbcTemplate jdbcTemplate;
	private final FplDraftClient fplClient;
	private final BroadcastSecurityProperties securityProperties;

	public LeagueRegistrationService(JdbcTemplate jdbcTemplate, FplDraftClient fplClient, BroadcastSecurityProperties securityProperties) {
		this.jdbcTemplate = jdbcTemplate;
		this.fplClient = fplClient;
		this.securityProperties = securityProperties;
	}

	public RegisteredLeague register(CurrentUser user, long fplLeagueId, FplLeagueType leagueType) {
		if (!user.admin() && !securityProperties.isLeagueRegistrationEnabled()) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "League registration is closed for this test.");
		}
		if (fplLeagueId <= 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "League ID must be positive.");
		var league = findLeague(fplLeagueId, leagueType);
		if (league == null) {
			var sourceLeague = resolveLeague(fplLeagueId, leagueType);
			validateTrackedPlayerCount(sourceLeague);
			try {
				jdbcTemplate.update("insert into league (fpl_league_id, display_name, owner_user_id, league_type, scoring_type) values (?, ?, ?, ?, ?)",
						fplLeagueId, sourceLeague.displayName(), user.id(), leagueType.name(), sourceLeague.scoringType().name());
			}
			catch (DuplicateKeyException exception) {
				// Another registration may have created the same source league while we were validating it.
			}
			league = findLeague(fplLeagueId, leagueType);
			if (league == null) throw new ResponseStatusException(HttpStatus.CONFLICT, "This league could not be registered. Please try again.");
		}
		jdbcTemplate.update("insert ignore into league_registration (user_id, league_id) values (?, ?)", user.id(), league.id());
		return league;
	}

	public List<RegisteredLeague> forUser(CurrentUser user) {
		if (user.admin()) {
			return jdbcTemplate.query("select " + LEAGUE_COLUMNS + " from league order by created_at desc, id desc", this::mapLeague);
		}
		return jdbcTemplate.query("""
				select l.id, l.fpl_league_id, l.display_name, l.league_type, l.scoring_type, l.service_enabled, l.ai_narration_enabled, l.voice_narration_enabled, l.owner_user_id
				from league l join league_registration r on r.league_id = l.id
				where r.user_id = ? order by r.created_at desc
				""", this::mapLeague, user.id());
	}

	public AdminLeaguePage allForAdmin(CurrentUser user, int page, int size, String search) {
		if (!user.admin()) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Administrator access is required.");
		var searchTerm = search == null ? "" : search.trim();
		var total = jdbcTemplate.queryForObject("select count(*) from league where lower(display_name) like concat('%', lower(?), '%') or cast(fpl_league_id as char) like concat('%', ?, '%')", Long.class, searchTerm, searchTerm);
		var leagues = jdbcTemplate.query("""
				select l.id, l.fpl_league_id, l.display_name, l.league_type, l.scoring_type, l.service_enabled, l.ai_narration_enabled, l.voice_narration_enabled, owner.email as owner_email,
				       group_concat(member.email order by member.email separator ', ') as registered_users, l.created_at
				from (
					select id, fpl_league_id, display_name, league_type, scoring_type, service_enabled, ai_narration_enabled, voice_narration_enabled, owner_user_id, created_at
					from league
					where lower(display_name) like concat('%', lower(?), '%') or cast(fpl_league_id as char) like concat('%', ?, '%')
					order by created_at desc, id desc limit ? offset ?
				) l
				left join app_user owner on owner.id = l.owner_user_id
				left join league_registration r on r.league_id = l.id
				left join app_user member on member.id = r.user_id
				group by l.id, l.fpl_league_id, l.display_name, l.league_type, l.scoring_type, l.service_enabled, l.ai_narration_enabled, l.voice_narration_enabled, owner.email, l.created_at
				order by l.created_at desc, l.id desc
				""", this::mapAdminLeague, searchTerm, searchTerm, size, (long) page * size);
		return new AdminLeaguePage(leagues, page, size, total == null ? 0 : total);
	}

	public List<RegisteredLeague> searchRegistered(String query) {
		var searchTerm = query == null ? "" : query.trim();
		if (searchTerm.isEmpty()) return List.of();
		return jdbcTemplate.query("""
				select id, fpl_league_id, display_name, league_type, scoring_type, service_enabled, ai_narration_enabled, voice_narration_enabled, owner_user_id
				from league
				where service_enabled = true and (lower(display_name) like concat('%', lower(?), '%') or cast(fpl_league_id as char) like concat('%', ?, '%'))
				order by display_name, id limit 20
				""", this::mapLeague, searchTerm, searchTerm);
	}

	public RegisteredLeague follow(CurrentUser user, long leagueId) {
		var leagues = jdbcTemplate.query("select " + LEAGUE_COLUMNS + " from league where id = ? and service_enabled = true",
				this::mapLeague, leagueId);
		if (leagues.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "The registered league was not found.");
		jdbcTemplate.update("insert ignore into league_registration (user_id, league_id) values (?, ?)", user.id(), leagueId);
		return leagues.getFirst();
	}

	@Transactional
	public void deleteOwned(CurrentUser user, long leagueId) {
		var deletedRegistrations = jdbcTemplate.update("delete r from league_registration r join league l on l.id = r.league_id where l.id = ? and l.owner_user_id = ?", leagueId, user.id());
		var deletedLeague = jdbcTemplate.update("delete from league where id = ? and owner_user_id = ?", leagueId, user.id());
		if (deletedLeague == 0) {
			if (deletedRegistrations > 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "The league could not be deleted. Please try again.");
			throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Your league was not found.");
		}
	}

	public RegisteredLeague accessibleLeague(CurrentUser user, long leagueId) {
		var leagues = user.admin()
				? jdbcTemplate.query("select " + LEAGUE_COLUMNS + " from league where id = ?", this::mapLeague, leagueId)
				: jdbcTemplate.query("select l.id, l.fpl_league_id, l.display_name, l.league_type, l.scoring_type, l.service_enabled, l.ai_narration_enabled, l.voice_narration_enabled, l.owner_user_id from league l join league_registration r on r.league_id = l.id where r.user_id = ? and l.id = ?", this::mapLeague, user.id(), leagueId);
		if (leagues.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "League was not found.");
		return leagues.getFirst();
	}

	public AdminLeague updateForAdmin(CurrentUser user, long id, boolean serviceEnabled, boolean aiNarrationEnabled,
			boolean voiceNarrationEnabled) {
		if (!user.admin()) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Administrator access is required.");
		var effectiveVoiceNarrationEnabled = aiNarrationEnabled && voiceNarrationEnabled;
		var updated = jdbcTemplate.update("""
				update league
				set service_enabled = ?, ai_narration_enabled = ?, voice_narration_enabled = ?, updated_at = current_timestamp
				where id = ?
				""", serviceEnabled, aiNarrationEnabled, effectiveVoiceNarrationEnabled, id);
		if (updated == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "League was not found.");
		return adminLeague(id);
	}

	private AdminLeague adminLeague(long id) {
		var leagues = jdbcTemplate.query("""
				select l.id, l.fpl_league_id, l.display_name, l.league_type, l.scoring_type, l.service_enabled, l.ai_narration_enabled, l.voice_narration_enabled, owner.email as owner_email,
				       group_concat(member.email order by member.email separator ', ') as registered_users, l.created_at
				from league l
				left join app_user owner on owner.id = l.owner_user_id
				left join league_registration r on r.league_id = l.id
				left join app_user member on member.id = r.user_id
				where l.id = ?
				group by l.id, l.fpl_league_id, l.display_name, l.league_type, l.scoring_type, l.service_enabled, l.ai_narration_enabled, l.voice_narration_enabled, owner.email, l.created_at
				""", this::mapAdminLeague, id);
		return leagues.getFirst();
	}

	public FplLeagueScoring detectScoring(long fplLeagueId, FplLeagueType leagueType) {
		return resolveLeague(fplLeagueId, leagueType).scoringType();
	}

	private SourceLeague resolveLeague(long fplLeagueId, FplLeagueType leagueType) {
		if (leagueType == FplLeagueType.DRAFT) {
			var root = fplClient.getLeagueDetails(fplLeagueId);
			var trackedPlayerCount = 0;
			for (var status : fplClient.getLeagueElementStatus(fplLeagueId).path("element_status")) {
				if (status.path("owner").isValueNode() && !status.path("owner").isNull()) trackedPlayerCount++;
			}
			return new SourceLeague(leagueName(root), scoringFrom(root), trackedPlayerCount);
		}
		try {
			var root = fplClient.getClassicLeagueStandings(fplLeagueId);
			return classicSourceLeague(root, scoringFrom(root));
		}
		catch (FplDraftClientException exception) {
			if (exception.getStatusCode() != null && exception.getStatusCode() != 404) throw exception;
			var root = fplClient.getClassicPointsLeagueStandings(fplLeagueId);
			return classicSourceLeague(root, FplLeagueScoring.TOTAL_POINTS);
		}
	}

	private SourceLeague classicSourceLeague(tools.jackson.databind.JsonNode root, FplLeagueScoring scoringType) {
		var standings = root.path("standings");
		var entryCount = 0;
		for (var ignored : standings.path("results")) entryCount++;
		// FPL returns standings in pages of 50. A second page is already well above our 200-player limit.
		if (standings.path("has_next").asBoolean(false)) entryCount = (MAX_TRACKED_PLAYERS / 15) + 1;
		return new SourceLeague(leagueName(root), scoringType, entryCount * 15);
	}

	private void validateTrackedPlayerCount(SourceLeague sourceLeague) {
		if (sourceLeague.trackedPlayerCount() > MAX_TRACKED_PLAYERS) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
					"This league has " + sourceLeague.trackedPlayerCount() + " tracked players; the maximum is " + MAX_TRACKED_PLAYERS + ".");
		}
	}

	private String leagueName(tools.jackson.databind.JsonNode root) {
		var name = root.path("league").path("name").asString("").trim();
		if (name.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "FPL did not return a league name.");
		return name;
	}

	private FplLeagueScoring scoringFrom(tools.jackson.databind.JsonNode root) {
		return switch (root.path("league").path("scoring").asString("").trim().toLowerCase()) {
			case "h", "h2h", "head-to-head" -> FplLeagueScoring.H2H;
			case "c", "classic", "total_points", "total-points" -> FplLeagueScoring.TOTAL_POINTS;
			default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "FPL did not return a recognised league scoring type.");
		};
	}

	private RegisteredLeague findLeague(long fplLeagueId, FplLeagueType leagueType) {
		var leagues = jdbcTemplate.query("select " + LEAGUE_COLUMNS + " from league where fpl_league_id = ? and league_type = ?",
				this::mapLeague, fplLeagueId, leagueType.name());
		return leagues.isEmpty() ? null : leagues.getFirst();
	}

	private RegisteredLeague mapLeague(ResultSet resultSet, int rowNumber) throws SQLException {
		return new RegisteredLeague(resultSet.getLong("id"), resultSet.getLong("fpl_league_id"), resultSet.getString("display_name"),
				FplLeagueType.valueOf(resultSet.getString("league_type")), FplLeagueScoring.valueOf(resultSet.getString("scoring_type")),
				resultSet.getBoolean("service_enabled"), resultSet.getBoolean("ai_narration_enabled"),
				resultSet.getBoolean("voice_narration_enabled"), resultSet.getLong("owner_user_id"));
	}

	private AdminLeague mapAdminLeague(ResultSet resultSet, int rowNumber) throws SQLException {
		return new AdminLeague(resultSet.getLong("id"), resultSet.getLong("fpl_league_id"), resultSet.getString("display_name"),
				FplLeagueType.valueOf(resultSet.getString("league_type")), FplLeagueScoring.valueOf(resultSet.getString("scoring_type")),
				resultSet.getBoolean("service_enabled"), resultSet.getBoolean("ai_narration_enabled"),
				resultSet.getBoolean("voice_narration_enabled"), resultSet.getString("owner_email"),
				resultSet.getString("registered_users"), resultSet.getTimestamp("created_at").toInstant().toString());
	}

	public record RegisteredLeague(long id, long fplLeagueId, String displayName, FplLeagueType leagueType, FplLeagueScoring scoringType,
			boolean serviceEnabled, boolean aiNarrationEnabled, boolean voiceNarrationEnabled, long ownerUserId) {
	}

	public record AdminLeague(long id, long fplLeagueId, String displayName, FplLeagueType leagueType, FplLeagueScoring scoringType, boolean serviceEnabled,
			boolean aiNarrationEnabled, boolean voiceNarrationEnabled, String ownerEmail, String registeredUsers, String createdAt) {
	}

	public record AdminLeaguePage(List<AdminLeague> items, int page, int size, long totalItems) {
	}

	private record SourceLeague(String displayName, FplLeagueScoring scoringType, int trackedPlayerCount) {
	}
}
