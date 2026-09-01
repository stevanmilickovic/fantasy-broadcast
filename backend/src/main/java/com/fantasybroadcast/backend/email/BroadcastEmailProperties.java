package com.fantasybroadcast.backend.email;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "broadcast.email")
public class BroadcastEmailProperties {
	private boolean enabled = true;
	private String from = "";
	private String publicBaseUrl = "";

	public boolean isEnabled() {
		return enabled && !from.isBlank() && !publicBaseUrl.isBlank();
	}

	public void setEnabled(boolean enabled) { this.enabled = enabled; }
	public String getFrom() { return from; }
	public void setFrom(String from) { this.from = from == null ? "" : from.trim(); }
	public String getPublicBaseUrl() { return publicBaseUrl; }
	public void setPublicBaseUrl(String publicBaseUrl) { this.publicBaseUrl = publicBaseUrl == null ? "" : publicBaseUrl.trim(); }
}
