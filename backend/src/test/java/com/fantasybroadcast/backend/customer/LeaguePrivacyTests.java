package com.fantasybroadcast.backend.customer;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.mock;
import com.fantasybroadcast.backend.fpl.FplDraftClient;
import com.fantasybroadcast.backend.security.BroadcastSecurityProperties;
import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

class LeaguePrivacyTests {
	JdbcTemplate jdbc;
	LeagueRegistrationService leagues;
	LeagueMembershipService memberships;
	final CurrentUser owner = new CurrentUser(1, "owner@example.com", "Owner", UserRole.USER);
	final CurrentUser follower = new CurrentUser(2, "follower@example.com", "Follower", UserRole.USER);
	@BeforeEach void setup() throws Exception {
		var source = new JdbcDataSource();
		source.setURL("jdbc:h2:mem:" + java.util.UUID.randomUUID() + ";MODE=MySQL;DB_CLOSE_DELAY=-1");
		jdbc = new JdbcTemplate(source);
		jdbc.execute("create table app_user (id bigint primary key, email varchar(320), display_name varchar(160))");
		jdbc.execute("create table league (id bigint primary key, owner_user_id bigint, fpl_league_id bigint, display_name varchar(160), league_type varchar(20), scoring_type varchar(20), service_enabled boolean, ai_narration_enabled boolean default false, voice_narration_enabled boolean default false, created_at timestamp default current_timestamp, updated_at timestamp default current_timestamp)");
		jdbc.execute("create table league_registration (user_id bigint, league_id bigint, primary key(user_id,league_id))");
		try (var connection = source.getConnection(); var migration = new liquibase.Liquibase("db/changelog/changes/015-league-privacy.yaml", new liquibase.resource.ClassLoaderResourceAccessor(), new liquibase.database.jvm.JdbcConnection(connection))) {
			migration.update(new liquibase.Contexts(), new liquibase.LabelExpression());
		}
		jdbc.update("insert into app_user values (1,'owner@example.com','Owner'),(2,'follower@example.com','Follower')");
		jdbc.update("insert into league (id, owner_user_id, fpl_league_id, display_name, league_type, scoring_type, service_enabled) values (1,1,100,'League','DRAFT','H2H',true),(2,2,200,'Other','CLASSIC','TOTAL_POINTS',true)");
		leagues = new LeagueRegistrationService(jdbc, mock(FplDraftClient.class), new BroadcastSecurityProperties());
		memberships = new LeagueMembershipService(jdbc);
	}
	@Test void privateRequestsCannotReadLeagueUntilOwnerApproves() {
		memberships.setPrivacy(owner, 1, true);
		assertThat(leagues.follow(follower, 1).status()).isEqualTo("PENDING");
		leagues.follow(follower, 1);
		assertThat(memberships.requests(owner, 1L)).hasSize(1);
		assertThatThrownBy(() -> leagues.accessibleLeague(follower, 1)).isInstanceOf(ResponseStatusException.class);
		assertThat(leagues.forUser(follower)).extracting(LeagueRegistrationService.RegisteredLeague::id).doesNotContain(1L);
		assertThatThrownBy(() -> memberships.decide(follower, 1, 2, true)).isInstanceOf(ResponseStatusException.class);
		memberships.decide(owner, 1, 2, true);
		assertThat(leagues.accessibleLeague(follower, 1).id()).isEqualTo(1);
		assertThat(memberships.requests(follower, null)).isEmpty();
		assertThatThrownBy(() -> memberships.decide(owner, 1, 2, false)).isInstanceOf(ResponseStatusException.class);
	}
	@Test void rejectionCancellationAndPublicTransitionPreserveMembershipRules() {
		assertThat(leagues.follow(follower, 1).status()).isEqualTo("APPROVED");
		memberships.setPrivacy(owner, 1, true);
		assertThat(leagues.accessibleLeague(follower, 1)).isNotNull();
		leagues.unfollow(follower, 1);
		leagues.follow(follower, 1);
		memberships.decide(owner, 1, 2, false);
		assertThat(memberships.requests(follower, null).getFirst().status()).isEqualTo("REJECTED");
		leagues.follow(follower, 1);
		memberships.cancel(follower, 1);
		assertThat(memberships.requests(follower, null)).isEmpty();
		leagues.follow(follower, 1);
		memberships.setPrivacy(owner, 1, false);
		assertThat(leagues.accessibleLeague(follower, 1)).isNotNull();
		assertThat(memberships.requests(follower, null)).isEmpty();
		assertThatThrownBy(() -> memberships.setPrivacy(owner, 2, true)).isInstanceOf(ResponseStatusException.class);
		assertThat(leagues.accessibleLeague(owner, 1)).isNotNull();
	}

	@Test void simultaneousFollowsAndDecisionsCannotCreateDuplicateMemberships() throws Exception {
		memberships.setPrivacy(owner, 1, true);
		var transactions = new org.springframework.transaction.support.TransactionTemplate(new org.springframework.jdbc.support.JdbcTransactionManager(jdbc.getDataSource()));
		try (var workers = java.util.concurrent.Executors.newFixedThreadPool(2)) {
			var first = workers.submit(() -> transactions.execute(status -> leagues.follow(follower, 1)));
			var second = workers.submit(() -> transactions.execute(status -> leagues.follow(follower, 1)));
			assertThat(first.get(10, java.util.concurrent.TimeUnit.SECONDS).status()).isEqualTo("PENDING");
			assertThat(second.get(10, java.util.concurrent.TimeUnit.SECONDS).status()).isEqualTo("PENDING");
			assertThat(memberships.requests(owner, 1L)).hasSize(1);
			var approve = workers.submit(() -> transactions.executeWithoutResult(status -> memberships.decide(owner, 1, 2, true)));
			var makePublic = workers.submit(() -> transactions.executeWithoutResult(status -> memberships.setPrivacy(owner, 1, false)));
			try { approve.get(10, java.util.concurrent.TimeUnit.SECONDS); }
			catch (java.util.concurrent.ExecutionException conflict) { assertThat(conflict.getCause()).isInstanceOf(ResponseStatusException.class); }
			makePublic.get(10, java.util.concurrent.TimeUnit.SECONDS);
			assertThat(jdbc.queryForObject("select count(*) from league_registration where league_id = 1 and user_id = 2", Integer.class)).isEqualTo(1);
		}
	}
}
