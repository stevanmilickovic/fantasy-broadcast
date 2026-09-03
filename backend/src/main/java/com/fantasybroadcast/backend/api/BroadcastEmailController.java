package com.fantasybroadcast.backend.api;

import com.fantasybroadcast.backend.customer.SessionService;
import com.fantasybroadcast.backend.email.BroadcastEmailService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@Profile("db & !test")
@RequestMapping("/api/customer/admin/email")
@CrossOrigin(origins = "${BROADCAST_ALLOWED_ORIGIN:http://localhost:5173}")
public class BroadcastEmailController {

	private final SessionService sessionService;
	private final BroadcastEmailService emailService;

	public BroadcastEmailController(SessionService sessionService, BroadcastEmailService emailService) {
		this.sessionService = sessionService;
		this.emailService = emailService;
	}

	@PostMapping("/test")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void sendTestEmail(HttpServletRequest httpRequest, @Valid @RequestBody TestEmailRequest request) {
		var user = sessionService.require(httpRequest);
		if (!user.admin()) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Administrator access is required.");
		emailService.send(request.to(), "Fantasy Broadcast email test",
				"Email delivery is configured for Fantasy Broadcast.\n\nRequested by " + user.email() + ".");
	}

	public record TestEmailRequest(@NotBlank @Email @Size(max = 320) String to) {
	}
}
