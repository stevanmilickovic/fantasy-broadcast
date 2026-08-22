package com.sextelecomleague.backend.api;

import com.sextelecomleague.backend.customer.AccountService;
import com.sextelecomleague.backend.customer.CurrentUser;
import com.sextelecomleague.backend.customer.SessionService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("db & !test")
@RequestMapping("/api/auth")
@CrossOrigin(origins = "http://localhost:5173")
public class AuthController {

	private final AccountService accountService;
	private final SessionService sessionService;

	public AuthController(AccountService accountService, SessionService sessionService) {
		this.accountService = accountService;
		this.sessionService = sessionService;
	}

	@PostMapping("/register")
	public AuthResponse register(@Valid @RequestBody Credentials credentials) {
		return authenticated(accountService.register(credentials.email(), credentials.password()));
	}

	@PostMapping("/login")
	public AuthResponse login(@Valid @RequestBody Credentials credentials) {
		return authenticated(accountService.authenticate(credentials.email(), credentials.password()));
	}

	@PostMapping("/logout")
	public void logout(@RequestHeader(value = "Authorization", required = false) String authorization) {
		sessionService.remove(authorization);
	}

	@GetMapping("/me")
	public CurrentUser me(@RequestHeader("Authorization") String authorization) {
		return sessionService.require(authorization);
	}

	private AuthResponse authenticated(CurrentUser user) {
		return new AuthResponse(sessionService.create(user), user);
	}

	public record Credentials(@NotBlank @Size(max = 320) String email, @NotBlank @Size(min = 5, max = 200) String password) {
	}

	public record AuthResponse(String token, CurrentUser user) {
	}
}
