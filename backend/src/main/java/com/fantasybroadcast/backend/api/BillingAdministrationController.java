package com.fantasybroadcast.backend.api;

import com.fantasybroadcast.backend.customer.SessionService;
import com.fantasybroadcast.backend.payment.RefundService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.*;

@RestController
@Profile("db & !test")
@RequestMapping("/api/customer/admin/subscriptions")
public class BillingAdministrationController {
	private final SessionService sessions;
	private final RefundService refunds;
	public BillingAdministrationController(SessionService sessions, RefundService refunds) { this.sessions = sessions; this.refunds = refunds; }
	@GetMapping
	public List<RefundService.AdminSubscription> search(HttpServletRequest request, @RequestParam(defaultValue = "") String search) {
		return refunds.search(sessions.require(request), search);
	}
	@GetMapping("/{subscriptionId}/payments")
	public List<RefundService.Payment> payments(HttpServletRequest request, @PathVariable String subscriptionId) {
		return refunds.payments(sessions.require(request), subscriptionId);
	}
	@PostMapping("/{subscriptionId}/refunds")
	public RefundService.Refund refund(HttpServletRequest request, @PathVariable String subscriptionId, @Valid @RequestBody Refund input) {
		return refunds.submit(sessions.require(request), subscriptionId, input.transactionId(), input.requestId(), input.partialAmount(), input.reason(), input.endsAccess());
	}
	public record Refund(@NotNull @Pattern(regexp = "txn_[a-z0-9]+") String transactionId,
			@NotNull @Pattern(regexp = "[0-9a-fA-F-]{36}") String requestId, @Positive Long partialAmount, @NotBlank @Size(min = 5, max = 700) String reason, boolean endsAccess) { }
}
