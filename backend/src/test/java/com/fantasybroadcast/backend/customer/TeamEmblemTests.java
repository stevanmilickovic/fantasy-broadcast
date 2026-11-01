package com.fantasybroadcast.backend.customer;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.fantasybroadcast.backend.fpl.FplDraftClient;
import com.fantasybroadcast.backend.fpl.FplDraftMapper;
import java.awt.image.BufferedImage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.json.JsonMapper;

class TeamEmblemTests extends LeaguePrivacyTests {
	private TeamEmblemService emblems;
	private final FplDraftClient fpl = mock(FplDraftClient.class);

	@BeforeEach void emblemSetup() throws Exception {
		try (var connection = jdbc.getDataSource().getConnection(); var migration = new liquibase.Liquibase("db/changelog/changes/017-team-emblems.yaml", new liquibase.resource.ClassLoaderResourceAccessor(), new liquibase.database.jvm.JdbcConnection(connection))) {
			migration.update(new liquibase.Contexts(), new liquibase.LabelExpression());
		}
		when(fpl.getLeagueDetails(100)).thenReturn(JsonMapper.builder().build().readTree("""
				{"league_entries":[{"id":42,"entry_id":9001,"entry_name":"First team","player_first_name":"A","player_last_name":"Manager"}]}
				"""));
		emblems = new TeamEmblemService(jdbc, leagues, memberships, fpl, new FplDraftMapper(), new TeamEmblemProcessor());
	}

	@Test void onlyOwnersCanUploadAndReplaceWithoutKeepingOldImages() throws Exception {
		assertThat(emblems.teams(owner, 1).getFirst().managerId()).isEqualTo("42");
		assertThatThrownBy(() -> emblems.upload(follower, 1, 9001, upload())).isInstanceOf(ResponseStatusException.class);
		assertThatThrownBy(() -> emblems.upload(owner, 1, 1234, upload())).isInstanceOf(ResponseStatusException.class);
		emblems.upload(owner, 1, 9001, upload());
		var first = version();
		assertThat(emblems.image(owner, 1, 9001, first)).isNotEmpty();
		assertThat(emblems.teams(owner, 1).getFirst().url()).endsWith(first + ".png");
		emblems.upload(owner, 1, 9001, upload());
		assertThat(version()).isNotEqualTo(first);
		assertThat(jdbc.queryForObject("select count(*) from league_team_emblem", Integer.class)).isEqualTo(1);
		assertThatThrownBy(() -> emblems.image(owner, 1, 9001, first)).isInstanceOf(ResponseStatusException.class);
		assertThatThrownBy(() -> emblems.delete(follower, 1, 9001)).isInstanceOf(ResponseStatusException.class);
		emblems.delete(owner, 1, 9001);
		assertThat(emblems.teams(owner, 1).getFirst().url()).isNull();
	}

	@Test void privateLeagueImagesRequireApprovedMembershipAndAreDeletedWithTheLeague() throws Exception {
		emblems.upload(owner, 1, 9001, upload());
		var version = version();
		memberships.setPrivacy(owner, 1, true);
		leagues.follow(follower, 1);
		assertThatThrownBy(() -> emblems.teams(follower, 1)).isInstanceOf(ResponseStatusException.class);
		assertThatThrownBy(() -> emblems.image(follower, 1, 9001, version)).isInstanceOf(ResponseStatusException.class);
		memberships.decide(owner, 1, follower.id(), true);
		assertThat(emblems.image(follower, 1, 9001, version)).isNotEmpty();
		leagues.unfollow(follower, 1);
		assertThatThrownBy(() -> emblems.image(follower, 1, 9001, version)).isInstanceOf(ResponseStatusException.class);
		jdbc.update("delete from league where id = 1");
		assertThat(jdbc.queryForObject("select count(*) from league_team_emblem", Integer.class)).isZero();
	}

	@Test void classicPointsTeamsUseEntryIdsInBothViews() throws Exception {
		when(fpl.getClassicPointsLeagueStandings(200)).thenReturn(JsonMapper.builder().build().readTree("""
				{"standings":{"results":[{"entry":8001,"entry_name":"Classic team","player_name":"Manager","rank":1,"total":10}]}}
				"""));
		emblems.upload(follower, 2, 8001, upload());
		var team = emblems.teams(follower, 2).getFirst();
		assertThat(team.entryId()).isEqualTo(8001);
		assertThat(team.managerId()).isEqualTo("8001");
		assertThat(team.url()).contains("/leagues/2/teams/8001/emblem/");
		assertThatThrownBy(() -> emblems.image(owner, 1, 8001, version())).isInstanceOf(ResponseStatusException.class);
	}

	@Test void replacingTheFplRosterRemovesEmblemsForDepartedTeams() throws Exception {
		emblems.upload(owner, 1, 9001, upload());
		when(fpl.getLeagueDetails(100)).thenReturn(JsonMapper.builder().build().readTree("""
				{"league_entries":[{"id":43,"entry_id":9002,"entry_name":"Replacement team"}]}
				"""));
		emblems.upload(owner, 1, 9002, upload());
		assertThat(jdbc.queryForList("select entry_id from league_team_emblem", Long.class)).containsExactly(9002L);
	}

	private String version() {
		return jdbc.queryForObject("select version from league_team_emblem", String.class);
	}
	private MockMultipartFile upload() throws Exception {
		return new MockMultipartFile("image", "team.png", "image/png", TeamEmblemProcessorTests.png(new BufferedImage(64, 64, BufferedImage.TYPE_INT_ARGB)));
	}
}
