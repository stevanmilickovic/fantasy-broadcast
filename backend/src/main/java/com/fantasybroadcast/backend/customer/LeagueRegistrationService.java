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
	private static final int MAX_MANAGERS = 50;
	private static final String LEAGUE_COLUMNS = "id, fpl_league_id, display_name, league_type, scoring_type, service_enabled, ai_narration_enabled, voice_narration_enabled, private_league, owner_user_id";

	private final JdbcTemplate jdbcTemplate;
	private final FplDraftClient fplClient;
	private final BroadcastSecurityProperties securityProperties;

	public LeagueRegistrationService(JdbcTemplate jdbcTemplate, FplDraftClient fplClient, BroadcastSecurityProperties securityProperties) {
		this.jdbcTemplate = jdbcTemplate;
		this.fplClient = fplClient;
		this.securityProperties = securityProperties;
	}

	public RegisteredLeague register(CurrentUser user, long fplLeagueId, FplLeagueType leagueType) {
		requireRegistrationAllowed(user);
		if (!user.admin()) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Use paid checkout to register a league.");
		return registerLeague(user, fplLeagueId, leagueType);
	}

	public void requireRegistrationAllowed(CurrentUser user) {
		if (!securityProperties.canRegisterLeague(user)) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "League registration is closed for this test.");
		}
	}

	public void requirePurchasingOwner(CurrentUser user, long fplLeagueId, FplLeagueType leagueType) {
		var league = findLeague(fplLeagueId, leagueType);
		if (league != null && league.ownerUserId() != user.id())
			throw new ResponseStatusException(HttpStatus.CONFLICT, "This league already has a purchasing owner. Follow the registered league instead, or contact support.");
	}

	private RegisteredLeague registerLeague(CurrentUser user, long fplLeagueId, FplLeagueType leagueType) {
		if (fplLeagueId <= 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "League ID must be positive.");
		var league = findLeague(fplLeagueId, leagueType);
		if (league == null) {
			var sourceLeague = resolveLeague(fplLeagueId, leagueType);
			validateTrackedPlayerCount(sourceLeague);
			try {
				jdbcTemplate.update("insert into league (fpl_league_id, display_name, owner_user_id, league_type, scoring_type, private_league) values (?, ?, ?, ?, ?, true)",
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
				select l.id, l.fpl_league_id, l.display_name, l.league_type, l.scoring_type, l.service_enabled, l.ai_narration_enabled, l.voice_narration_enabled, l.private_league, l.owner_user_id
				from league l left join league_registration r on r.league_id = l.id and r.user_id = ?
				where r.user_id is not null or l.owner_user_id = ? order by l.created_at desc
				""", this::mapLeague, user.id(), user.id());
	}

	public AdminLeaguePage allForAdmin(CurrentUser user, int page, int size, String search) {
		if (!user.admin()) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Administrator access is required.");
		var searchTerm = search == null ? "" : search.trim();
		var total = jdbcTemplate.queryForObject("select count(*) from league where lower(display_name) like concat('%', lower(?), '%') or cast(fpl_league_id as char) like concat('%', ?, '%')", Long.class, searchTerm, searchTerm);
		var leagues = jdbcTemplate.query("""
				select l.id, l.fpl_league_id, l.display_name, l.league_type, l.scoring_type, l.service_enabled, l.ai_narration_enabled, l.voice_narration_enabled, concat(owner.display_name, ' (#', owner.id, ')') as owner_name,
				       group_concat(concat(member.display_name, ' (#', member.id, ')') order by member.id separator ', ') as registered_users, l.created_at
				from (
					select id, fpl_league_id, display_name, league_type, scoring_type, service_enabled, ai_narration_enabled, voice_narration_enabled, private_league, owner_user_id, created_at
					from league
					where lower(display_name) like concat('%', lower(?), '%') or cast(fpl_league_id as char) like concat('%', ?, '%')
					order by created_at desc, id desc limit ? offset ?
				) l
				left join app_user owner on owner.id = l.owner_user_id
				left join league_registration r on r.league_id = l.id
				left join app_user member on member.id = r.user_id
				group by l.id, l.fpl_league_id, l.display_name, l.league_type, l.scoring_type, l.service_enabled, l.ai_narration_enabled, l.voice_narration_enabled, owner.display_name, owner.id, l.created_at
				order by l.created_at desc, l.id desc
				""", this::mapAdminLeague, searchTerm, searchTerm, size, (long) page * size);
		return new AdminLeaguePage(leagues, page, size, total == null ? 0 : total);
	}

	public RegisteredLeaguePage searchRegistered(String query, int page, int size) {
		var searchTerm = query == null ? "" : query.trim();
		var filter = "from league where service_enabled = true and (lower(display_name) like concat('%', lower(?), '%') or cast(fpl_league_id as char(32)) like concat('%', ?, '%'))";
		var total = jdbcTemplate.queryForObject("select count(*) " + filter, Long.class, searchTerm, searchTerm);
		var items = jdbcTemplate.query("select " + LEAGUE_COLUMNS + " " + filter + " order by created_at desc, id desc limit ? offset ?",
				this::mapLeague, searchTerm, searchTerm, size, (long) page * size);
		return new RegisteredLeaguePage(items, page, size, total == null ? 0 : total);
	}

	public record RegisteredLeaguePage(List<RegisteredLeague> items, int page, int size, long totalItems) { }

	@Transactional
	public FollowResult follow(CurrentUser user, long leagueId) {
		var leagues = jdbcTemplate.query("select " + LEAGUE_COLUMNS + " from league where id = ? and service_enabled = true for update", this::mapLeague, leagueId);
		if (leagues.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "The registered league was not found.");
		var league = leagues.getFirst();
		var member = jdbcTemplate.queryForObject("select count(*) from league_registration where user_id = ? and league_id = ?", Integer.class, user.id(), leagueId);
		if (league.privateLeague() && league.ownerUserId() != user.id() && !user.admin() && member == 0) {
			jdbcTemplate.update("delete from league_follow_request where user_id = ? and league_id = ? and status = 'REJECTED'", user.id(), leagueId);
			jdbcTemplate.update("insert ignore into league_follow_request (user_id, league_id, status) values (?, ?, 'PENDING')", user.id(), leagueId);
			return new FollowResult(league, "PENDING");
		}
		jdbcTemplate.update("insert ignore into league_registration (user_id, league_id) values (?, ?)", user.id(), leagueId);
		jdbcTemplate.update("delete from league_follow_request where user_id = ? and league_id = ?", user.id(), leagueId);
		return new FollowResult(league, "APPROVED");
	}

	public record FollowResult(RegisteredLeague league, String status) { }

	public void unfollow(CurrentUser user, long leagueId) {
		var league = accessibleLeague(user, leagueId);
		if (league.ownerUserId() == user.id()) throw new ResponseStatusException(HttpStatus.CONFLICT, "The purchasing owner must manage the subscription instead.");
		jdbcTemplate.update("delete from league_registration where user_id = ? and league_id = ?", user.id(), leagueId);
	}

	public RegisteredLeague accessibleLeague(CurrentUser user, long leagueId) {
		var leagues = user.admin()
				? jdbcTemplate.query("select " + LEAGUE_COLUMNS + " from league where id = ?", this::mapLeague, leagueId)
				: jdbcTemplate.query("select l.id, l.fpl_league_id, l.display_name, l.league_type, l.scoring_type, l.service_enabled, l.ai_narration_enabled, l.voice_narration_enabled, l.private_league, l.owner_user_id from league l where (l.owner_user_id = ? or exists (select 1 from league_registration r where r.league_id = l.id and r.user_id = ?)) and l.id = ?", this::mapLeague, user.id(), user.id(), leagueId);
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
				select l.id, l.fpl_league_id, l.display_name, l.league_type, l.scoring_type, l.service_enabled, l.ai_narration_enabled, l.voice_narration_enabled, concat(owner.display_name, ' (#', owner.id, ')') as owner_name,
				       group_concat(concat(member.display_name, ' (#', member.id, ')') order by member.id separator ', ') as registered_users, l.created_at
				from league l
				left join app_user owner on owner.id = l.owner_user_id
				left join league_registration r on r.league_id = l.id
				left join app_user member on member.id = r.user_id
				where l.id = ?
				group by l.id, l.fpl_league_id, l.display_name, l.league_type, l.scoring_type, l.service_enabled, l.ai_narration_enabled, l.voice_narration_enabled, owner.display_name, owner.id, l.created_at
				""", this::mapAdminLeague, id);
		return leagues.getFirst();
	}

	public FplLeagueScoring detectScoring(long fplLeagueId, FplLeagueType leagueType) {
		return resolveLeague(fplLeagueId, leagueType).scoringType();
	}

	@Transactional
	public RegisteredLeague registerPurchase(long userId, long fplLeagueId, FplLeagueType leagueType) {
		var existing = findLeague(fplLeagueId, leagueType);
		if (existing != null && existing.ownerUserId() != userId)
			throw new ResponseStatusException(HttpStatus.CONFLICT, "This league already belongs to another purchaser. Contact support.");
		var users = jdbcTemplate.query("select id, email, display_name, role from app_user where id = ?", (resultSet, rowNumber) ->
				new CurrentUser(resultSet.getLong("id"), resultSet.getString("email"), resultSet.getString("display_name"), UserRole.valueOf(resultSet.getString("role"))), userId);
		if (users.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "The purchasing user was not found.");
		// A verified paid purchase must still be fulfilled if registration closed after checkout.
		var league = registerLeague(users.getFirst(), fplLeagueId, leagueType);
		if (existing == null) jdbcTemplate.update("update league set service_enabled = false where id = ?", league.id());
		return findLeague(fplLeagueId, leagueType);
	}

	public LeaguePreview preview(long fplLeagueId, FplLeagueType leagueType) {
		var source = resolveLeague(fplLeagueId, leagueType);
		var validationMessage = source.mockLeague()
				? "Mock leagues cannot be registered. Enter an active FPL league ID instead."
				: source.managerCount() > MAX_MANAGERS
						? "This league has " + source.managerCount() + " managers; the maximum is " + MAX_MANAGERS + "."
						: null;
		return new LeaguePreview(source.displayName(), source.managerCount(), validationMessage);
	}

	private SourceLeague resolveLeague(long fplLeagueId, FplLeagueType leagueType) {
		if (leagueType == FplLeagueType.DRAFT) {
			var root = fplClient.getLeagueDetails(fplLeagueId);
			var managerCount = 0;
			for (var ignored : root.path("league_entries")) managerCount++;
			return new SourceLeague(leagueName(root), scoringFrom(root), managerCount, managerCount,
					root.path("league").path("scoring").asString("").trim().equalsIgnoreCase("m"));
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
		var entryCount = entriesOnPage(standings);
		if (standings.path("has_next").asBoolean(false)) entryCount++;
		return new SourceLeague(leagueName(root), scoringType, entryCount, entryCount, false);
	}

	private int entriesOnPage(tools.jackson.databind.JsonNode standings) {
		var count = 0;
		for (var ignored : standings.path("results")) count++;
		return count;
	}

	private void validateTrackedPlayerCount(SourceLeague sourceLeague) {
		if (sourceLeague.mockLeague()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mock leagues cannot be registered.");
		}
		if (sourceLeague.managerCount() > MAX_MANAGERS) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
					"This league has " + sourceLeague.managerCount() + " managers; the maximum is " + MAX_MANAGERS + ".");
		}
	}

	private String leagueName(tools.jackson.databind.JsonNode root) {
		var name = root.path("league").path("name").asString("").trim();
		if (name.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "FPL did not return a league name.");
		return name;
	}

	private FplLeagueScoring scoringFrom(tools.jackson.databind.JsonNode root) {
		return switch (root.path("league").path("scoring").asString("").trim().toLowerCase()) {
			case "h", "h2h", "head-to-head", "m" -> FplLeagueScoring.H2H;
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
				resultSet.getBoolean("voice_narration_enabled"), resultSet.getLong("owner_user_id"), resultSet.getBoolean("private_league"));
	}

	private AdminLeague mapAdminLeague(ResultSet resultSet, int rowNumber) throws SQLException {
		return new AdminLeague(resultSet.getLong("id"), resultSet.getLong("fpl_league_id"), resultSet.getString("display_name"),
				FplLeagueType.valueOf(resultSet.getString("league_type")), FplLeagueScoring.valueOf(resultSet.getString("scoring_type")),
				resultSet.getBoolean("service_enabled"), resultSet.getBoolean("ai_narration_enabled"),
				resultSet.getBoolean("voice_narration_enabled"), resultSet.getString("owner_name"),
				resultSet.getString("registered_users"), resultSet.getTimestamp("created_at").toInstant().toString());
	}

	public record RegisteredLeague(long id, long fplLeagueId, String displayName, FplLeagueType leagueType, FplLeagueScoring scoringType,
			boolean serviceEnabled, boolean aiNarrationEnabled, boolean voiceNarrationEnabled, long ownerUserId, boolean privateLeague) {
	}

	public record AdminLeague(long id, long fplLeagueId, String displayName, FplLeagueType leagueType, FplLeagueScoring scoringType, boolean serviceEnabled,
			boolean aiNarrationEnabled, boolean voiceNarrationEnabled, String ownerName, String registeredUsers, String createdAt) {
	}

	public record AdminLeaguePage(List<AdminLeague> items, int page, int size, long totalItems) {
	}

	public record LeaguePreview(String displayName, int managerCount, String validationMessage) { }
	private record SourceLeague(String displayName, FplLeagueScoring scoringType, int trackedPlayerCount, int managerCount, boolean mockLeague) {
	}
}
