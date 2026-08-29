package com.fantasybroadcast.backend.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "broadcast.security")
public class BroadcastSecurityProperties {
	private boolean leagueRegistrationEnabled = true;
	private boolean developmentEndpointsEnabled = true;
	private String initialAdminEmail = "";
	private String initialAdminPassword = "";

	public boolean isLeagueRegistrationEnabled() { return leagueRegistrationEnabled; }
	public void setLeagueRegistrationEnabled(boolean leagueRegistrationEnabled) { this.leagueRegistrationEnabled = leagueRegistrationEnabled; }
	public boolean isDevelopmentEndpointsEnabled() { return developmentEndpointsEnabled; }
	public void setDevelopmentEndpointsEnabled(boolean developmentEndpointsEnabled) { this.developmentEndpointsEnabled = developmentEndpointsEnabled; }
	public String getInitialAdminEmail() { return initialAdminEmail; }
	public void setInitialAdminEmail(String initialAdminEmail) { this.initialAdminEmail = initialAdminEmail; }
	public String getInitialAdminPassword() { return initialAdminPassword; }
	public void setInitialAdminPassword(String initialAdminPassword) { this.initialAdminPassword = initialAdminPassword; }
}
