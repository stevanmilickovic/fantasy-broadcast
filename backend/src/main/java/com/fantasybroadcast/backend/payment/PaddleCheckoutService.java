package com.fantasybroadcast.backend.payment;

import com.fantasybroadcast.backend.customer.CurrentUser;
import com.fantasybroadcast.backend.customer.LeagueRegistrationService;
import com.fantasybroadcast.backend.fpl.FplLeagueType;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.http.HttpStatus;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
@Profile("db & !test")
public class PaddleCheckoutService {
	public static final String TERMS_VERSION = "2026-10-29";
	private static final String STANDARD = "STANDARD";
	private static final String AI_BROADCASTER = "AI_BROADCASTER";
	private final PaddleProperties properties;
	private final LeagueRegistrationService leagues;
	private final BillingRepository billing;
	private final PaddleClient paddle;
	private final BillingOperations operations;

	public PaddleCheckoutService(PaddleProperties properties, LeagueRegistrationService leagues, BillingRepository billing, PaddleClient paddle, BillingOperations operations) {
		this.properties = properties;
		this.leagues = leagues;
		this.billing = billing;
		this.paddle = paddle;
		this.operations = operations;
	}

	public Checkout createCheckout(CurrentUser user, long fplLeagueId, FplLeagueType leagueType, String plan, boolean acceptedPolicies, String termsVersion) {
		if (!acceptedPolicies || !TERMS_VERSION.equals(termsVersion))
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Accept the current Terms of Service before continuing. Reload checkout if the terms have changed.");
		if (!properties.isConfigured()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Paddle checkout is not configured.");
		leagues.requireRegistrationAllowed(user);
		leagues.requirePurchasingOwner(user, fplLeagueId, leagueType);
		if (billing.activeForSource(fplLeagueId, leagueType.name())) throw new ResponseStatusException(HttpStatus.CONFLICT, "This league already has a subscription. Use Manage subscription instead.");
		var preview = leagues.preview(fplLeagueId, leagueType);
		if (preview.validationMessage() != null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, preview.validationMessage());
		var normalizedPlan = normalizePlan(plan);
		properties.requirePlanAvailable(BillingPlan.valueOf(normalizedPlan));
		var sourceKey = leagueType.name() + ":" + fplLeagueId;
		var reservations = billing.jdbc().queryForList("select * from billing_checkout where source_key = ?", sourceKey);
		if (!reservations.isEmpty()) {
			var previous = reservations.getFirst();
			if (user.id() != ((Number) previous.get("user_id")).longValue()) throw new ResponseStatusException(HttpStatus.CONFLICT, "Another purchaser has a checkout for this league. Contact support if it was abandoned.");
			var transactionId = (String) previous.get("transaction_id");
			if (transactionId == null) throw new ResponseStatusException(HttpStatus.CONFLICT, "A checkout is awaiting confirmation. Contact support before paying again.");
			var existing = paddle.get("/transactions/" + transactionId);
			if (java.util.List.of("draft", "ready").contains(existing.path("status").asText())) {
				if (normalizedPlan.equals(previous.get("plan_code")) && TERMS_VERSION.equals(existing.path("custom_data").path("terms_version").asText())
						&& existing.path("custom_data").path("accepted_policies").asBoolean())
					return new Checkout(properties.getClientSideToken(), priceFor(normalizedPlan), user.id(), fplLeagueId, leagueType.name(), normalizedPlan,
							existing.path("custom_data").path("payment_signature").asText(), transactionId);
				paddle.patch("/transactions/" + transactionId, java.util.Map.of("status", "canceled"));
			} else if (!existing.path("status").asText().equals("canceled") &&
					!(billing.find(existing.path("subscription_id").asText()) != null && billing.find(existing.path("subscription_id").asText()).status().equals("canceled"))) {
				throw new ResponseStatusException(HttpStatus.CONFLICT, "A payment for this league is being processed. Contact support before paying again.");
			}
			billing.jdbc().update("delete from billing_checkout where source_key = ? and transaction_id = ?", sourceKey, transactionId);
		}
		var operationId = java.util.UUID.randomUUID().toString();
		var signature = java.util.UUID.randomUUID().toString();
		try {
			billing.jdbc().update("insert into billing_checkout (source_key, user_id, operation_id, plan_code) values (?, ?, ?, ?)", sourceKey, user.id(), operationId, normalizedPlan);
		} catch (org.springframework.dao.DuplicateKeyException exception) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "Another checkout is being prepared. Please refresh.");
		}
		var customData = java.util.Map.of("application", "fantasy-broadcast", "user_id", user.id(), "fpl_league_id", fplLeagueId, "league_type", leagueType.name(), "plan", normalizedPlan,
				"payment_signature", signature, "operation_id", operationId, "terms_version", TERMS_VERSION, "accepted_policies", true, "terms_accepted_at", java.time.Instant.now().toString());
		tools.jackson.databind.JsonNode transaction;
		try {
			transaction = operations.run(operationId, "checkout:" + sourceKey, user.id(), customData,
					() -> paddle.post("/transactions", java.util.Map.of("items", java.util.List.of(java.util.Map.of("price_id", priceFor(normalizedPlan), "quantity", 1)), "custom_data", customData)));
		} catch (ResponseStatusException exception) {
			var failed = billing.jdbc().queryForObject("select count(*) from billing_operation where id = ? and status = 'failed'", Integer.class, operationId);
			if (failed != null && failed > 0) billing.jdbc().update("delete from billing_checkout where source_key = ? and operation_id = ?", sourceKey, operationId);
			throw exception;
		}
		billing.jdbc().update("update billing_checkout set transaction_id = ? where source_key = ?", transaction.path("id").asText(), sourceKey);
		return new Checkout(properties.getClientSideToken(), priceFor(normalizedPlan), user.id(), fplLeagueId, leagueType.name(), normalizedPlan, signature, transaction.path("id").asText());
	}

	public Purchase verifyPurchase(tools.jackson.databind.JsonNode data) {
		var custom = data.path("custom_data");
		if (!"fantasy-broadcast".equals(custom.path("application").asText())) return null;
		try {
			var userId = custom.path("user_id").asLong(0);
			var leagueId = custom.path("fpl_league_id").asLong(0);
			var type = FplLeagueType.valueOf(custom.path("league_type").asText());
			var plan = BillingPlan.valueOf(custom.path("plan").asText()).name();
			if (userId <= 0 || leagueId <= 0) return null;
			var stored = operations.checkoutData(custom.path("operation_id").asText(""));
			if (stored != null) {
				// The immutable checkout record survives API-key rotation, including for older HMAC checkouts.
				for (var field : java.util.List.of("application", "user_id", "fpl_league_id", "league_type", "plan", "payment_signature"))
					if (stored.path(field).asText().isBlank() || !stored.path(field).asText().equals(custom.path(field).asText())) return null;
			} else if (!MessageDigest.isEqual(legacySignature(userId, leagueId, type, plan).getBytes(StandardCharsets.UTF_8),
					custom.path("payment_signature").asText().getBytes(StandardCharsets.UTF_8))) return null;
			return new Purchase(userId, leagueId, type);
		} catch (IllegalArgumentException exception) { return null; }
	}

	private String normalizePlan(String plan) {
		if (STANDARD.equals(plan) || AI_BROADCASTER.equals(plan)) return plan;
		throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a valid broadcast plan.");
	}

	private String priceFor(String plan) { return STANDARD.equals(plan) ? properties.getStandardPriceId() : properties.getAiBroadcasterPriceId(); }

	private String legacySignature(long userId, long fplLeagueId, FplLeagueType leagueType, String plan) {
		try {
			var mac = Mac.getInstance("HmacSHA256");
			mac.init(new SecretKeySpec(properties.getApiKey().getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
			return HexFormat.of().formatHex(mac.doFinal((userId + ":" + fplLeagueId + ":" + leagueType.name() + ":" + plan).getBytes(StandardCharsets.UTF_8)));
		}
		catch (Exception exception) { throw new IllegalStateException("Could not sign Paddle checkout data.", exception); }
	}

	public record Purchase(long userId, long fplLeagueId, FplLeagueType leagueType) { }
	public record Checkout(String clientSideToken, String priceId, long userId, long fplLeagueId, String leagueType, String plan, String paymentSignature, String transactionId) { }
}
