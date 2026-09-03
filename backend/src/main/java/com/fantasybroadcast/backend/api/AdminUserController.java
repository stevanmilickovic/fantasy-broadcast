package com.fantasybroadcast.backend.api;

import com.fantasybroadcast.backend.customer.AccountService;
import com.fantasybroadcast.backend.customer.AccountService.AdminUser;
import com.fantasybroadcast.backend.customer.AccountService.AdminUserPage;
import com.fantasybroadcast.backend.customer.SessionService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("db & !test")
@RequestMapping("/api/customer/admin/users")
@CrossOrigin(origins = "${BROADCAST_ALLOWED_ORIGIN:http://localhost:5173}")
public class AdminUserController {

	private final SessionService sessionService;
	private final AccountService accountService;

	public AdminUserController(SessionService sessionService, AccountService accountService) {
		this.sessionService = sessionService;
		this.accountService = accountService;
	}

	@GetMapping
	public AdminUserPage users(HttpServletRequest request,
			@RequestParam(defaultValue = "0") @PositiveOrZero int page,
			@RequestParam(defaultValue = "10") @Positive @Max(100) int size,
			@RequestParam(defaultValue = "") String search) {
		return accountService.allForAdmin(sessionService.require(request), page, size, search);
	}

	@PatchMapping("/{userId}/admin")
	public AdminUser promote(HttpServletRequest request, @PathVariable @Positive long userId) {
		return accountService.promoteToAdmin(sessionService.require(request), userId);
	}

	@DeleteMapping("/{userId}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void delete(HttpServletRequest request, @PathVariable @Positive long userId) {
		accountService.deleteForAdmin(sessionService.require(request), userId);
	}
}
