package com.sextelecomleague.backend.customer;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import org.springframework.stereotype.Component;

@Component
public class PasswordHasher {

	private static final int ITERATIONS = 210_000;
	private static final int KEY_LENGTH = 256;
	private final SecureRandom secureRandom = new SecureRandom();

	public String hash(String password) {
		var salt = new byte[16];
		secureRandom.nextBytes(salt);
		return Base64.getEncoder().encodeToString(salt) + ":" + Base64.getEncoder().encodeToString(derive(password, salt));
	}

	public boolean matches(String password, String storedHash) {
		if (storedHash == null || !storedHash.contains(":")) return false;
		var parts = storedHash.split(":", 2);
		var actual = derive(password, Base64.getDecoder().decode(parts[0]));
		var expected = Base64.getDecoder().decode(parts[1]);
		return java.security.MessageDigest.isEqual(actual, expected);
	}

	private byte[] derive(String password, byte[] salt) {
		try {
			var spec = new PBEKeySpec(password.toCharArray(), salt, ITERATIONS, KEY_LENGTH);
			return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
		}
		catch (GeneralSecurityException exception) {
			throw new IllegalStateException("Unable to hash password", exception);
		}
	}
}
