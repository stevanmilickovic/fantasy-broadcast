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
	private static final String STANDARD = "STANDARD";
	private static final String AI_BROADCASTER = "AI_BROADCASTER";
	private final PaddleProperties properties;
	private final LeagueRegistrationService leagues;

	public PaddleCheckoutService(PaddleProperties properties, LeagueRegistrationService leagues) {
		this.properties = properties;
		this.leagues = leagues;
	}

	public Checkout createCheckout(CurrentUser user, long fplLeagueId, FplLeagueType leagueType, String plan) {
		if (!properties.isConfigured()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Paddle checkout is not configured.");
		var preview = leagues.preview(fplLeagueId, leagueType);
		if (preview.validationMessage() != null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, preview.validationMessage());
		var normalizedPlan = normalizePlan(plan);
		var signature = signature(user.id(), fplLeagueId, leagueType, normalizedPlan);
		return new Checkout(properties.getClientSideToken(), priceFor(normalizedPlan), user.id(), fplLeagueId, leagueType.name(), normalizedPlan, signature);
	}

	public void provision(tools.jackson.databind.JsonNode transaction) {
		var customData = transaction.path("custom_data");
		if (!"fantasy-broadcast".equals(customData.path("application").asText())) return;
		var userId = customData.path("user_id").asLong();
		var fplLeagueId = customData.path("fpl_league_id").asLong();
		var leagueType = customData.path("league_type").asText();
		var plan = customData.path("plan").asText();
		var suppliedSignature = customData.path("payment_signature").asText();
		if (userId <= 0 || fplLeagueId <= 0 || suppliedSignature.isBlank()) return;
		var parsedLeagueType = FplLeagueType.valueOf(leagueType);
		var normalizedPlan = normalizePlan(plan);
		if (!MessageDigest.isEqual(signature(userId, fplLeagueId, parsedLeagueType, normalizedPlan).getBytes(StandardCharsets.UTF_8), suppliedSignature.getBytes(StandardCharsets.UTF_8))) return;
		if (!priceFor(normalizedPlan).equals(transactionPriceId(transaction))) return;
		leagues.registerPaid(userId, fplLeagueId, parsedLeagueType, AI_BROADCASTER.equals(normalizedPlan));
	}

	private String transactionPriceId(tools.jackson.databind.JsonNode transaction) {
		var item = transaction.path("items").path(0);
		var id = item.path("price").path("id").asText();
		return id.isBlank() ? item.path("price_id").asText() : id;
	}

	private String normalizePlan(String plan) {
		if (STANDARD.equals(plan) || AI_BROADCASTER.equals(plan)) return plan;
		throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a valid broadcast plan.");
	}

	private String priceFor(String plan) { return STANDARD.equals(plan) ? properties.getStandardPriceId() : properties.getAiBroadcasterPriceId(); }

	private String signature(long userId, long fplLeagueId, FplLeagueType leagueType, String plan) {
		try {
			var mac = Mac.getInstance("HmacSHA256");
			mac.init(new SecretKeySpec(properties.getApiKey().getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
			return HexFormat.of().formatHex(mac.doFinal((userId + ":" + fplLeagueId + ":" + leagueType.name() + ":" + plan).getBytes(StandardCharsets.UTF_8)));
		}
		catch (Exception exception) { throw new IllegalStateException("Could not sign Paddle checkout data.", exception); }
	}

	public record Checkout(String clientSideToken, String priceId, long userId, long fplLeagueId, String leagueType, String plan, String paymentSignature) { }
}
