package com.fantasybroadcast.backend.customer;

import com.fantasybroadcast.backend.fpl.FplDraftClient;
import com.fantasybroadcast.backend.fpl.FplDraftMapper;
import com.fantasybroadcast.backend.fpl.FplLeagueScoring;
import com.fantasybroadcast.backend.fpl.FplLeagueType;
import java.io.IOException;
import java.util.List;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
@Profile("db & !test")
public class TeamEmblemService {

	private final JdbcTemplate jdbc;
	private final LeagueRegistrationService leagues;
	private final LeagueMembershipService memberships;
	private final FplDraftClient fpl;
	private final FplDraftMapper mapper;
	private final TeamEmblemProcessor processor;

	public TeamEmblemService(JdbcTemplate jdbc, LeagueRegistrationService leagues, LeagueMembershipService memberships,
			FplDraftClient fpl, FplDraftMapper mapper, TeamEmblemProcessor processor) {
		this.jdbc = jdbc;
		this.leagues = leagues;
		this.memberships = memberships;
		this.fpl = fpl;
		this.mapper = mapper;
		this.processor = processor;
	}

	public List<TeamEmblem> teams(CurrentUser user, long leagueId) {
		var league = leagues.accessibleLeague(user, leagueId);
		var versions = new java.util.HashMap<Long, String>();
		jdbc.query("select entry_id, version from league_team_emblem where league_id = ?", row -> {
			versions.put(row.getLong("entry_id"), row.getString("version"));
		}, leagueId);
		if (league.leagueType() == FplLeagueType.DRAFT) {
			return mapper.mapLeagueDetails(fpl.getLeagueDetails(league.fplLeagueId())).entries().stream()
					.map(entry -> new TeamEmblem(entry.entryId(), String.valueOf(entry.leagueEntryId()), entry.entryName(),
							url(leagueId, entry.entryId(), versions.get((long) entry.entryId())))).toList();
		}
		var standings = league.scoringType() == FplLeagueScoring.H2H
				? fpl.getClassicLeagueStandings(league.fplLeagueId()) : fpl.getClassicPointsLeagueStandings(league.fplLeagueId());
		return mapper.mapClassicLeagueEntries(standings).stream()
				.map(entry -> new TeamEmblem(entry.entryId(), String.valueOf(entry.entryId()), entry.entryName(),
						url(leagueId, entry.entryId(), versions.get(entry.entryId())))).toList();
	}

	@Transactional
	public void upload(CurrentUser user, long leagueId, long entryId, MultipartFile file) throws IOException {
		memberships.requireOwner(user, leagueId);
		var teams = teams(user, leagueId);
		if (teams.size() > 50 || teams.stream().noneMatch(team -> team.entryId() == entryId))
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a team in this league (maximum 50 teams).");
		if (file.getSize() > TeamEmblemProcessor.MAX_UPLOAD_BYTES)
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a PNG image no larger than 5 MB.");
		var image = processor.process(file.getBytes());
		jdbc.queryForList("select id from league where id = ? for update", Long.class, leagueId);
		// Keep storage bounded when FPL replaces teams or starts a new season.
		var currentEntries = teams.stream().map(TeamEmblem::entryId).collect(java.util.stream.Collectors.toSet());
		for (var storedEntry : jdbc.queryForList("select entry_id from league_team_emblem where league_id = ?", Long.class, leagueId)) {
			if (!currentEntries.contains(storedEntry))
				jdbc.update("delete from league_team_emblem where league_id = ? and entry_id = ?", leagueId, storedEntry);
		}
		jdbc.update("""
				insert into league_team_emblem (league_id, entry_id, version, image)
				values (?, ?, ?, ?) on duplicate key update version = values(version), image = values(image)
				""", leagueId, entryId, UUID.randomUUID().toString(), image);
	}

	public void delete(CurrentUser user, long leagueId, long entryId) {
		memberships.requireOwner(user, leagueId);
		jdbc.update("delete from league_team_emblem where league_id = ? and entry_id = ?", leagueId, entryId);
	}

	public byte[] image(CurrentUser user, long leagueId, long entryId, String version) {
		leagues.accessibleLeague(user, leagueId);
		var images = jdbc.query("select image from league_team_emblem where league_id = ? and entry_id = ? and version = ?",
				(row, index) -> row.getBytes("image"), leagueId, entryId, version);
		if (images.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Team emblem was not found.");
		return images.getFirst();
	}

	private String url(long leagueId, long entryId, String version) {
		return version == null ? null : "/api/customer/leagues/" + leagueId + "/teams/" + entryId + "/emblem/" + version + ".png";
	}

	public record TeamEmblem(long entryId, String managerId, String name, String url) { }
}
