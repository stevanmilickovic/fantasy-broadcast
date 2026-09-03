package com.fantasybroadcast.backend.customer;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.sql.Timestamp;
import java.util.List;
import java.util.Locale;
import org.springframework.context.annotation.Profile;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import com.fantasybroadcast.backend.email.BroadcastEmailService;

@Service
@Profile("db & !test")
public class AccountService {

	private final JdbcTemplate jdbcTemplate;
	private final PasswordHasher passwordHasher;
	private final BroadcastEmailService emailService;
	private final SecureRandom secureRandom = new SecureRandom();

	public AccountService(JdbcTemplate jdbcTemplate, PasswordHasher passwordHasher, BroadcastEmailService emailService) {
		this.jdbcTemplate = jdbcTemplate;
		this.passwordHasher = passwordHasher;
		this.emailService = emailService;
	}

	public PendingRegistration register(String email, String password) {
		var normalizedEmail = normalizeEmail(email);
		if (!normalizedEmail.contains("@")) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter a valid email address.");
		if (emailExists(normalizedEmail)) throw new ResponseStatusException(HttpStatus.CONFLICT, "An account already exists for this email.");
		var code = verificationCode();
		var expiresAt = Instant.now().plus(Duration.ofMinutes(15));
		jdbcTemplate.update("delete from pending_user_registration where email = ?", normalizedEmail);
		jdbcTemplate.update("""
				insert into pending_user_registration (email, display_name, password_hash, verification_code_hash, expires_at)
				values (?, ?, ?, ?, ?)
				""", normalizedEmail, displayName(normalizedEmail), passwordHasher.hash(password), passwordHasher.hash(code), Timestamp.from(expiresAt));
		try {
			emailService.send(normalizedEmail, "Your Fantasy Broadcast verification code",
					"Use this code to finish creating your Fantasy Broadcast account:\n\n" + code + "\n\nThis code expires in 15 minutes.");
		}
		catch (RuntimeException exception) {
			jdbcTemplate.update("delete from pending_user_registration where email = ?", normalizedEmail);
			throw exception;
		}
		return new PendingRegistration(normalizedEmail, "Verification code sent.");
	}

	public CurrentUser verifyRegistration(String email, String code) {
		var normalizedEmail = normalizeEmail(email);
		var pending = jdbcTemplate.query("""
				select email, display_name, password_hash, verification_code_hash, expires_at
				from pending_user_registration where email = ?
				""", this::mapPendingRegistration, normalizedEmail);
		if (pending.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request a new verification code.");
		var registration = pending.getFirst();
		if (registration.expiresAt().isBefore(Instant.now())) {
			jdbcTemplate.update("delete from pending_user_registration where email = ?", normalizedEmail);
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Verification code expired. Request a new code.");
		}
		if (!passwordHasher.matches(code.trim(), registration.verificationCodeHash())) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Verification code is incorrect.");
		}
		var role = defaultRegistrationRole();
		try {
			jdbcTemplate.update("insert into app_user (email, display_name, password_hash, role) values (?, ?, ?, ?)",
					registration.email(), registration.displayName(), registration.passwordHash(), role.name());
		}
		catch (DuplicateKeyException exception) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "An account already exists for this email.");
		}
		finally {
			jdbcTemplate.update("delete from pending_user_registration where email = ?", normalizedEmail);
		}
		return findByEmail(normalizedEmail);
	}

	public CurrentUser authenticate(String email, String password) {
		var row = jdbcTemplate.query("select id, email, display_name, role, password_hash from app_user where email = ?", this::mapLogin,
				normalizeEmail(email));
		if (row.isEmpty() || row.getFirst().passwordHash() == null || !passwordHasher.matches(password, row.getFirst().passwordHash())) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Email or password is incorrect.");
		}
		return row.getFirst().user();
	}

	public CurrentUser findOrCreateGoogleUser(String email, String displayName) {
		var normalizedEmail = normalizeEmail(email);
		var users = jdbcTemplate.query("select id, email, display_name, role from app_user where email = ?", this::mapUser, normalizedEmail);
		if (!users.isEmpty()) return users.getFirst();
		var role = defaultRegistrationRole();
		jdbcTemplate.update("insert into app_user (email, display_name, password_hash, role) values (?, ?, null, ?)",
				normalizedEmail, cleanDisplayName(displayName, normalizedEmail), role.name());
		return findByEmail(normalizedEmail);
	}

	public CurrentUser findByEmail(String email) {
		var users = jdbcTemplate.query("select id, email, display_name, role from app_user where email = ?", this::mapUser, email);
		if (users.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found.");
		return users.getFirst();
	}

	public AdminUserPage allForAdmin(CurrentUser currentUser, int page, int size, String search) {
		requireAdmin(currentUser);
		var searchTerm = search == null ? "" : search.trim();
		var total = jdbcTemplate.queryForObject("""
				select count(*) from app_user
				where lower(email) like concat('%', lower(?), '%') or lower(display_name) like concat('%', lower(?), '%')
				""", Long.class, searchTerm, searchTerm);
		var users = jdbcTemplate.query("""
				select u.id, u.email, u.display_name, u.role, u.created_at, count(distinct r.league_id) as registered_league_count,
				       count(distinct owned.id) as owned_league_count
				from (
					select id, email, display_name, role, created_at
					from app_user
					where lower(email) like concat('%', lower(?), '%') or lower(display_name) like concat('%', lower(?), '%')
					order by created_at desc, id desc limit ? offset ?
				) u
				left join league_registration r on r.user_id = u.id
				left join league owned on owned.owner_user_id = u.id
				group by u.id, u.email, u.display_name, u.role, u.created_at
				order by u.created_at desc, u.id desc
				""", this::mapAdminUser, searchTerm, searchTerm, size, (long) page * size);
		return new AdminUserPage(users, page, size, total == null ? 0 : total);
	}

	public AdminUser promoteToAdmin(CurrentUser currentUser, long userId) {
		requireAdmin(currentUser);
		var updated = jdbcTemplate.update("update app_user set role = 'ADMIN', updated_at = current_timestamp where id = ?", userId);
		if (updated == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User was not found.");
		return adminUser(userId);
	}

	@Transactional
	public void deleteForAdmin(CurrentUser currentUser, long userId) {
		requireAdmin(currentUser);
		if (currentUser.id() == userId) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You cannot delete your own account.");
		var users = jdbcTemplate.query("select id, email, display_name, role from app_user where id = ?", this::mapUser, userId);
		if (users.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User was not found.");
		if (users.getFirst().role() == UserRole.ADMIN && adminCount() <= 1) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You cannot delete the last administrator.");
		}
		jdbcTemplate.update("delete from league where owner_user_id = ?", userId);
		jdbcTemplate.update("delete from league_registration where user_id = ?", userId);
		jdbcTemplate.update("delete from pending_user_registration where email = ?", users.getFirst().email());
		jdbcTemplate.update("delete from app_user where id = ?", userId);
	}

	public void ensureInitialAdmin(String email, String password) {
		var existingAdminCount = jdbcTemplate.queryForObject("select count(*) from app_user where role = 'ADMIN'", Long.class);
		if (existingAdminCount != null && existingAdminCount > 0) return;
		var normalizedEmail = normalizeEmail(email);
		var users = jdbcTemplate.query("select id, email, display_name, role from app_user where email = ?", this::mapUser, normalizedEmail);
		if (users.isEmpty()) {
			jdbcTemplate.update("insert into app_user (email, display_name, password_hash, role) values (?, ?, ?, 'ADMIN')",
					normalizedEmail, displayName(normalizedEmail), passwordHasher.hash(password));
			return;
		}
		jdbcTemplate.update("update app_user set role = 'ADMIN', password_hash = ? where id = ?", passwordHasher.hash(password), users.getFirst().id());
	}

	private LoginRow mapLogin(ResultSet resultSet, int rowNumber) throws SQLException {
		return new LoginRow(mapUser(resultSet, rowNumber), resultSet.getString("password_hash"));
	}

	private PendingRegistrationRow mapPendingRegistration(ResultSet resultSet, int rowNumber) throws SQLException {
		return new PendingRegistrationRow(resultSet.getString("email"), resultSet.getString("display_name"), resultSet.getString("password_hash"),
				resultSet.getString("verification_code_hash"), resultSet.getTimestamp("expires_at").toInstant());
	}

	private CurrentUser mapUser(ResultSet resultSet, int rowNumber) throws SQLException {
		return new CurrentUser(resultSet.getLong("id"), resultSet.getString("email"), resultSet.getString("display_name"),
				UserRole.valueOf(resultSet.getString("role")));
	}

	private AdminUser mapAdminUser(ResultSet resultSet, int rowNumber) throws SQLException {
		return new AdminUser(resultSet.getLong("id"), resultSet.getString("email"), resultSet.getString("display_name"),
				UserRole.valueOf(resultSet.getString("role")), resultSet.getTimestamp("created_at").toInstant().toString(),
				resultSet.getLong("registered_league_count"), resultSet.getLong("owned_league_count"));
	}

	private String normalizeEmail(String email) {
		return email.trim().toLowerCase(Locale.ROOT);
	}

	private String displayName(String email) {
		return email.substring(0, email.indexOf('@'));
	}

	private String cleanDisplayName(String displayName, String email) {
		if (displayName == null || displayName.isBlank()) return displayName(email);
		return displayName.trim();
	}

	private UserRole defaultRegistrationRole() {
		var existingUserCount = jdbcTemplate.queryForObject("select count(*) from app_user", Long.class);
		return existingUserCount != null && existingUserCount == 0 ? UserRole.ADMIN : UserRole.USER;
	}

	private AdminUser adminUser(long userId) {
		var users = jdbcTemplate.query("""
				select u.id, u.email, u.display_name, u.role, u.created_at, count(distinct r.league_id) as registered_league_count,
				       count(distinct owned.id) as owned_league_count
				from app_user u
				left join league_registration r on r.user_id = u.id
				left join league owned on owned.owner_user_id = u.id
				where u.id = ?
				group by u.id, u.email, u.display_name, u.role, u.created_at
				""", this::mapAdminUser, userId);
		if (users.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User was not found.");
		return users.getFirst();
	}

	private long adminCount() {
		var count = jdbcTemplate.queryForObject("select count(*) from app_user where role = 'ADMIN'", Long.class);
		return count == null ? 0 : count;
	}

	private void requireAdmin(CurrentUser currentUser) {
		if (!currentUser.admin()) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Administrator access is required.");
	}

	private boolean emailExists(String email) {
		var existingCount = jdbcTemplate.queryForObject("select count(*) from app_user where email = ?", Long.class, email);
		return existingCount != null && existingCount > 0;
	}

	private String verificationCode() {
		return String.format(Locale.ROOT, "%06d", secureRandom.nextInt(1_000_000));
	}

	private record LoginRow(CurrentUser user, String passwordHash) {
	}

	private record PendingRegistrationRow(String email, String displayName, String passwordHash, String verificationCodeHash, Instant expiresAt) {
	}

	public record PendingRegistration(String email, String message) {
	}

	public record AdminUser(long id, String email, String displayName, UserRole role, String createdAt, long registeredLeagueCount,
			long ownedLeagueCount) {
	}

	public record AdminUserPage(List<AdminUser> items, int page, int size, long totalItems) {
	}
}
