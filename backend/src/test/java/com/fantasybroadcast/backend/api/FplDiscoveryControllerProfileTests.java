package com.fantasybroadcast.backend.api;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;

class FplDiscoveryControllerProfileTests {

	@Test
	void doesNotExposeDevelopmentDiscoveryEndpointsInProduction() {
		new ApplicationContextRunner()
				.withInitializer(context -> context.getEnvironment().setActiveProfiles("production"))
				.withUserConfiguration(FplDiscoveryController.class)
				.run(context -> assertThat(context).doesNotHaveBean(FplDiscoveryController.class));
	}
}
