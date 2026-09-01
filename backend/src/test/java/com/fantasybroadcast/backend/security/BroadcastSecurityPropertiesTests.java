package com.fantasybroadcast.backend.security;

import static org.assertj.core.api.Assertions.assertThat;

import com.fantasybroadcast.backend.customer.CurrentUser;
import com.fantasybroadcast.backend.customer.UserRole;
import org.junit.jupiter.api.Test;

class BroadcastSecurityPropertiesTests {

	@Test
	void keepsLeagueRegistrationAvailableToAdministratorsWhenPublicRegistrationIsClosed() {
		var properties = new BroadcastSecurityProperties();
		properties.setLeagueRegistrationEnabled(false);

		assertThat(properties.canRegisterLeague(new CurrentUser(1, "user@example.com", "User", UserRole.USER))).isFalse();
		assertThat(properties.canRegisterLeague(new CurrentUser(2, "admin@example.com", "Admin", UserRole.ADMIN))).isTrue();
	}
}
