package com.fantasybroadcast.backend.customer;

import com.fantasybroadcast.backend.email.BroadcastEmailProperties;
import com.fantasybroadcast.backend.email.BroadcastEmailService;
import jakarta.annotation.PreDestroy;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.Executor;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;

@Service
@Profile("db & !test")
public class PasswordSecurityService {

	private static final org.slf4j.Logger LOG = org.slf4j.LoggerFactory.getLogger(PasswordSecurityService.class);
	private static final String RECOVERY_MESSAGE = "If an account exists for that email, a password reset link has been sent.";
	private final JdbcTemplate jdbc;
	private final PasswordHasher passwords;
	private final SessionService sessions;
	private final BroadcastEmailService mail;
	private final BroadcastEmailProperties mailProperties;
	private final PasswordAttemptLimiter attempts;
	private final TransactionTemplate transactions;
	private final Executor recovery;

	@Autowired
	public PasswordSecurityService(JdbcTemplate jdbc, PasswordHasher passwords, SessionService sessions,
			BroadcastEmailService mail, BroadcastEmailProperties mailProperties, PasswordAttemptLimiter attempts,
			PlatformTransactionManager transactionManager) {
		this(jdbc, passwords, sessions, mail, mailProperties, attempts, transactionManager,
				new ThreadPoolExecutor(1, 1, 0, TimeUnit.SECONDS, new ArrayBlockingQueue<>(128), runnable -> {
					var thread = new Thread(runnable, "password-recovery"); thread.setDaemon(true); return thread;
				}));
	}

	PasswordSecurityService(JdbcTemplate jdbc, PasswordHasher passwords, SessionService sessions,
			BroadcastEmailService mail, BroadcastEmailProperties mailProperties, PasswordAttemptLimiter attempts,
			PlatformTransactionManager transactionManager, Executor recovery) {
		this.jdbc = jdbc; this.passwords = passwords; this.sessions = sessions; this.mail = mail;
		this.mailProperties = mailProperties; this.attempts = attempts;
		this.transactions = new TransactionTemplate(transactionManager); this.recovery = recovery;
	}

	public Capability capability(CurrentUser user) {
		return new Capability(Boolean.TRUE.equals(jdbc.queryForObject(
				"select password_hash is not null from app_user where id = ?", Boolean.class, user.id())));
	}

	public PasswordResetRequest forgot(String email, String remoteAddress) {
		var normalized = email.trim().toLowerCase(Locale.ROOT);
		if (attempts.allow("forgot-ip:" + remoteAddress, 20) && attempts.allow("forgot-email:" + digest(normalized), 3)) {
			try { recovery.execute(() -> issueReset(normalized)); }
			catch (RejectedExecutionException full) { LOG.warn("Password recovery queue is full"); }
		}
		return new PasswordResetRequest(RECOVERY_MESSAGE);
	}

	private void issueReset(String email) {
		try {
			transactions.executeWithoutResult(status -> {
				jdbc.update("delete from password_reset_token where expires_at < ?", Timestamp.from(Instant.now()));
				var users = jdbc.queryForList("select id from app_user where email = ? and password_hash is not null for update", Long.class, email);
				if (users.isEmpty()) return;
				var bytes = new byte[32]; new SecureRandom().nextBytes(bytes);
				var token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
				jdbc.update("delete from password_reset_token where user_id = ?", users.getFirst());
				jdbc.update("insert into password_reset_token (user_id, token_hash, expires_at) values (?, ?, ?)",
						users.getFirst(), digest(token), Timestamp.from(Instant.now().plusSeconds(1800)));
				var url = UriComponentsBuilder.fromUriString(mailProperties.getPublicBaseUrl())
						.replacePath("/reset-password").replaceQuery(null).queryParam("token", token).build().toUriString();
				mail.send(email, "Reset your Fantasy Broadcast password", "Choose a new password:\n\n" + url
						+ "\n\nThis link expires in 30 minutes and can only be used once. If you did not request it, ignore this email.");
			});
		} catch (RuntimeException failed) { LOG.warn("Password recovery could not be delivered"); }
	}

	public void change(CurrentUser user, String currentPassword, String newPassword) {
		requireAttempt("change:" + user.id(), 5);
		validatePassword(newPassword);
		transactions.executeWithoutResult(status -> {
			var hashes = jdbc.queryForList("select password_hash from app_user where id = ? for update", String.class, user.id());
			if (hashes.isEmpty() || hashes.getFirst() == null)
				throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Manage your password with Google.");
			if (currentPassword == null || currentPassword.length() > 200 || !passwords.matches(currentPassword, hashes.getFirst()))
				throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Current password is incorrect.");
			updatePassword(user.id(), newPassword);
		});
		sessions.removeForUser(user.id());
		notifyChanged(user.email());
	}

	public void reset(String token, String password, String remoteAddress) {
		requireAttempt("reset-ip:" + remoteAddress, 20);
		validatePassword(password);
		if (token == null || token.isBlank() || token.length() > 200) throw invalidReset();
		var email = transactions.execute(status -> {
			var ids = jdbc.queryForList("select user_id from password_reset_token where token_hash = ?", Long.class, digest(token));
			if (ids.isEmpty()) throw invalidReset();
			var userId = ids.getFirst();
			var users = jdbc.queryForList("select email from app_user where id = ? and password_hash is not null for update", String.class, userId);
			if (users.isEmpty()) throw invalidReset();
			var consumed = jdbc.update("delete from password_reset_token where token_hash = ? and expires_at >= ?", digest(token), Timestamp.from(Instant.now()));
			if (consumed != 1) throw invalidReset();
			updatePassword(userId, password);
			return new ResetAccount(userId, users.getFirst());
		});
		if (email != null) { sessions.removeForUser(email.id()); notifyChanged(email.email()); }
	}

	private void updatePassword(long userId, String password) {
		jdbc.update("update app_user set password_hash = ?, updated_at = current_timestamp where id = ?", passwords.hash(password), userId);
		jdbc.update("delete from password_reset_token where user_id = ?", userId);
	}
	private void notifyChanged(String email) {
		try { mail.send(email, "Your Fantasy Broadcast password changed", "Your password was changed and existing sessions were signed out. If this was not you, reset your password and contact support."); }
		catch (RuntimeException failed) { LOG.warn("Password change notification could not be delivered"); }
	}
	private void requireAttempt(String key, int limit) {
		if (!attempts.allow(key, limit)) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Please wait ten minutes before trying again.");
	}
	private void validatePassword(String password) {
		if (password == null || password.isBlank() || password.length() < 12 || password.length() > 200)
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must contain 12–200 characters.");
	}
	private ResponseStatusException invalidReset() { return new ResponseStatusException(HttpStatus.BAD_REQUEST, "This password reset link is invalid or has expired."); }
	private static String digest(String value) {
		try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
		catch (java.security.NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
	}
	@PreDestroy public void close() { if (recovery instanceof ExecutorService executor) executor.shutdownNow(); }
	public record Capability(boolean hasPassword) { }
	public record PasswordResetRequest(String message) { }
	private record ResetAccount(long id, String email) { }
}
