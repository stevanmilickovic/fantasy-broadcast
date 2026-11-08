package com.fantasybroadcast.backend.api;

import com.fantasybroadcast.backend.customer.AccountService;
import com.fantasybroadcast.backend.customer.AccountService.PendingRegistration;
import com.fantasybroadcast.backend.customer.PasswordSecurityService;
import com.fantasybroadcast.backend.customer.PasswordSecurityService.PasswordResetRequest;
import com.fantasybroadcast.backend.customer.AccountService.AccountDeletionRequest;
import com.fantasybroadcast.backend.customer.CurrentUser;
import com.fantasybroadcast.backend.customer.SessionService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Profile;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
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
	private final PasswordSecurityService passwords;
	private final String allowedOrigin;
	private final BroadcastSecurityProperties securityProperties;
	private final ObjectProvider<ClientRegistrationRepository> clientRegistrationRepository;

	public AuthController(AccountService accountService, SessionService sessionService, BroadcastSecurityProperties securityProperties,
			ObjectProvider<ClientRegistrationRepository> clientRegistrationRepository, PasswordSecurityService passwords,
			@org.springframework.beans.factory.annotation.Value("${BROADCAST_ALLOWED_ORIGIN:http://localhost:5173}") String allowedOrigin) {
		this.accountService = accountService;
		this.sessionService = sessionService;
		this.securityProperties = securityProperties;
		this.clientRegistrationRepository = clientRegistrationRepository;
		this.passwords = passwords;
		this.allowedOrigin = allowedOrigin;
	}

	@GetMapping("/options")
	public AuthOptions options() {
		return new AuthOptions(clientRegistrationRepository.getIfAvailable() != null);
	}

	@PostMapping("/register")
	public PendingRegistration register(@Valid @RequestBody Credentials credentials) {
		return accountService.register(credentials.email(), credentials.password());
	}

	@PostMapping("/register/verify")
	public AuthResponse verifyRegistration(@Valid @RequestBody VerificationCredentials credentials, HttpServletResponse response) {
		return authenticated(accountService.verifyRegistration(credentials.email(), credentials.code()), response);
	}

	@PostMapping("/login")
	public AuthResponse login(@Valid @RequestBody LoginCredentials credentials, HttpServletResponse response) {
		return authenticated(accountService.authenticate(credentials.email(), credentials.password()), response);
	}

	@PostMapping("/password/forgot")
	public PasswordResetRequest forgotPassword(@Valid @RequestBody ForgotPasswordRequest input, HttpServletRequest request) {
		requirePasswordOrigin(request);
		return passwords.forgot(input.email(), request.getRemoteAddr());
	}

	@PostMapping("/password/reset")
	public void resetPassword(@Valid @RequestBody ResetPasswordRequest input, HttpServletRequest request, HttpServletResponse response) {
		requirePasswordOrigin(request);
		passwords.reset(input.token(), input.password(), request.getRemoteAddr());
		response.addHeader("Set-Cookie", cookie("").maxAge(0).build().toString());
	}

	@GetMapping("/password/capability")
	public PasswordSecurityService.Capability passwordCapability(HttpServletRequest request) {
		return passwords.capability(sessionService.require(request));
	}

	@PostMapping("/password/change")
	public void changePassword(@Valid @RequestBody ChangePasswordRequest input, HttpServletRequest request, HttpServletResponse response) {
		requirePasswordOrigin(request);
		passwords.change(sessionService.require(request), input.currentPassword(), input.password());
		response.addHeader("Set-Cookie", cookie("").maxAge(0).build().toString());
	}

	private void requirePasswordOrigin(HttpServletRequest request) {
		var origin = request.getHeader("Origin");
		var requestOrigin = java.net.URI.create(request.getRequestURL().toString()).resolve("/").toString();
		var publicOrigin = securityProperties.getPublicBaseUrl();
		if (publicOrigin.isBlank()) publicOrigin = allowedOrigin;
		publicOrigin = java.net.URI.create(publicOrigin).resolve("/").toString();
		if (origin == null || !(origin.concat("/").equals(publicOrigin) || origin.concat("/").equals(requestOrigin)))
			throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.FORBIDDEN, "A trusted browser origin is required.");
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

	@org.springframework.web.bind.annotation.PatchMapping("/me")
	public CurrentUser updateProfile(HttpServletRequest request, @Valid @RequestBody ProfileRequest profile) {
		return accountService.updateDisplayName(sessionService.require(request), profile.displayName());
	}

	public record ProfileRequest(@NotBlank @Size(max = 160) String displayName) { }

	@PostMapping("/account-deletion-request")
	public AccountDeletionRequest requestAccountDeletion(HttpServletRequest request) {
		return accountService.requestDeletion(sessionService.require(request));
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

	public record VerificationCredentials(@NotBlank @Size(max = 320) String email, @NotBlank @Size(min = 6, max = 20) String code) {
	}

	public record ForgotPasswordRequest(@NotBlank @Size(max = 320) String email) {
	}

	public record ResetPasswordRequest(@NotBlank @Size(max = 200) String token,
			@NotBlank @Size(min = 12, max = 200) String password) {
	}
	public record ChangePasswordRequest(@NotBlank @Size(max = 200) String currentPassword,
			@NotBlank @Size(min = 12, max = 200) String password) { }

	/** Existing accounts keep their configured passwords; new registrations require the stronger minimum. */
	public record LoginCredentials(@NotBlank @Size(max = 320) String email, @NotBlank @Size(min = 5, max = 200) String password) {
	}

	public record AuthResponse(CurrentUser user) {
	}

	public record AuthOptions(boolean googleSignInEnabled) {
	}
}
