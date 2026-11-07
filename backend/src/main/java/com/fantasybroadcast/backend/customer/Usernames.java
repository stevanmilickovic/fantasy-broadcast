package com.fantasybroadcast.backend.customer;

import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.Locale;

/** Shared by account writes and the existing-name migration. */
public final class Usernames {
	public static final int MAX_LENGTH = 40;
	private Usernames() { }

	public static String normalize(String name) {
		return Normalizer.normalize(name == null ? "" : name, Normalizer.Form.NFKC).strip();
	}

	public static byte[] key(String name) {
		return normalize(name).toLowerCase(Locale.ROOT).getBytes(StandardCharsets.UTF_8);
	}

	public static String shorten(String name, int length) {
		return name.substring(0, name.offsetByCodePoints(0, Math.min(length, name.codePointCount(0, name.length()))));
	}
}
