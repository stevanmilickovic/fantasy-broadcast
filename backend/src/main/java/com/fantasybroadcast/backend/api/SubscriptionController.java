package com.fantasybroadcast.backend.api;

import com.fantasybroadcast.backend.customer.SessionService;
import com.fantasybroadcast.backend.payment.BillingPlan;
import com.fantasybroadcast.backend.payment.SubscriptionService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.*;

@RestController
@Profile("db & !test")
@RequestMapping("/api/customer")
public class SubscriptionController {
	private static final String LEAGUE_SUBSCRIPTION = "/leagues/{leagueId}/subscription";
	private final SessionService sessions;
	private final SubscriptionService subscriptions;
	public SubscriptionController(SessionService sessions, SubscriptionService subscriptions) { this.sessions = sessions; this.subscriptions = subscriptions; }

	@GetMapping("/subscriptions")
	public List<SubscriptionService.Overview> overview(HttpServletRequest request) {
		return subscriptions.overview(sessions.require(request));
	}

	@GetMapping(LEAGUE_SUBSCRIPTION)
	public SubscriptionService.Summary summary(HttpServletRequest request, @PathVariable long leagueId, @RequestParam(defaultValue = "false") boolean refresh) {
		return subscriptions.summary(sessions.require(request), leagueId, refresh);
	}
	@PostMapping(LEAGUE_SUBSCRIPTION + "/preview")
	public SubscriptionService.ChangePreview preview(HttpServletRequest request, @PathVariable long leagueId, @Valid @RequestBody Preview input) {
		return subscriptions.preview(sessions.require(request), leagueId, input.target());
	}
	@PostMapping(LEAGUE_SUBSCRIPTION + "/plan")
	public SubscriptionService.Summary change(HttpServletRequest request, @PathVariable long leagueId, @Valid @RequestBody Change input) {
		return subscriptions.change(sessions.require(request), leagueId, input.target(), input.version(), input.requestId());
	}
	@PostMapping(LEAGUE_SUBSCRIPTION + "/cancel")
	public SubscriptionService.Summary cancel(HttpServletRequest request, @PathVariable long leagueId, @Valid @RequestBody Cancellation input) {
		return subscriptions.cancel(sessions.require(request), leagueId, input.undo(), input.requestId());
	}
	@PostMapping(LEAGUE_SUBSCRIPTION + "/portal")
	public Map<String, String> portal(HttpServletRequest request, @PathVariable long leagueId) {
		return Map.of("url", subscriptions.portal(sessions.require(request), leagueId));
	}
	public record Preview(@NotNull BillingPlan target) { }
	public record Change(@NotNull BillingPlan target, @NotNull Instant version, @NotNull @Pattern(regexp = "[0-9a-fA-F-]{36}") String requestId) { }
	public record Cancellation(boolean undo, @NotNull @Pattern(regexp = "[0-9a-fA-F-]{36}") String requestId) { }
}
