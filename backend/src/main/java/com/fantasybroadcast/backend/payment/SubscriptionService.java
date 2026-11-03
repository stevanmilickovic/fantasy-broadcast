package com.fantasybroadcast.backend.payment;

import com.fantasybroadcast.backend.customer.CurrentUser;
import com.fantasybroadcast.backend.customer.LeagueRegistrationService;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;

@Service
@Profile("db & !test")
public class SubscriptionService {
	private final BillingRepository repository;
	private final PaddleClient paddle;
	private final PaddleProperties properties;
	private final SubscriptionSyncService sync;
	private final LeagueRegistrationService leagues;
	private final BillingOperations operations;

	public SubscriptionService(BillingRepository repository, PaddleClient paddle, PaddleProperties properties, SubscriptionSyncService sync,
			LeagueRegistrationService leagues, BillingOperations operations) {
		this.repository = repository;
		this.paddle = paddle;
		this.properties = properties;
		this.sync = sync;
		this.leagues = leagues;
		this.operations = operations;
	}

	public Summary summary(CurrentUser user, long leagueId, boolean refresh) {
		var subscription = requireOwner(user, leagueId);
		JsonNode provider = null;
		if (subscription != null && refresh) {
			provider = sync.refresh(subscription.id(), true);
			subscription = repository.find(subscription.id());
		}
		if (subscription == null) return new Summary(false, null, null, null, null, null, null, false, null, false, null, null);
		var initial = repository.payments(subscription.id()).stream().filter(payment -> !payment.path("origin").asText().startsWith("subscription_")).findFirst().orElse(null);
		var refundUntil = initial == null ? null : BillingRepository.paymentTime(initial).plus(Duration.ofDays(14));
		return new Summary(true, subscription.id(), subscription.effectivePlan(Instant.now()), subscription.renewalPlan(), subscription.status(),
				subscription.accessUntil(), subscription.cancelAt(), subscription.accessible(Instant.now()), refundUntil,
				operations.pending("subscription:" + subscription.id()), provider == null ? null : provider.path("currency_code").asText(null),
				provider == null ? null : provider.path("recurring_transaction_details").path("totals").path("grand_total").asText(null));
	}

	public ChangePreview preview(CurrentUser user, long leagueId, BillingPlan target) {
		properties.requirePlanAvailable(target);
		var subscription = requireSubscription(user, leagueId);
		var provider = sync.refresh(subscription.id());
		subscription = repository.find(subscription.id());
		requireEditable(subscription, provider);
		if (target == subscription.renewalPlan()) throw conflict("This is already your renewal plan.");
		var immediateUpgrade = target == BillingPlan.AI_BROADCASTER && subscription.effectivePlan(Instant.now()) != BillingPlan.AI_BROADCASTER;
		var result = paddle.patch("/subscriptions/" + subscription.id() + "/preview", changeBody(target, immediateUpgrade));
		var immediate = result.path("immediate_transaction");
		var next = result.path("recurring_transaction_details");
		return new ChangePreview(target, subscription.version(), immediateUpgrade ? Instant.now() : subscription.periodEnd(),
				immediate.path("details").path("totals").path("grand_total").asText("0"),
				result.path("currency_code").asText(provider.path("currency_code").asText()),
				next.path("totals").path("grand_total").asText(""), immediateUpgrade);
	}

	public Summary change(CurrentUser user, long leagueId, BillingPlan target, Instant expectedVersion, String requestId) {
		properties.requirePlanAvailable(target);
		var subscription = requireSubscription(user, leagueId);
		var id = subscription.id();
		operations.run(requestId, "subscription:" + id, user.id(), Map.of("target", target, "version", expectedVersion.toString()), () -> {
			var provider = sync.refresh(id);
			var current = repository.find(id);
			requireEditable(current, provider);
			if (!expectedVersion.equals(current.version())) throw conflict("Subscription details changed. Review a fresh price preview before confirming.");
			if (target == current.renewalPlan()) throw conflict("This is already your renewal plan.");
			var upgrade = target == BillingPlan.AI_BROADCASTER && current.effectivePlan(Instant.now()) != BillingPlan.AI_BROADCASTER;
			if (target == BillingPlan.STANDARD) repository.retainAi(id, current.periodEnd());
			var result = paddle.patch("/subscriptions/" + id, changeBody(target, upgrade));
			sync.acceptSubscription(result);
			return result;
		});
		return summary(user, leagueId, false);
	}

	public Summary cancel(CurrentUser user, long leagueId, boolean undo, String requestId) {
		var subscription = requireSubscription(user, leagueId);
		operations.run(requestId, "subscription:" + subscription.id(), user.id(), Map.of("undo", undo), () -> {
			var provider = sync.refresh(subscription.id());
			var current = repository.find(subscription.id());
			if (!List.of("active", "past_due").contains(current.status())) throw conflict("This subscription has already ended.");
			if (undo && !provider.path("scheduled_change").path("action").asText().equals("cancel")) return provider;
			if (!undo && provider.path("scheduled_change").path("action").asText().equals("cancel")) return provider;
			JsonNode result;
			if (undo) {
				var body = new HashMap<String, Object>();
				body.put("scheduled_change", null);
				result = paddle.patch("/subscriptions/" + subscription.id(), body);
			} else result = paddle.post("/subscriptions/" + subscription.id() + "/cancel", Map.of("effective_from", "next_billing_period"));
			sync.acceptSubscription(result);
			return result;
		});
		return summary(user, leagueId, false);
	}

	public String portal(CurrentUser user, long leagueId) {
		var subscription = requireSubscription(user, leagueId);
		return paddle.post("/customers/" + subscription.customerId() + "/portal-sessions", Map.of("subscription_ids", List.of(subscription.id())))
				.path("urls").path("general").path("overview").asText();
	}

	public void requireBroadcastAccess(CurrentUser user, long leagueId) {
		var league = leagues.accessibleLeague(user, leagueId);
		var subscription = repository.forLeague(leagueId);
		if (!league.serviceEnabled() || (subscription != null && !subscription.accessible(Instant.now())))
			throw new ResponseStatusException(HttpStatus.PAYMENT_REQUIRED, "This league subscription is not active. Its owner can manage the subscription from the league page.");
	}

	private BillingRepository.Subscription requireOwner(CurrentUser user, long leagueId) {
		var league = leagues.accessibleLeague(user, leagueId);
		if (league.ownerUserId() != user.id()) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the purchasing league owner can manage billing.");
		return repository.forLeague(leagueId);
	}
	private BillingRepository.Subscription requireSubscription(CurrentUser user, long leagueId) {
		var subscription = requireOwner(user, leagueId);
		if (subscription == null) throw conflict("No Paddle subscription is linked to this league. Contact support.");
		return subscription;
	}
	private void requireEditable(BillingRepository.Subscription subscription, JsonNode provider) {
		if (!subscription.status().equals("active") || !subscription.accessible(Instant.now())) throw conflict("Resolve the subscription payment before changing plans.");
		if (!provider.path("scheduled_change").isNull() && !provider.path("scheduled_change").isMissingNode()) throw conflict("Undo the pending cancellation before changing plans.");
		var renewal = BillingRepository.instant(provider, "next_billed_at");
		if (renewal != null && renewal.isBefore(Instant.now().plus(Duration.ofMinutes(30)))) throw conflict("Renewal is being processed. Try changing plans after it completes.");
	}
	private Map<String, Object> changeBody(BillingPlan target, boolean immediateUpgrade) {
		return Map.of("items", List.of(Map.of("price_id", target.price(properties), "quantity", 1)),
				"proration_billing_mode", immediateUpgrade ? "prorated_immediately" : "do_not_bill", "on_payment_failure", "prevent_change");
	}
	private ResponseStatusException conflict(String message) { return new ResponseStatusException(HttpStatus.CONFLICT, message); }

	public record Summary(boolean linked, String subscriptionId, BillingPlan plan, BillingPlan renewalPlan, String status,
			Instant accessUntil, Instant cancelAt, boolean accessActive, Instant refundUntil, boolean awaitingConfirmation, String currencyCode, String renewalTotal) { }
	public record ChangePreview(BillingPlan target, Instant version, Instant effectiveAt, String chargeNow, String currencyCode, String renewalTotal, boolean immediate) { }
}
