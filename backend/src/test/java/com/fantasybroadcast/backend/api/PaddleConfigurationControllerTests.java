package com.fantasybroadcast.backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import com.fantasybroadcast.backend.payment.PaddleProperties;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import tools.jackson.databind.ObjectMapper;

class PaddleConfigurationControllerTests {
	@Test
	void anonymousConfigurationExposesOnlyTheBrowserTokenAndIsNotCached() {
		var properties = new PaddleProperties();
		properties.setApiKey("pdl_sdbx_apikey_server-secret");
		properties.setWebhookSecretKey("webhook-secret");
		properties.setClientSideToken("test_public-token");
		properties.setStandardPriceId("pri_standard");
		properties.setAiBroadcasterPriceId("pri_ai");
		var response = new PaddleConfigurationController(properties).configuration();
		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
		assertThat(response.getHeaders().getCacheControl()).isEqualTo("no-store");
		assertThat(new ObjectMapper().writeValueAsString(response.getBody())).isEqualTo("{\"clientSideToken\":\"test_public-token\"}");
	}

	@Test
	void planAvailabilityIsPublicWithoutPaymentCredentialsAndNeverCached() {
		var properties = new PaddleProperties();
		var controller = new PaddleConfigurationController(properties);
		var response = controller.plans();
		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
		assertThat(response.getHeaders().getCacheControl()).isEqualTo("no-store");
		assertThat(response.getBody().aiBroadcasterEnabled()).isFalse();
		properties.setAiBroadcasterEnabled(true);
		assertThat(controller.plans().getBody().aiBroadcasterEnabled()).isTrue();
	}

	@Test
	void unconfiguredCheckoutReturnsAnActionableErrorWithoutLeakingSettings() {
		var response = new PaddleConfigurationController(new PaddleProperties()).configuration();
		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
		assertThat(new ObjectMapper().writeValueAsString(response.getBody())).contains("Payment checkout is currently unavailable").doesNotContain("clientSideToken", "apiKey");
	}
}
