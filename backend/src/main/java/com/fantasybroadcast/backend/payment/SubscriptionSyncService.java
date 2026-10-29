package com.fantasybroadcast.backend.payment;

import com.fantasybroadcast.backend.customer.LeagueRegistrationService;
import com.fantasybroadcast.backend.live.MockLiveStateService;
import java.time.Instant;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

@Service
@Profile("db & !test")
public class SubscriptionSyncService {
	private final BillingRepository repository;
	private final PaddleClient paddle;
	private final PaddleProperties properties;
	private final PaddleCheckoutService checkouts;
	private final LeagueRegistrationService leagues;
	private final MockLiveStateService broadcasts;
	private final BillingOperations operations;

	public SubscriptionSyncService(BillingRepository repository, PaddleClient paddle, PaddleProperties properties,
			PaddleCheckoutService checkouts, LeagueRegistrationService leagues, MockLiveStateService broadcasts, BillingOperations operations) {
		this.repository = repository;
		this.paddle = paddle;
		this.properties = properties;
		this.checkouts = checkouts;
		this.leagues = leagues;
		this.broadcasts = broadcasts;
		this.operations = operations;
	}

	public JsonNode refresh(String subscriptionId) {
		return refresh(subscriptionId, false);
	}

	public JsonNode refresh(String subscriptionId, boolean includePrice) {
		var data = paddle.get("/subscriptions/" + subscriptionId + (includePrice ? "?include=recurring_transaction_details" : ""));
		acceptSubscription(data);
		return data;
	}

	public void acceptSubscription(JsonNode data) {
		var current = repository.find(data.path("id").asText());
		var purchase = current == null ? checkouts.verifyPurchase(data) : null;
		if (current == null && purchase == null) return;
		var plan = BillingPlan.fromPrice(data.path("items").path(0).path("price").path("id").asText(), properties);
		if (data.path("items").size() != 1 || data.path("items").path(0).path("quantity").asInt() != 1)
			throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT, "Unexpected subscription items. Contact support.");
		long leagueId;
		if (current == null) {
			var league = leagues.registerPurchase(purchase.userId(), purchase.fplLeagueId(), purchase.leagueType());
			if (league.ownerUserId() != purchase.userId())
				throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT, "This league belongs to another purchaser. Contact support.");
			leagueId = league.id();
		} else leagueId = current.leagueId();
		repository.saveSubscription(leagueId, data, plan);
		operations.reconcileSubscription(data.path("id").asText(), data, plan);
		applyAccess(repository.find(data.path("id").asText()));
	}

	public void recoverCheckout(JsonNode transaction) {
		if (transaction.path("origin").asText().startsWith("subscription_")) return;
		var purchase = checkouts.verifyPurchase(transaction);
		if (purchase == null) return;
		var operationId = transaction.path("custom_data").path("operation_id").asText("");
		if (operationId.isBlank()) return;
		repository.jdbc().update("update billing_checkout set transaction_id = ? where operation_id = ? and transaction_id is null", transaction.path("id").asText(), operationId);
		operations.confirm(operationId, "checkout:" + purchase.leagueType().name() + ":" + purchase.fplLeagueId(), transaction);
	}

	public void acceptPayment(JsonNode data) {
		var subscriptionId = data.path("subscription_id").asText("");
		if (subscriptionId.isBlank()) return;
		if (repository.find(subscriptionId) == null && checkouts.verifyPurchase(data) == null) return;
		refresh(subscriptionId);
		if (repository.find(subscriptionId) == null) return;
		repository.savePayment(data);
		var operationId = data.path("custom_data").path("operation_id").asText("");
		if (!operationId.isBlank() && !data.path("origin").asText().startsWith("subscription_")) {
			var custom = data.path("custom_data");
			operations.confirm(operationId, "checkout:" + custom.path("league_type").asText() + ":" + custom.path("fpl_league_id").asLong(), data);
			repository.jdbc().update("update billing_checkout set transaction_id = ? where operation_id = ?", data.path("id").asText(), operationId);
		}
	}

	public void applyAccess(BillingRepository.Subscription subscription) {
		if (subscription == null) return;
		var enabled = subscription.accessible(Instant.now());
		var ai = enabled && subscription.effectivePlan(Instant.now()) == BillingPlan.AI_BROADCASTER;
		// Update only the latest subscription: a late event for an old purchase cannot revoke a new one.
		if (!subscription.id().equals(repository.forLeague(subscription.leagueId()).id())) return;
		repository.jdbc().update("update league set service_enabled = ?, ai_narration_enabled = ?, voice_narration_enabled = ? where id = ?", enabled, ai, ai, subscription.leagueId());
		broadcasts.updateLeagueEntitlement(subscription.leagueId(), enabled, ai);
	}
}
