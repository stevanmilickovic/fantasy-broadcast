package com.fantasybroadcast.backend.customer;

import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

@Configuration
@Profile("db & !test")
public class AdminBootstrap {

	@Bean
	CommandLineRunner createInitialAdmin(AccountService accountService) {
		return arguments -> accountService.ensureAdminAccount();
	}
}
