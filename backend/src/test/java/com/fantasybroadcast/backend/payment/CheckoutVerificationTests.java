package com.fantasybroadcast.backend.payment;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.fantasybroadcast.backend.customer.CurrentUser;
import com.fantasybroadcast.backend.customer.LeagueRegistrationService;
import com.fantasybroadcast.backend.customer.UserRole;
import com.fantasybroadcast.backend.fpl.FplLeagueType;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;

class CheckoutVerificationTests {
	@Test
	void checkoutRequiresCurrentConsentBeforeAnyPaymentOrLeagueLookup() throws Exception {
		var fixture = new Fixture();
		assertThatThrownBy(() -> fixture.service.createCheckout(fixture.owner, 100, FplLeagueType.DRAFT, "STANDARD", false, PaddleCheckoutService.TERMS_VERSION))
				.isInstanceOf(ResponseStatusException.class).hasMessageContaining("Accept the current Terms");
		assertThatThrownBy(() -> fixture.service.createCheckout(fixture.owner, 100, FplLeagueType.DRAFT, "STANDARD", true, "2026-09-11"))
				.isInstanceOf(ResponseStatusException.class).hasMessageContaining("Accept the current Terms");
		verifyNoInteractions(fixture.leagues, fixture.paddle);
	}

	@Test
	void savedCheckoutSurvivesApiKeyRotationAndRejectsChangedPurchaseDetails() throws Exception {
		var fixture = new Fixture();
		fixture.checkout();
		var custom = fixture.transaction.path("custom_data");
		assertThat(custom.path("terms_version").asText()).isEqualTo(PaddleCheckoutService.TERMS_VERSION);
		assertThat(custom.path("accepted_policies").asBoolean()).isTrue();
		assertThat(Instant.parse(custom.path("terms_accepted_at").asText())).isBeforeOrEqualTo(Instant.now());
		fixture.properties.setApiKey("pdl_sdbx_apikey_rotated");
		assertThat(fixture.service.verifyPurchase(fixture.transaction)).isEqualTo(new PaddleCheckoutService.Purchase(1, 100, FplLeagueType.DRAFT));
		for (var field : java.util.List.of("user_id", "fpl_league_id", "league_type", "plan", "payment_signature", "operation_id")) {
			var tampered = (ObjectNode) custom.deepCopy();
			tampered.put(field, "changed");
			assertThat(fixture.service.verifyPurchase(fixture.db.json.createObjectNode().set("custom_data", tampered))).as(field).isNull();
		}
	}

	@Test
	void existingHmacCheckoutUsesItsSavedSignatureAfterKeyRotation() throws Exception {
		var fixture = new Fixture();
		var mac = javax.crypto.Mac.getInstance("HmacSHA256");
		mac.init(new javax.crypto.spec.SecretKeySpec(fixture.properties.getApiKey().getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
		var signature = java.util.HexFormat.of().formatHex(mac.doFinal("1:100:DRAFT:STANDARD".getBytes(StandardCharsets.UTF_8)));
		var operationId = java.util.UUID.randomUUID().toString();
		var custom = Map.of("application", "fantasy-broadcast", "user_id", 1, "fpl_league_id", 100,
				"league_type", "DRAFT", "plan", "STANDARD", "payment_signature", signature, "operation_id", operationId);
		var event = fixture.db.json.valueToTree(Map.of("custom_data", custom));
		// Purchases predating operation tracking still use their existing signature check.
		assertThat(fixture.service.verifyPurchase(event)).isNotNull();
		fixture.db.operations.run(operationId, "checkout:DRAFT:100", 1, custom, () -> fixture.db.json.createObjectNode().put("id", "txn_old"));
		fixture.properties.setApiKey("pdl_sdbx_apikey_rotated");
		assertThat(fixture.service.verifyPurchase(event)).isEqualTo(new PaddleCheckoutService.Purchase(1, 100, FplLeagueType.DRAFT));
	}

	@Test
	void unfinishedCheckoutWithOldTermsIsReplacedBeforeTakingPayment() throws Exception {
		var fixture = new Fixture();
		var original = fixture.checkout();
		assertThat(fixture.checkout()).isEqualTo(original);
		((ObjectNode) fixture.transaction.path("custom_data")).put("terms_version", "2026-09-11");
		fixture.checkout();
		verify(fixture.paddle).patch("/transactions/txn_test", Map.of("status", "canceled"));
		verify(fixture.paddle, times(2)).post(eq("/transactions"), any());
		assertThat(fixture.transaction.path("custom_data").path("terms_version").asText()).isEqualTo(PaddleCheckoutService.TERMS_VERSION);
	}

	private static class Fixture {
		final BillingTestDatabase db = new BillingTestDatabase();
		final PaddleProperties properties = SubscriptionTests.properties();
		final LeagueRegistrationService leagues = mock(LeagueRegistrationService.class);
		final PaddleClient paddle = mock(PaddleClient.class);
		final CurrentUser owner = new CurrentUser(1, "owner@example.com", "Owner", UserRole.USER);
		final PaddleCheckoutService service = new PaddleCheckoutService(properties, leagues, db.repository, paddle, db.operations);
		JsonNode transaction;

		Fixture() throws Exception {
			properties.setApiKey("pdl_sdbx_apikey_test");
			properties.setClientSideToken("test_token");
			properties.setWebhookSecretKey("sandbox-secret");
			when(leagues.preview(100, FplLeagueType.DRAFT)).thenReturn(new LeagueRegistrationService.LeaguePreview("Test", 10, null));
			when(paddle.post(eq("/transactions"), any())).thenAnswer(call -> {
				Map<?, ?> body = call.getArgument(1);
				transaction = db.json.valueToTree(Map.of("id", "txn_test", "status", "ready", "custom_data", body.get("custom_data")));
				return transaction;
			});
			when(paddle.get("/transactions/txn_test")).thenAnswer(call -> transaction);
		}

		PaddleCheckoutService.Checkout checkout() {
			return service.createCheckout(owner, 100, FplLeagueType.DRAFT, "STANDARD", true, PaddleCheckoutService.TERMS_VERSION);
		}
	}
}
