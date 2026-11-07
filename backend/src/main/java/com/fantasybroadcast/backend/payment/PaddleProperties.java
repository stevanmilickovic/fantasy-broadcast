package com.fantasybroadcast.backend.payment;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@ConfigurationProperties(prefix = "paddle")
public class PaddleProperties {
	private String apiKey = ""; private String clientSideToken = ""; private String standardPriceId = ""; private String aiBroadcasterPriceId = ""; private String webhookSecretKey = ""; private String apiUrl = "https://sandbox-api.paddle.com";
	private boolean aiBroadcasterEnabled = false;
	public boolean isAiBroadcasterEnabled() { return aiBroadcasterEnabled; }
	public void setAiBroadcasterEnabled(boolean value) { aiBroadcasterEnabled = value; }
	public void requirePlanAvailable(BillingPlan plan) {
		if (plan == BillingPlan.AI_BROADCASTER && !aiBroadcasterEnabled)
			throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "AI Broadcaster is currently unavailable. Choose Standard instead.");
	}
	public String getApiKey() { return apiKey; } public void setApiKey(String value) { apiKey = value; }
	public String getClientSideToken() { return clientSideToken; } public void setClientSideToken(String value) { clientSideToken = value; }
	public String getStandardPriceId() { return standardPriceId; } public void setStandardPriceId(String value) { standardPriceId = value; }
	public String getAiBroadcasterPriceId() { return aiBroadcasterPriceId; } public void setAiBroadcasterPriceId(String value) { aiBroadcasterPriceId = value; }
	public String getWebhookSecretKey() { return webhookSecretKey; } public void setWebhookSecretKey(String value) { webhookSecretKey = value; }
	public String getApiUrl() { return apiUrl; } public void setApiUrl(String value) { apiUrl = value; }
	public boolean isConfigured() {
		return environmentMatches() && !standardPriceId.isBlank() && (!aiBroadcasterEnabled || !aiBroadcasterPriceId.isBlank()) && isWebhookConfigured();
	}
	private boolean environmentMatches() {
		var sandbox = "https://sandbox-api.paddle.com".equals(apiUrl) && clientSideToken.startsWith("test_") && clientSideToken.length() > 5;
		var live = "https://api.paddle.com".equals(apiUrl) && clientSideToken.startsWith("live_") && clientSideToken.length() > 5;
		// Older Paddle keys have no environment prefix; their account is verified by Paddle itself.
		return (sandbox || live) && (apiKey.startsWith(sandbox ? "pdl_sdbx_apikey_" : "pdl_live_apikey_") || apiKey.matches("[a-z0-9]{50}"));
	}
	public boolean isWebhookConfigured() { return !webhookSecretKey.isBlank(); }
}
