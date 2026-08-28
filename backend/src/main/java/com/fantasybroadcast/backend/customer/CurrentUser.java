package com.fantasybroadcast.backend.customer;

public record CurrentUser(long id, String email, String displayName, UserRole role) {

	public boolean admin() {
		return role == UserRole.ADMIN;
	}
}
