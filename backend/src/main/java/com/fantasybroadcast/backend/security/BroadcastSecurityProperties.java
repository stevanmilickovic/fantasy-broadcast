package com.fantasybroadcast.backend.security;

import com.fantasybroadcast.backend.customer.CurrentUser;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "broadcast.security")
public class BroadcastSecurityProperties {
	private boolean leagueRegistrationEnabled = true;
	private boolean developmentEndpointsEnabled = true;
	private boolean secureCookies;
	private boolean exclusiveInitialAdmin;
	private String initialAdminEmail = "";
	private String initialAdminPassword = "";
	private String publicBaseUrl = "";

	public boolean isLeagueRegistrationEnabled() { return leagueRegistrationEnabled; }
	public void setLeagueRegistrationEnabled(boolean leagueRegistrationEnabled) { this.leagueRegistrationEnabled = leagueRegistrationEnabled; }
	public boolean canRegisterLeague(CurrentUser user) { return user != null && (user.admin() || leagueRegistrationEnabled); }
	public boolean isDevelopmentEndpointsEnabled() { return developmentEndpointsEnabled; }
	public void setDevelopmentEndpointsEnabled(boolean developmentEndpointsEnabled) { this.developmentEndpointsEnabled = developmentEndpointsEnabled; }
	public boolean isSecureCookies() { return secureCookies; }
	public void setSecureCookies(boolean secureCookies) { this.secureCookies = secureCookies; }
	public boolean isExclusiveInitialAdmin() { return exclusiveInitialAdmin; }
	public void setExclusiveInitialAdmin(boolean exclusiveInitialAdmin) { this.exclusiveInitialAdmin = exclusiveInitialAdmin; }
	public String getInitialAdminEmail() { return initialAdminEmail; }
	public void setInitialAdminEmail(String initialAdminEmail) { this.initialAdminEmail = initialAdminEmail; }
	public String getInitialAdminPassword() { return initialAdminPassword; }
	public void setInitialAdminPassword(String initialAdminPassword) { this.initialAdminPassword = initialAdminPassword; }
	public String getPublicBaseUrl() { return publicBaseUrl; }
	public void setPublicBaseUrl(String publicBaseUrl) { this.publicBaseUrl = publicBaseUrl == null ? "" : publicBaseUrl.trim(); }
}
