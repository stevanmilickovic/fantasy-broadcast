package com.fantasybroadcast.backend.customer;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.fantasybroadcast.backend.email.BroadcastEmailProperties;
import com.fantasybroadcast.backend.email.BroadcastEmailService;
import com.fantasybroadcast.backend.security.BroadcastSecurityProperties;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.concurrent.Executors;
import liquibase.Liquibase;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class UsernameTests {
	private JdbcTemplate jdbc;
	private AccountService accounts;
	private final PasswordHasher passwords = new PasswordHasher();

	@BeforeEach void setup() {
		var url = System.getProperty("username.test.url", "jdbc:h2:mem:" + java.util.UUID.randomUUID() + ";MODE=MySQL;DB_CLOSE_DELAY=-1");
		var source = new DriverManagerDataSource(url, System.getProperty("username.test.user", "sa"), System.getProperty("username.test.password", ""));
		jdbc = new JdbcTemplate(source);
		// The optional URL must name the dedicated disposable username-test database.
		if (!url.startsWith("jdbc:h2:") && !url.matches("jdbc:mysql://127\\.0\\.0\\.1:[0-9]+/username_verify(\\?.*)?")) throw new IllegalArgumentException("Use the disposable localhost username_verify database.");
		jdbc.execute("drop table if exists DATABASECHANGELOGLOCK");
		jdbc.execute("drop table if exists DATABASECHANGELOG");
		jdbc.execute("drop table if exists app_user");
		jdbc.execute("drop table if exists pending_user_registration");
		jdbc.execute("create table app_user (id bigint auto_increment primary key, email varchar(320) unique, display_name varchar(160), password_hash varchar(512), role varchar(20), updated_at timestamp default current_timestamp)");
		jdbc.execute("create table pending_user_registration (email varchar(320) primary key, display_name varchar(160), password_hash varchar(512), verification_code_hash varchar(512), expires_at timestamp)");
		accounts = new AccountService(jdbc, passwords, mock(BroadcastEmailService.class), new BroadcastEmailProperties(), new SessionService(), new BroadcastSecurityProperties());
	}

	private void migrate() throws Exception {
		try (var connection = jdbc.getDataSource().getConnection(); var migration = new Liquibase("db/changelog/changes/019-unique-usernames.yaml", new ClassLoaderResourceAccessor(), new JdbcConnection(connection))) {
			migration.update(new liquibase.Contexts(), new liquibase.LabelExpression());
		}
	}

	@Test void migrationPreservesNamesAndDatabaseRejectsEquivalentNames() throws Exception {
		jdbc.update("insert into app_user (email,display_name,role) values ('a@example.test','Alice','USER')");
		migrate(); migrate();
		assertThat(accounts.findByEmail("a@example.test").displayName()).isEqualTo("Alice");
		assertThatThrownBy(() -> jdbc.update("insert into app_user (email, display_name, username_key) values (?,?,?)", "b@example.test", "ＡＬＩＣＥ", Usernames.key("ＡＬＩＣＥ")))
				.isInstanceOf(org.springframework.dao.DuplicateKeyException.class);
		assertThatThrownBy(() -> jdbc.update("insert into app_user (email, display_name, username_key) values ('c@example.test','Other',null)"))
				.isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
		assertThat(Usernames.key(" e\u0301 ")).isEqualTo(Usernames.key("É"));
	}

	@Test void unexpectedLegacyCollisionFailsWithoutRenamingUsers() {
		jdbc.update("insert into app_user (email,display_name) values ('a@example.test','Alice'),('b@example.test','ＡＬＩＣＥ')");
		assertThatThrownBy(this::migrate).hasMessageContaining("Existing usernames need review");
		assertThat(jdbc.queryForList("select display_name from app_user order by id", String.class)).containsExactly("Alice", "ＡＬＩＣＥ");
	}

	@Test void defaultsRemainUniqueAcrossGoogleVerificationAndBootstrap() throws Exception {
		migrate();
		var google = accounts.findOrCreateGoogleUser("one@example.test", "Same");
		var next = accounts.findOrCreateGoogleUser("two@example.test", "ＳＡＭＥ");
		assertThat(next.displayName()).startsWith("SAME_");
		assertThat(accounts.findOrCreateGoogleUser("two@example.test", "Changed provider name")).isEqualTo(next);
		jdbc.update("insert into pending_user_registration values (?,?,?,?,?)", "three@example.test", "Same", passwords.hash("password-1234"), passwords.hash("123456"), Timestamp.from(Instant.now().plusSeconds(600)));
		assertThat(accounts.verifyRegistration("three@example.test", "123456").displayName()).startsWith("Same_");
		var config = new BroadcastSecurityProperties(); config.setExclusiveInitialAdmin(true);
		var bootstrap = new AccountService(jdbc, passwords, mock(BroadcastEmailService.class), new BroadcastEmailProperties(), new SessionService(), config);
		bootstrap.ensureInitialAdmin("same@example.test", "password-1234");
		assertThat(accounts.findByEmail("same@example.test").displayName()).startsWith("same_");
		assertThat(accounts.findByEmail(google.email()).displayName()).isEqualTo("Same");
		var longName = accounts.findOrCreateGoogleUser("long@example.test", "😀".repeat(40));
		var longDuplicate = accounts.findOrCreateGoogleUser("long2@example.test", longName.displayName());
		assertThat(longDuplicate.displayName().codePointCount(0, longDuplicate.displayName().length())).isEqualTo(40);
		assertThat(accounts.findOrCreateGoogleUser("empty@example.test", "\n\t").displayName()).isEqualTo("empty");
	}

	@Test void concurrentDefaultsAndManualEditsAreConstrainedByTheDatabase() throws Exception {
		migrate();
		try (var executor = Executors.newFixedThreadPool(4)) {
			var users = new java.util.ArrayList<java.util.concurrent.Future<CurrentUser>>();
			for (int i = 0; i < 8; i++) {
				var index = i;
				users.add(executor.submit(() -> accounts.findOrCreateGoogleUser("user" + index + "@example.test", "Shared")));
			}
			var names = new java.util.HashSet<String>();
			for (var user : users) names.add(user.get().displayName());
			assertThat(names).hasSize(8);
			var edits = users.stream().map(future -> executor.submit(() -> {
				try { accounts.updateDisplayName(future.get(), "Winner"); return true; }
				catch (org.springframework.web.server.ResponseStatusException conflict) { assertThat(conflict.getStatusCode().value()).isEqualTo(409); return false; }
			})).toList();
			var successes = 0;
			for (var edit : edits) if (edit.get()) successes++;
			assertThat(successes).isEqualTo(1);
		}
	}
}
