package com.fantasybroadcast.backend.api;

import com.fantasybroadcast.backend.customer.AccountService;
import com.fantasybroadcast.backend.customer.CurrentUser;
import com.fantasybroadcast.backend.customer.SessionService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.http.ResponseCookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import com.fantasybroadcast.backend.security.BroadcastSecurityProperties;

@RestController
@Profile("db & !test")
@RequestMapping("/api/auth")
@CrossOrigin(origins = "${BROADCAST_ALLOWED_ORIGIN:http://localhost:5173}")
public class AuthController {

	private final AccountService accountService;
	private final SessionService sessionService;
	private final BroadcastSecurityProperties securityProperties;

	public AuthController(AccountService accountService, SessionService sessionService, BroadcastSecurityProperties securityProperties) {
		this.accountService = accountService;
		this.sessionService = sessionService;
		this.securityProperties = securityProperties;
	}

	@PostMapping("/register")
	public AuthResponse register(@Valid @RequestBody Credentials credentials, HttpServletResponse response) {
		return authenticated(accountService.register(credentials.email(), credentials.password()), response);
	}

	@PostMapping("/login")
	public AuthResponse login(@Valid @RequestBody Credentials credentials, HttpServletResponse response) {
		return authenticated(accountService.authenticate(credentials.email(), credentials.password()), response);
	}

	@PostMapping("/logout")
	public void logout(HttpServletRequest request, HttpServletResponse response) {
		sessionService.remove(request);
		response.addHeader("Set-Cookie", cookie("").maxAge(0).build().toString());
	}

	@GetMapping("/me")
	public CurrentUser me(HttpServletRequest request) {
		return sessionService.require(request);
	}

	private AuthResponse authenticated(CurrentUser user, HttpServletResponse response) {
		response.addHeader("Set-Cookie", cookie(sessionService.create(user)).maxAge(java.time.Duration.ofDays(7)).build().toString());
		return new AuthResponse(user);
	}

	private ResponseCookie.ResponseCookieBuilder cookie(String value) {
		return ResponseCookie.from(SessionService.COOKIE_NAME, value).httpOnly(true).secure(securityProperties.isSecureCookies())
				.sameSite("Strict").path("/api");
	}

	public record Credentials(@NotBlank @Size(max = 320) String email, @NotBlank @Size(min = 12, max = 200) String password) {
	}

	public record AuthResponse(CurrentUser user) {
	}
}
