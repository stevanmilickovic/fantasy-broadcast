package com.fantasybroadcast.backend.customer;

import java.util.List;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Profile("db & !test")
public class LeagueMembershipService {
	private final JdbcTemplate jdbc;
	public LeagueMembershipService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

	private void lockLeague(long leagueId) {
		if (jdbc.queryForList("select id from league where id = ? for update", leagueId).isEmpty())
			throw new ResponseStatusException(HttpStatus.NOT_FOUND, "League was not found.");
	}

	public void requireOwner(CurrentUser user, long leagueId) {
		var owners = jdbc.queryForList("select owner_user_id from league where id = ?", Long.class, leagueId);
		if (owners.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "League was not found.");
		if (owners.getFirst() != user.id() && !user.admin())
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the league owner can manage followers.");
	}

	@Transactional
	public void setPrivacy(CurrentUser user, long leagueId, boolean privateLeague) {
		lockLeague(leagueId);
		requireOwner(user, leagueId);
		jdbc.update("update league set private_league = ?, updated_at = current_timestamp where id = ?", privateLeague, leagueId);
		if (!privateLeague) {
			jdbc.update("insert ignore into league_registration (user_id, league_id) select user_id, league_id from league_follow_request where league_id = ? and status = 'PENDING'", leagueId);
			jdbc.update("delete from league_follow_request where league_id = ? and status = 'PENDING'", leagueId);
		}
	}

	public List<FollowRequest> requests(CurrentUser user, Long leagueId) {
		if (leagueId != null) requireOwner(user, leagueId);
		return jdbc.query("""
				select r.user_id, r.league_id, r.status, r.created_at, u.display_name, u.email, l.display_name as league_name
				from league_follow_request r join app_user u on u.id = r.user_id join league l on l.id = r.league_id
				where %s order by r.created_at, r.user_id
				""".formatted(leagueId == null ? "r.user_id = ?" : "r.league_id = ?"), (rs, row) ->
				new FollowRequest(rs.getLong("user_id"), rs.getLong("league_id"), rs.getString("league_name"), rs.getString("display_name"),
						rs.getString("email"), rs.getString("status"), rs.getTimestamp("created_at").toInstant().toString()), leagueId == null ? user.id() : leagueId);
	}

	@Transactional
	public void decide(CurrentUser user, long leagueId, long applicantId, boolean approve) {
		lockLeague(leagueId);
		requireOwner(user, leagueId);
		var count = jdbc.queryForObject("select count(*) from league_follow_request where user_id = ? and league_id = ? and status = 'PENDING'", Integer.class, applicantId, leagueId);
		if (count == 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "This request is no longer pending. Refresh the requests.");
		if (approve) {
			jdbc.update("insert ignore into league_registration (user_id, league_id) values (?, ?)", applicantId, leagueId);
			jdbc.update("delete from league_follow_request where user_id = ? and league_id = ?", applicantId, leagueId);
		} else jdbc.update("update league_follow_request set status = 'REJECTED' where user_id = ? and league_id = ?", applicantId, leagueId);
	}

	@Transactional
	public void cancel(CurrentUser user, long leagueId) {
		lockLeague(leagueId);
		jdbc.update("delete from league_follow_request where user_id = ? and league_id = ?", user.id(), leagueId);
	}

	public record FollowRequest(long userId, long leagueId, String leagueName, String displayName, String email, String status, String createdAt) { }
}
