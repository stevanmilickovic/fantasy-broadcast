package com.fantasybroadcast.backend.security;

import com.fantasybroadcast.backend.customer.AccountService;
import com.fantasybroadcast.backend.customer.SessionService;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseCookie;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.web.util.UriComponentsBuilder;

@Configuration
@Profile("db & !test")
public class WebSecurityConfig {

	private final AccountService accountService;
	private final SessionService sessionService;
	private final BroadcastSecurityProperties securityProperties;
	private final ObjectProvider<ClientRegistrationRepository> clientRegistrationRepository;

	public WebSecurityConfig(AccountService accountService, SessionService sessionService, BroadcastSecurityProperties securityProperties,
			ObjectProvider<ClientRegistrationRepository> clientRegistrationRepository) {
		this.accountService = accountService;
		this.sessionService = sessionService;
		this.securityProperties = securityProperties;
		this.clientRegistrationRepository = clientRegistrationRepository;
	}

	@Bean
	SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
		http.csrf((csrf) -> csrf.disable())
				.authorizeHttpRequests((requests) -> requests.anyRequest().permitAll());
		if (clientRegistrationRepository.getIfAvailable() != null) {
			http.oauth2Login((oauth2) -> oauth2.successHandler(googleSuccessHandler())
					.failureHandler((request, response, exception) -> response.sendRedirect(frontendUrl("/login?oauth=failed"))));
		}
		return http.build();
	}

	@Bean
	AuthenticationSuccessHandler googleSuccessHandler() {
		return (request, response, authentication) -> {
			if (!(authentication instanceof OAuth2AuthenticationToken token)) {
				response.sendError(HttpServletResponse.SC_UNAUTHORIZED);
				return;
			}
			var attributes = token.getPrincipal().getAttributes();
			var email = String.valueOf(attributes.getOrDefault("email", ""));
			if (email.isBlank()) {
				response.sendError(HttpServletResponse.SC_UNAUTHORIZED);
				return;
			}
			var name = String.valueOf(attributes.getOrDefault("name", ""));
			var user = accountService.findOrCreateGoogleUser(email, name);
			response.addHeader("Set-Cookie", cookie(sessionService.create(user)).maxAge(java.time.Duration.ofDays(7)).build().toString());
			response.sendRedirect(frontendUrl("/"));
		};
	}

	private ResponseCookie.ResponseCookieBuilder cookie(String value) {
		return ResponseCookie.from(SessionService.COOKIE_NAME, value).httpOnly(true).secure(securityProperties.isSecureCookies())
				.sameSite("Strict").path("/api");
	}

	private String frontendUrl(String path) {
		var publicBaseUrl = securityProperties.getPublicBaseUrl();
		if (publicBaseUrl.isBlank()) return "http://localhost:5173" + path;
		return UriComponentsBuilder.fromUriString(publicBaseUrl).replacePath(path).replaceQuery(null).build().toUriString();
	}
}
