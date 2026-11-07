package com.fantasybroadcast.backend.customer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

import com.fantasybroadcast.backend.email.BroadcastEmailProperties;
import com.fantasybroadcast.backend.email.BroadcastEmailService;
import com.fantasybroadcast.backend.security.BroadcastSecurityProperties;
import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

class ExclusiveAdminTests {
	private JdbcTemplate jdbc;
	private AccountService accounts;
	private BroadcastSecurityProperties properties;
	private final PasswordHasher passwords = new PasswordHasher();
	private static final String ADMIN_EMAIL = "skelolegenda@gmail.com";

	@BeforeEach
	void setUp() {
		var source = new JdbcDataSource();
		source.setURL("jdbc:h2:mem:" + java.util.UUID.randomUUID() + ";MODE=MySQL;DB_CLOSE_DELAY=-1");
		jdbc = new JdbcTemplate(source);
		jdbc.execute("create table app_user (id bigint auto_increment primary key, email varchar(255) unique, display_name varchar(255), username_key varbinary(2048) unique, password_hash varchar(255), role varchar(20), created_at timestamp default current_timestamp, updated_at timestamp default current_timestamp)");
		jdbc.execute("create table league (id bigint primary key, owner_user_id bigint)");
		jdbc.execute("create table league_registration (user_id bigint, league_id bigint)");
		properties = new BroadcastSecurityProperties();
		properties.setExclusiveInitialAdmin(true);
		properties.setInitialAdminEmail(ADMIN_EMAIL);
		accounts = new AccountService(jdbc, passwords, mock(BroadcastEmailService.class), new BroadcastEmailProperties(), new SessionService(), properties);
	}

	@Test
	void bootstrapsAnAuthenticatableSoleAdminAndKeepsTheSameAccountOnRestart() {
		accounts.ensureInitialAdmin(ADMIN_EMAIL, "first-password");
		var first = accounts.authenticate(ADMIN_EMAIL, "first-password");
		accounts.ensureInitialAdmin(ADMIN_EMAIL, "second-password");
		assertThat(accounts.authenticate(ADMIN_EMAIL, "second-password").id()).isEqualTo(first.id());
		assertThat(jdbc.queryForObject("select count(*) from app_user where role = 'ADMIN'", Integer.class)).isEqualTo(1);
	}

	@Test
	void demotesOtherAdminsAndPromotesTheConfiguredExistingUser() {
		jdbc.update("insert into app_user (email, display_name, role) values ('other@example.com', 'Other', 'ADMIN')");
		jdbc.update("insert into app_user (email, display_name, role) values (?, 'Designated', 'USER')", ADMIN_EMAIL);
		accounts.ensureInitialAdmin(ADMIN_EMAIL, "local-password");
		assertThat(accounts.findByEmail("other@example.com").role()).isEqualTo(UserRole.USER);
		assertThat(accounts.authenticate(ADMIN_EMAIL, "local-password").role()).isEqualTo(UserRole.ADMIN);
	}

	@Test
	void preventsOtherUsersFromBeingPromoted() {
		accounts.ensureInitialAdmin(ADMIN_EMAIL, "local-password");
		var user = accounts.findOrCreateGoogleUser("user@example.com", "User");
		assertThatThrownBy(() -> accounts.promoteToAdmin(accounts.findByEmail(ADMIN_EMAIL), user.id()))
				.isInstanceOf(ResponseStatusException.class).hasMessageContaining("403");
		assertThat(accounts.findByEmail(user.email()).role()).isEqualTo(UserRole.USER);
	}

	@Test
	void doesNotMakeTheFirstGoogleUserAnAdminInExclusiveMode() {
		assertThat(accounts.findOrCreateGoogleUser("user@example.com", "User").role()).isEqualTo(UserRole.USER);
	}

	@Test
	void keepsTheExistingBootstrapBehaviorWhenExclusiveModeIsOff() {
		properties.setExclusiveInitialAdmin(false);
		jdbc.update("insert into app_user (email, display_name, role) values ('other@example.com', 'Other', 'ADMIN')");
		accounts.ensureInitialAdmin(ADMIN_EMAIL, "local-password");
		assertThat(accounts.findByEmail("other@example.com").role()).isEqualTo(UserRole.ADMIN);
		assertThat(jdbc.queryForObject("select count(*) from app_user", Integer.class)).isEqualTo(1);
	}

	@Test
	void failsStartupWhenExclusiveModeHasNoBootstrapCredentials() {
		assertThatThrownBy(() -> new AdminBootstrap().createInitialAdmin(accounts, properties).run())
				.isInstanceOf(IllegalStateException.class).hasMessageContaining("requires an initial admin email and password");
	}
}
