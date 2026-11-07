package com.fantasybroadcast.backend.customer;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.mock;

import com.fantasybroadcast.backend.email.BroadcastEmailProperties;
import com.fantasybroadcast.backend.email.BroadcastEmailService;
import com.fantasybroadcast.backend.security.BroadcastSecurityProperties;
import jakarta.servlet.http.Cookie;
import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.server.ResponseStatusException;

class ProfileTests {
	@Test
	void namesAreUniqueAndRefreshEverySessionWithoutGoogleOverwritingThem() {
		var source = new JdbcDataSource();
		source.setURL("jdbc:h2:mem:" + java.util.UUID.randomUUID() + ";DB_CLOSE_DELAY=-1");
		var jdbc = new JdbcTemplate(source);
		jdbc.execute("create table app_user (id bigint primary key, email varchar(320), display_name varchar(160), username_key varbinary(2048) unique, role varchar(20), updated_at timestamp)");
		jdbc.update("insert into app_user (id,email,display_name,role) values (1,'a@example.com','A','USER'),(2,'b@example.com','Same','USER')");
		jdbc.update("update app_user set username_key = ? where id = 2", Usernames.key("Same"));
		var sessions = new SessionService();
		var accounts = new AccountService(jdbc, new PasswordHasher(), mock(BroadcastEmailService.class), new BroadcastEmailProperties(), sessions, new BroadcastSecurityProperties());
		var user = accounts.findByEmail("a@example.com");
		var first = new MockHttpServletRequest();
		first.setCookies(new Cookie(SessionService.COOKIE_NAME, sessions.create(user)));
		var second = new MockHttpServletRequest();
		second.setCookies(new Cookie(SessionService.COOKIE_NAME, sessions.create(user)));
		assertThatThrownBy(() -> accounts.updateDisplayName(user, " ＳＡＭＥ ")).isInstanceOf(ResponseStatusException.class).hasMessageContaining("409");
		assertThat(accounts.updateDisplayName(user, " Different ").displayName()).isEqualTo("Different");
		assertThat(accounts.updateDisplayName(user, "Different").displayName()).isEqualTo("Different");
		assertThat(sessions.require(first).displayName()).isEqualTo("Different");
		assertThat(sessions.require(second).displayName()).isEqualTo("Different");
		assertThat(accounts.findOrCreateGoogleUser(user.email(), "Google name").displayName()).isEqualTo("Different");
		for (var invalid : new String[]{"   ", "x".repeat(41), "hello\nworld"})
			assertThatThrownBy(() -> accounts.updateDisplayName(user, invalid)).isInstanceOf(ResponseStatusException.class);
		assertThatThrownBy(() -> sessions.require(new MockHttpServletRequest())).isInstanceOf(ResponseStatusException.class);
	}
}
