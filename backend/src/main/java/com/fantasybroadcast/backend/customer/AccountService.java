package com.fantasybroadcast.backend.customer;

import java.security.SecureRandom;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import com.fantasybroadcast.backend.security.BroadcastSecurityProperties;
import com.fantasybroadcast.backend.email.BroadcastEmailService;
import org.springframework.context.annotation.Profile;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Profile("db & !test")
public class AccountService {

	private final JdbcTemplate jdbcTemplate;
	private final PasswordHasher passwordHasher;
	private final BroadcastEmailService emailService;
	private final SessionService sessionService;
	private final BroadcastSecurityProperties securityProperties;
	private final SecureRandom secureRandom = new SecureRandom();

	public AccountService(JdbcTemplate jdbcTemplate, PasswordHasher passwordHasher, BroadcastEmailService emailService,
			SessionService sessionService, BroadcastSecurityProperties securityProperties) {
		this.jdbcTemplate = jdbcTemplate;
		this.passwordHasher = passwordHasher;
		this.emailService = emailService;
		this.sessionService = sessionService;
		this.securityProperties = securityProperties;
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
			createAccount(registration.email(), registration.displayName(), registration.passwordHash(), role);
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
		try { createAccount(normalizedEmail, cleanDisplayName(displayName, normalizedEmail), null, role); }
		catch (DuplicateKeyException duplicate) {
			if (!emailExists(normalizedEmail)) throw duplicate;
		}
		return findByEmail(normalizedEmail);
	}

	public CurrentUser findByEmail(String email) {
		var users = jdbcTemplate.query("select id, email, display_name, role from app_user where email = ?", this::mapUser, email);
		if (users.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found.");
		return users.getFirst();
	}

	public CurrentUser updateDisplayName(CurrentUser user, String displayName) {
		var name = Usernames.normalize(displayName);
		if (name.isBlank() || name.codePointCount(0, name.length()) > 40 || name.codePoints().anyMatch(Character::isISOControl))
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Username must contain 1–40 characters without control characters.");
		try {
			if (jdbcTemplate.update("update app_user set display_name = ?, username_key = ?, updated_at = current_timestamp where id = ?", name, Usernames.key(name), user.id()) == 0)
				throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Account was not found.");
		} catch (DuplicateKeyException duplicate) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "That username is already taken. Choose another username.");
		}
		var updated = findByEmail(user.email());
		sessionService.refreshUser(updated);
		return updated;
	}

	public AccountDeletionRequest requestDeletion(CurrentUser user) {
		jdbcTemplate.update("insert ignore into account_deletion_request (user_id) values (?)", user.id());
		return new AccountDeletionRequest("Your account-deletion request has been received. We will review it, including any active subscription, before deleting your account.");
	}

	public AdminUserPage allForAdmin(CurrentUser currentUser, int page, int size, String search) {
		requireAdmin(currentUser);
		var searchTerm = search == null ? "" : search.trim();
		var total = jdbcTemplate.queryForObject("""
				select count(*) from app_user
				where cast(id as char(32)) = ? or lower(display_name) like concat('%', lower(?), '%')
				""", Long.class, searchTerm, searchTerm);
		var users = jdbcTemplate.query("""
				select u.id, u.email, u.display_name, u.role, u.created_at, count(distinct r.league_id) as registered_league_count,
				       count(distinct owned.id) as owned_league_count
				from (
					select id, email, display_name, role, created_at
					from app_user
					where cast(id as char(32)) = ? or lower(display_name) like concat('%', lower(?), '%')
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
		if (securityProperties.isExclusiveInitialAdmin()) {
			var targets = jdbcTemplate.queryForList("select email from app_user where id = ?", String.class, userId);
			if (targets.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User was not found.");
			var target = targets.getFirst();
			if (!target.equalsIgnoreCase(securityProperties.getInitialAdminEmail().trim())) {
				throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This environment permits only its configured administrator.");
			}
		}
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
		var liveSubscriptions = jdbcTemplate.queryForObject("select count(*) from subscription s join league l on l.id = s.league_id where l.owner_user_id = ? and s.status <> 'canceled'", Integer.class, userId);
		if (liveSubscriptions != null && liveSubscriptions > 0)
			throw new ResponseStatusException(HttpStatus.CONFLICT, "End this user's subscriptions in billing before deleting their account. Deleting an account does not cancel Paddle payments.");
		var unresolvedCheckout = jdbcTemplate.queryForObject("select count(*) from billing_checkout c where c.user_id = ? and (c.transaction_id is null or not exists (select 1 from billing_payment p where p.transaction_id = c.transaction_id))", Integer.class, userId);
		if (unresolvedCheckout != null && unresolvedCheckout > 0)
			throw new ResponseStatusException(HttpStatus.CONFLICT, "Resolve this user's pending checkout in Paddle before deleting their account.");
		jdbcTemplate.update("delete from billing_checkout where user_id = ?", userId);
		jdbcTemplate.update("delete from league where owner_user_id = ?", userId);
		jdbcTemplate.update("delete from league_registration where user_id = ?", userId);
		jdbcTemplate.update("delete from pending_user_registration where email = ?", users.getFirst().email());
		jdbcTemplate.update("delete from app_user where id = ?", userId);
	}

	@Transactional
	public void ensureInitialAdmin(String email, String password) {
		var existingAdminCount = jdbcTemplate.queryForObject("select count(*) from app_user where role = 'ADMIN'", Long.class);
		if (!securityProperties.isExclusiveInitialAdmin() && existingAdminCount != null && existingAdminCount > 0) return;
		var normalizedEmail = normalizeEmail(email);
		if (securityProperties.isExclusiveInitialAdmin()) {
			jdbcTemplate.update("update app_user set role = 'USER', updated_at = current_timestamp where role = 'ADMIN' and email <> ?", normalizedEmail);
		}
		var users = jdbcTemplate.query("select id, email, display_name, role from app_user where email = ?", this::mapUser, normalizedEmail);
		if (users.isEmpty()) {
			createAccount(normalizedEmail, displayName(normalizedEmail), passwordHasher.hash(password), UserRole.ADMIN);
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
		return new AdminUser(resultSet.getLong("id"), resultSet.getString("display_name"),
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

	private void createAccount(String email, String defaultName, String passwordHash, UserRole role) {
		var base = Usernames.normalize(defaultName).replaceAll("\\p{Cc}", "");
		if (base.isBlank() || base.contains("@")) base = "Manager";
		base = Usernames.shorten(base, Usernames.MAX_LENGTH);
		for (int attempt = 0; attempt < 10; attempt++) {
			var suffix = attempt == 0 ? "" : "_" + randomToken().substring(0, 8);
			var name = Usernames.shorten(base, Usernames.MAX_LENGTH - suffix.length()) + suffix;
			try {
				jdbcTemplate.update("insert into app_user (email, display_name, username_key, password_hash, role) values (?, ?, ?, ?, ?)",
						email, name, Usernames.key(name), passwordHash, role.name());
				return;
			} catch (DuplicateKeyException duplicate) {
				if (emailExists(email)) throw duplicate;
			}
		}
		throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Could not assign a username. Please try again.");
	}

	private UserRole defaultRegistrationRole() {
		if (securityProperties.isExclusiveInitialAdmin()) return UserRole.USER;
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

	private String randomToken() {
		var bytes = new byte[32];
		secureRandom.nextBytes(bytes);
		return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
	}

	private record LoginRow(CurrentUser user, String passwordHash) {
	}

	private record PendingRegistrationRow(String email, String displayName, String passwordHash, String verificationCodeHash, Instant expiresAt) {
	}

	public record PendingRegistration(String email, String message) {
	}

	public record AccountDeletionRequest(String message) {
	}

	public record AdminUser(long id, String displayName, UserRole role, String createdAt, long registeredLeagueCount,
			long ownedLeagueCount) {
	}

	public record AdminUserPage(List<AdminUser> items, int page, int size, long totalItems) {
	}
}
