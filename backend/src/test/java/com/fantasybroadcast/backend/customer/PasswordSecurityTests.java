package com.fantasybroadcast.backend.customer;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.fantasybroadcast.backend.email.BroadcastEmailProperties;
import com.fantasybroadcast.backend.email.BroadcastEmailService;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HexFormat;
import java.util.concurrent.Executors;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.server.ResponseStatusException;
import jakarta.servlet.http.Cookie;

class PasswordSecurityTests {

	private JdbcTemplate jdbc;
	private PasswordSecurityService security;
	private final PasswordHasher hashes = new PasswordHasher();
	private final SessionService sessions = new SessionService();
	private final BroadcastEmailService mail = mock(BroadcastEmailService.class);
	private final CurrentUser user = new CurrentUser(1, "local@example.test", "Local", UserRole.USER);
	private final String oldPassword = "old-password-123";

	@BeforeEach void setup() {
		var source = new DriverManagerDataSource("jdbc:h2:mem:" + java.util.UUID.randomUUID() + ";MODE=MySQL;DB_CLOSE_DELAY=-1", "sa", "");
		jdbc = new JdbcTemplate(source);
		jdbc.execute("create table app_user (id bigint primary key, email varchar(320), password_hash varchar(512), updated_at timestamp)");
		jdbc.execute("create table password_reset_token (user_id bigint, token_hash varchar(64) primary key, expires_at timestamp)");
		jdbc.update("insert into app_user (id,email,password_hash) values (1,?,?), (2,'google@example.test',null)", user.email(), hashes.hash(oldPassword));
		security = new PasswordSecurityService(jdbc, hashes, sessions, mail, new BroadcastEmailProperties(), new PasswordAttemptLimiter(), new DataSourceTransactionManager(source), Runnable::run);
	}

	private void token(long id, String value, Instant expiry) throws Exception {
		jdbc.update("insert into password_reset_token values (?,?,?)", id,
				HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))), Timestamp.from(expiry));
	}
	private MockHttpServletRequest session() {
		var request = new MockHttpServletRequest();
		request.setCookies(new Cookie(SessionService.COOKIE_NAME, sessions.create(user))); return request;
	}

	@Test void changeVerifiesCurrentPasswordConsumesTokensAndInvalidatesEverySession() throws Exception {
		var one = session(); var two = session();
		token(1, "outstanding", Instant.now().plusSeconds(600));
		assertThatThrownBy(() -> security.change(user, "wrong", "new-password-123")).hasMessageContaining("Current password");
		assertThat(sessions.require(one)).isEqualTo(user);
		assertThatThrownBy(() -> security.change(user, oldPassword, "short")).hasMessageContaining("12–200");
		security.change(user, oldPassword, "new-password-123");
		assertThat(hashes.matches("new-password-123", jdbc.queryForObject("select password_hash from app_user where id=1", String.class))).isTrue();
		assertThat(jdbc.queryForObject("select count(*) from password_reset_token", Integer.class)).isZero();
		assertThatThrownBy(() -> sessions.require(one)).isInstanceOf(ResponseStatusException.class);
		assertThatThrownBy(() -> sessions.require(two)).isInstanceOf(ResponseStatusException.class);
		verify(mail).send(eq(user.email()), contains("password changed"), argThat(body -> !body.contains("new-password-123")));
	}

	@Test void googleOnlyCannotChangeOrResetEvenWithALegacyToken() throws Exception {
		var google = new CurrentUser(2, "google@example.test", "Google", UserRole.USER);
		assertThat(security.capability(google).hasPassword()).isFalse();
		assertThat(security.capability(user).hasPassword()).isTrue();
		assertThatThrownBy(() -> security.change(google, "anything", "new-password-123")).hasMessageContaining("Google");
		token(2, "legacy-token", Instant.now().plusSeconds(600));
		assertThatThrownBy(() -> security.reset("legacy-token", "new-password-123", "ip")).hasMessageContaining("invalid or has expired");
		assertThat(security.forgot(google.email(), "ip")).isEqualTo(security.forgot("missing@example.test", "ip"));
		verifyNoInteractions(mail);
		assertThat(security.capability(google).hasPassword()).isFalse();
	}

	@Test void recoveryIsGenericThrottledAndMailFailureDoesNotLeaveAToken() {
		var expected = security.forgot("missing@example.test", "ip");
		doThrow(new IllegalStateException("SMTP unavailable")).when(mail).send(anyString(), anyString(), anyString());
		assertThat(security.forgot(user.email(), "ip")).isEqualTo(expected);
		assertThat(jdbc.queryForObject("select count(*) from password_reset_token", Integer.class)).isZero();
		for(int i=0; i<5; i++) assertThat(security.forgot(user.email(), "ip")).isEqualTo(expected);
		verify(mail, times(3)).send(anyString(), anyString(), anyString());
		security.change(user, oldPassword, "new-password-123");
		assertThat(hashes.matches("new-password-123", jdbc.queryForObject("select password_hash from app_user where id=1", String.class))).isTrue();
	}

	@Test void resetIsSingleUseUnderConcurrencyAndRejectsExpiredTokens() throws Exception {
		var current = session();
		token(1, "expired", Instant.now().minusSeconds(10));
		assertThatThrownBy(() -> security.reset("expired", "new-password-123", "ip")).hasMessageContaining("expired");
		token(1, "valid", Instant.now().plusSeconds(600));
		try(var executor = Executors.newFixedThreadPool(2)) {
			var work = new java.util.ArrayList<java.util.concurrent.Future<Boolean>>();
			for(int i=0; i<2; i++) work.add(executor.submit(() -> {
				try { security.reset("valid", "new-password-123", "ip"); return true; }
				catch(ResponseStatusException invalid) { return false; }
			}));
			assertThat(work.get(0).get() ^ work.get(1).get()).isTrue();
		}
		assertThatThrownBy(() -> sessions.require(current)).isInstanceOf(ResponseStatusException.class);
		assertThatThrownBy(() -> security.reset("valid", "another-password", "ip")).hasMessageContaining("expired");
	}

	@Test void changeAttemptsAreBoundedAndRecoveryRunsOutsideTheRequest() {
		for(int i=0; i<5; i++) assertThatThrownBy(() -> security.change(user, "wrong", "new-password-123")).hasMessageContaining("incorrect");
		assertThatThrownBy(() -> security.change(user, oldPassword, "new-password-123")).hasMessageContaining("ten minutes");
		var tasks = new java.util.ArrayList<Runnable>();
		var queued = new PasswordSecurityService(jdbc, hashes, sessions, mail, new BroadcastEmailProperties(), new PasswordAttemptLimiter(), new DataSourceTransactionManager(jdbc.getDataSource()), tasks::add);
		assertThat(queued.forgot(user.email(), "ip")).isEqualTo(queued.forgot("missing@example.test", "ip"));
		verifyNoInteractions(mail);
		assertThat(tasks).hasSize(2);
		tasks.forEach(Runnable::run);
		verify(mail, times(1)).send(eq(user.email()), anyString(), anyString());
	}

	@Test void attemptWindowExpires() {
		var time = Instant.parse("2026-10-01T00:00:00Z");
		var clock = mock(Clock.class); when(clock.instant()).thenReturn(time);
		var limiter = new PasswordAttemptLimiter(clock);
		assertThat(limiter.allow("key", 1)).isTrue(); assertThat(limiter.allow("key", 1)).isFalse();
		when(clock.instant()).thenReturn(time.plusSeconds(600));
		assertThat(limiter.allow("key", 1)).isTrue();
	}
}
