package com.fantasybroadcast.backend.payment;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "paddle")
public class PaddleProperties {
	private String apiKey = ""; private String clientSideToken = ""; private String standardPriceId = ""; private String aiBroadcasterPriceId = ""; private String webhookSecretKey = ""; private String apiUrl = "https://sandbox-api.paddle.com";
	public String getApiKey() { return apiKey; } public void setApiKey(String value) { apiKey = value; }
	public String getClientSideToken() { return clientSideToken; } public void setClientSideToken(String value) { clientSideToken = value; }
	public String getStandardPriceId() { return standardPriceId; } public void setStandardPriceId(String value) { standardPriceId = value; }
	public String getAiBroadcasterPriceId() { return aiBroadcasterPriceId; } public void setAiBroadcasterPriceId(String value) { aiBroadcasterPriceId = value; }
	public String getWebhookSecretKey() { return webhookSecretKey; } public void setWebhookSecretKey(String value) { webhookSecretKey = value; }
	public String getApiUrl() { return apiUrl; } public void setApiUrl(String value) { apiUrl = value; }
	public boolean isConfigured() { return !apiKey.isBlank() && !clientSideToken.isBlank() && !standardPriceId.isBlank() && !aiBroadcasterPriceId.isBlank() && isWebhookConfigured(); }
	public boolean isWebhookConfigured() { return !webhookSecretKey.isBlank(); }
}
