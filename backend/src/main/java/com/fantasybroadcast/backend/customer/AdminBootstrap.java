package com.fantasybroadcast.backend.customer;

import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import com.fantasybroadcast.backend.security.BroadcastSecurityProperties;

@Configuration
@Profile("db & !test")
public class AdminBootstrap {

	@Bean
	CommandLineRunner createInitialAdmin(AccountService accountService, BroadcastSecurityProperties securityProperties) {
		return arguments -> {
			if (securityProperties.getInitialAdminEmail().isBlank() || securityProperties.getInitialAdminPassword().isBlank()) return;
			accountService.ensureInitialAdmin(securityProperties.getInitialAdminEmail(), securityProperties.getInitialAdminPassword());
		};
	}
}
