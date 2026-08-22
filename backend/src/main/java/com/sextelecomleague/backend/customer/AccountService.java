package com.sextelecomleague.backend.customer;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Locale;
import org.springframework.context.annotation.Profile;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
@Profile("db & !test")
public class AccountService {

	private final JdbcTemplate jdbcTemplate;
	private final PasswordHasher passwordHasher;

	public AccountService(JdbcTemplate jdbcTemplate, PasswordHasher passwordHasher) {
		this.jdbcTemplate = jdbcTemplate;
		this.passwordHasher = passwordHasher;
	}

	public CurrentUser register(String email, String password) {
		var normalizedEmail = normalizeEmail(email);
		if (!normalizedEmail.contains("@")) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter a valid email address.");
		try {
			jdbcTemplate.update("insert into app_user (email, display_name, password_hash, role) values (?, ?, ?, 'USER')",
					normalizedEmail, displayName(normalizedEmail), passwordHasher.hash(password));
		}
		catch (DuplicateKeyException exception) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "An account already exists for this email.");
		}
		return findByEmail(normalizedEmail);
	}

	public CurrentUser authenticate(String email, String password) {
		var row = jdbcTemplate.query("select id, email, display_name, role, password_hash from app_user where email = ?", this::mapLogin,
				normalizeEmail(email));
		if (row.isEmpty() || !passwordHasher.matches(password, row.getFirst().passwordHash())) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Email or password is incorrect.");
		}
		return row.getFirst().user();
	}

	public CurrentUser findByEmail(String email) {
		var users = jdbcTemplate.query("select id, email, display_name, role from app_user where email = ?", this::mapUser, email);
		if (users.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found.");
		return users.getFirst();
	}

	public void ensureAdminAccount() {
		var users = jdbcTemplate.query("select id, email, display_name, role from app_user where email = 'admin'", this::mapUser);
		if (users.isEmpty()) {
			jdbcTemplate.update("insert into app_user (email, display_name, password_hash, role) values ('admin', 'Administrator', ?, 'ADMIN')",
					passwordHasher.hash("admin"));
			return;
		}
		jdbcTemplate.update("update app_user set role = 'ADMIN', password_hash = coalesce(password_hash, ?) where email = 'admin'",
				passwordHasher.hash("admin"));
	}

	private LoginRow mapLogin(ResultSet resultSet, int rowNumber) throws SQLException {
		return new LoginRow(mapUser(resultSet, rowNumber), resultSet.getString("password_hash"));
	}

	private CurrentUser mapUser(ResultSet resultSet, int rowNumber) throws SQLException {
		return new CurrentUser(resultSet.getLong("id"), resultSet.getString("email"), resultSet.getString("display_name"),
				UserRole.valueOf(resultSet.getString("role")));
	}

	private String normalizeEmail(String email) {
		return email.trim().toLowerCase(Locale.ROOT);
	}

	private String displayName(String email) {
		return email.substring(0, email.indexOf('@'));
	}

	private record LoginRow(CurrentUser user, String passwordHash) {
	}
}
