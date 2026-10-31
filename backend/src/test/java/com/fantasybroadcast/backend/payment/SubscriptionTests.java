package com.fantasybroadcast.backend.payment;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.fantasybroadcast.backend.customer.CurrentUser;
import com.fantasybroadcast.backend.customer.LeagueRegistrationService;
import com.fantasybroadcast.backend.customer.UserRole;
import com.fantasybroadcast.backend.fpl.FplLeagueScoring;
import com.fantasybroadcast.backend.fpl.FplLeagueType;
import com.fantasybroadcast.backend.live.MockLiveStateService;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class SubscriptionTests {
	private final ObjectMapper json = new ObjectMapper();
	private final Instant now = Instant.now().truncatedTo(java.time.temporal.ChronoUnit.SECONDS);
	private final CurrentUser owner = new CurrentUser(1, "owner@example.com", "Owner", UserRole.USER);

	@Test
	void migrationsRunAndDowngradeKeepsPaidAiOnlyUntilTheBoundary() throws Exception {
		var db = new BillingTestDatabase();
		db.repository.saveSubscription(1, subscription("active", "ai", now, now.plus(Duration.ofDays(20))), BillingPlan.AI_BROADCASTER);
		db.repository.retainAi("sub_test", now.plus(Duration.ofDays(20)));
		db.repository.saveSubscription(1, subscription("active", "standard", now.plusSeconds(1), now.plus(Duration.ofDays(20))), BillingPlan.STANDARD);
		var stored = db.repository.find("sub_test");
		assertThat(stored.effectivePlan(now)).isEqualTo(BillingPlan.AI_BROADCASTER);
		assertThat(stored.renewalPlan()).isEqualTo(BillingPlan.STANDARD);
		assertThat(stored.effectivePlan(stored.periodEnd())).isEqualTo(BillingPlan.STANDARD);
		assertThat(stored.accessible(stored.periodEnd())).isFalse();
		// An older delivery must not undo the downgrade or re-enable an old plan.
		db.repository.saveSubscription(1, subscription("active", "ai", now, now.plus(Duration.ofDays(20))), BillingPlan.AI_BROADCASTER);
		assertThat(db.repository.find("sub_test").renewalPlan()).isEqualTo(BillingPlan.STANDARD);
	}

	@Test
	void failedRenewalsDoNotGrantAnotherMonthAndGraceExpiresExactlyAtThreeDays() throws Exception {
		var db = new BillingTestDatabase();
		var paidUntil = now.minus(Duration.ofDays(1));
		db.repository.saveSubscription(1, subscription("active", "standard", now.minusSeconds(2), paidUntil), BillingPlan.STANDARD);
		db.repository.saveSubscription(1, subscription("past_due", "standard", now, now.plus(Duration.ofDays(29))), BillingPlan.STANDARD);
		var stored = db.repository.find("sub_test");
		assertThat(stored.periodEnd()).isEqualTo(paidUntil);
		assertThat(stored.accessible(now)).isTrue();
		assertThat(stored.accessible(paidUntil.plus(Duration.ofDays(3)))).isFalse();
	}

	@Test
	void cancellationAndRefundOverrideFuturePaidDates() throws Exception {
		var db = new BillingTestDatabase();
		var data = subscription("active", "standard", now, now.plus(Duration.ofDays(20)));
		((tools.jackson.databind.node.ObjectNode) data).set("scheduled_change", json.valueToTree(Map.of("action", "cancel", "effective_at", now.plusSeconds(30).toString())));
		db.repository.saveSubscription(1, data, BillingPlan.STANDARD);
		assertThat(db.repository.find("sub_test").accessible(now)).isTrue();
		assertThat(db.repository.find("sub_test").accessible(now.plusSeconds(30))).isFalse();
		db.repository.endRefundedAccess("sub_test");
		assertThat(db.repository.find("sub_test").accessible(now)).isFalse();
	}

	@Test
	void changePreviewAndUpgradeUseProrationAndPaymentFailureProtection() throws Exception {
		var db = new BillingTestDatabase();
		var paddle = mock(PaddleClient.class);
		var leagues = mock(LeagueRegistrationService.class);
		var properties = properties();
		var live = mock(MockLiveStateService.class);
		var sync = new SubscriptionSyncService(db.repository, paddle, properties, mock(PaddleCheckoutService.class), leagues, live, db.operations);
		var service = new SubscriptionService(db.repository, paddle, properties, sync, leagues, db.operations);
		var standard = subscription("active", "standard", now, now.plus(Duration.ofDays(20)));
		db.repository.saveSubscription(1, standard, BillingPlan.STANDARD);
		when(leagues.accessibleLeague(any(CurrentUser.class), eq(1L))).thenReturn(new LeagueRegistrationService.RegisteredLeague(1, 100, "Test", FplLeagueType.DRAFT, FplLeagueScoring.H2H, true, false, false, 1, false));
		when(paddle.get("/subscriptions/sub_test")).thenReturn(standard);
		when(paddle.patch(eq("/subscriptions/sub_test/preview"), any())).thenReturn(json.readTree("""
			{"currency_code":"EUR","immediate_transaction":{"details":{"totals":{"grand_total":"500"}}},"recurring_transaction_details":{"totals":{"grand_total":"1499"}}}
			"""));
		var preview = service.preview(owner, 1, BillingPlan.AI_BROADCASTER);
		assertThat(preview.chargeNow()).isEqualTo("500");
		assertThat(preview.renewalTotal()).isEqualTo("1499");
		assertThat(preview.immediate()).isTrue();
		var ai = subscription("active", "ai", now.plusSeconds(1), now.plus(Duration.ofDays(20)));
		when(paddle.patch(eq("/subscriptions/sub_test"), any())).thenReturn(ai);
		var id = UUID.randomUUID().toString();
		service.change(owner, 1, BillingPlan.AI_BROADCASTER, preview.version(), id);
		service.change(owner, 1, BillingPlan.AI_BROADCASTER, preview.version(), id);
		verify(paddle, times(1)).patch(eq("/subscriptions/sub_test"), argThat(body -> ((Map<?, ?>) body).get("proration_billing_mode").equals("prorated_immediately") && ((Map<?, ?>) body).get("on_payment_failure").equals("prevent_change")));
		assertThat(db.repository.find("sub_test").renewalPlan()).isEqualTo(BillingPlan.AI_BROADCASTER);
		assertThatThrownBy(() -> service.summary(new CurrentUser(2, "other@example.com", "Other", UserRole.USER), 1, false)).isInstanceOf(ResponseStatusException.class).hasMessageContaining("Only the purchasing league owner");
	}

	@Test
	void uncertainFinancialRequestsCannotBeSubmittedAgainEvenWithANewReference() throws Exception {
		var db = new BillingTestDatabase();
		var id = UUID.randomUUID().toString();
		assertThatThrownBy(() -> db.operations.run(id, "refund:txn_test", 1, List.of("full"), () -> { throw new PaddleClient.UncertainResult("Unknown"); })).isInstanceOf(PaddleClient.UncertainResult.class);
		assertThatThrownBy(() -> db.operations.run(id, "refund:txn_test", 1, List.of("full"), () -> json.createObjectNode())).isInstanceOf(ResponseStatusException.class);
		assertThatThrownBy(() -> db.operations.run(UUID.randomUUID().toString(), "refund:txn_test", 1, List.of("full"), () -> json.createObjectNode())).isInstanceOf(ResponseStatusException.class);
		db.operations.complete(id, json.readTree("{\"id\":\"adj_test\"}"));
		assertThat(db.operations.pending("refund:txn_test")).isFalse();
		assertThat(db.operations.run(id, "refund:txn_test", 1, List.of("full"), () -> { throw new AssertionError("Must not repeat the charge"); }).path("id").asText()).isEqualTo("adj_test");
	}

	JsonNode subscription(String status, String price, Instant version, Instant end) {
		var node = json.createObjectNode();
		node.put("id", "sub_test"); node.put("customer_id", "ctm_test"); node.put("status", status); node.put("updated_at", version.toString()); node.put("next_billed_at", end.toString());
		node.set("items", json.valueToTree(List.of(Map.of("price", Map.of("id", price), "quantity", 1))));
		node.set("current_billing_period", json.valueToTree(Map.of("starts_at", end.minus(Duration.ofDays(30)).toString(), "ends_at", end.toString())));
		node.putNull("scheduled_change");
		return node;
	}
	static PaddleProperties properties() { var properties = new PaddleProperties(); properties.setStandardPriceId("standard"); properties.setAiBroadcasterPriceId("ai"); return properties; }
}
