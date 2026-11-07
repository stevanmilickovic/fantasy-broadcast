package com.fantasybroadcast.backend.payment;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class PaddlePropertiesTests {
	@ParameterizedTest
	@CsvSource({
		"test_token,pdl_sdbx_apikey_test,https://sandbox-api.paddle.com,true",
		"live_token,pdl_live_apikey_test,https://api.paddle.com,true",
		"live_token,pdl_live_apikey_test,https://sandbox-api.paddle.com,false",
		"test_token,pdl_sdbx_apikey_test,https://api.paddle.com,false",
		"test_token,pdl_live_apikey_test,https://sandbox-api.paddle.com,false",
		"live_token,pdl_sdbx_apikey_test,https://api.paddle.com,false",
		"invalid_token,pdl_live_apikey_test,https://api.paddle.com,false",
		"test_token,pdl_sdbx_apikey_test,https://example.com,false",
		"test_token,pdl_sdbx_apikey_test,http://sandbox-api.paddle.com,false"
	})
	void onlyMatchingCredentialsAndOfficialEndpointsEnableCheckout(String token, String key, String url, boolean configured) {
		var properties = new PaddleProperties();
		properties.setClientSideToken(token);
		properties.setApiKey(key);
		properties.setApiUrl(url);
		properties.setStandardPriceId("pri_standard");
		properties.setWebhookSecretKey("secret");
		assertThat(properties.isConfigured()).isEqualTo(configured);
	}

	@Test
	void missingBillingSettingsDoNotDisableWebhookVerification() {
		var properties = new PaddleProperties();
		properties.setWebhookSecretKey("secret");
		assertThat(properties.isWebhookConfigured()).isTrue();
		assertThat(properties.isConfigured()).isFalse();
	}

	@Test
	void legacyKeysRemainSupportedWithoutGuessingTheirEnvironment() {
		var properties = new PaddleProperties();
		properties.setApiKey("a".repeat(50));
		properties.setClientSideToken("live_token");
		properties.setApiUrl("https://api.paddle.com");
		properties.setStandardPriceId("pri_standard");
		properties.setWebhookSecretKey("secret");
		assertThat(properties.isConfigured()).isTrue();
		properties.setApiUrl("https://sandbox-api.paddle.com");
		assertThat(properties.isConfigured()).isFalse();
	}
}
