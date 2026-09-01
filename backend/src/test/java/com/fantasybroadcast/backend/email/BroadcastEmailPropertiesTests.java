package com.fantasybroadcast.backend.email;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class BroadcastEmailPropertiesTests {

	@Test
	void staysDisabledUntilBothTheSenderAndPublicBaseUrlAreConfigured() {
		var properties = new BroadcastEmailProperties();

		assertThat(properties.isEnabled()).isFalse();
		properties.setFrom("no-reply@example.com");
		assertThat(properties.isEnabled()).isFalse();
		properties.setPublicBaseUrl("https://preprod.example.com");
		assertThat(properties.isEnabled()).isTrue();
		properties.setEnabled(false);
		assertThat(properties.isEnabled()).isFalse();
	}
}
