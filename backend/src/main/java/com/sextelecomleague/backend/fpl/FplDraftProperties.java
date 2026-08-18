package com.sextelecomleague.backend.fpl;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "fpl")
public class FplDraftProperties {

	private String draftBaseUrl = "https://draft.premierleague.com/api";
	private String fantasyBaseUrl = "https://fantasy.premierleague.com/api";

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

	private String trimTrailingSlash(String value) {
		if (value == null || value.isBlank()) {
			return value;
		}
		return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
	}
}
