package com.fantasybroadcast.backend.fpl;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;
import jakarta.validation.constraints.Min;

@Validated
@ConfigurationProperties(prefix = "fpl")
public class FplDraftProperties {

	private String draftBaseUrl = "https://draft.premierleague.com/api";
	private String fantasyBaseUrl = "https://fantasy.premierleague.com/api";
	@Min(1)
	private int timeoutSeconds = 15;
	@Min(1)
	private int cacheTtlSeconds = 3600;

	public String getDraftBaseUrl() {
		return draftBaseUrl;
	}

	public void setDraftBaseUrl(String draftBaseUrl) {
		this.draftBaseUrl = trimTrailingSlash(draftBaseUrl);
	}

	public String getFantasyBaseUrl() {
		return fantasyBaseUrl;
	}

	public void setFantasyBaseUrl(String fantasyBaseUrl) {
		this.fantasyBaseUrl = trimTrailingSlash(fantasyBaseUrl);
	}

	public int getTimeoutSeconds() { return timeoutSeconds; }
	public void setTimeoutSeconds(int timeoutSeconds) { this.timeoutSeconds = timeoutSeconds; }
	public int getCacheTtlSeconds() { return cacheTtlSeconds; }
	public void setCacheTtlSeconds(int cacheTtlSeconds) { this.cacheTtlSeconds = cacheTtlSeconds; }

	private String trimTrailingSlash(String value) {
		if (value == null || value.isBlank()) {
			return value;
		}
		return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
	}
}
