package com.fantasybroadcast.backend.payment;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.fantasybroadcast.backend.customer.CurrentUser;
import com.fantasybroadcast.backend.customer.UserRole;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class RefundTests {
	private final ObjectMapper json = new ObjectMapper();

	@Test
	void partialRefundIsAllocatedAcrossTaxInclusiveLinesWithoutExceedingPriorRefunds() {
		var payment = payment();
		var previous = json.readTree("""
			{"action":"refund","status":"approved","totals":{"total":"200"},"items":[{"item_id":"line1","totals":{"total":"200"}}]}
			""");
		var result = RefundService.refundBody(payment, List.of(previous), 900L);
		assertThat(result.get("type")).isEqualTo("partial");
		assertThat(result.get("items")).isEqualTo(List.of(Map.of("item_id", "line1", "type", "partial", "amount", "400"), Map.of("item_id", "line2", "type", "partial", "amount", "500")));
		assertThatThrownBy(() -> RefundService.refundBody(payment, List.of(previous), 1300L)).isInstanceOf(ResponseStatusException.class);
		assertThatThrownBy(() -> RefundService.refundBody(payment, List.of(), 0L)).isInstanceOf(ResponseStatusException.class);
		assertThat(RefundService.refundBody(payment, List.of(), null)).containsEntry("type", "full");
	}

	@Test
	void pendingRefundKeepsAccessAndApprovalRevokesItOnlyOnceWithOlderEventsIgnored() throws Exception {
		var db = new BillingTestDatabase();
		var now = Instant.now().truncatedTo(java.time.temporal.ChronoUnit.SECONDS);
		db.repository.saveSubscription(1, new SubscriptionTests().subscription("active", "standard", now, now.plus(Duration.ofDays(20))), BillingPlan.STANDARD);
		var sync = mock(SubscriptionSyncService.class);
		var paddle = mock(PaddleClient.class);
		var service = new RefundService(db.repository, paddle, sync, db.operations);
		var reference = UUID.randomUUID().toString();
		var adjustment = json.createObjectNode();
		adjustment.put("id", "adj_test"); adjustment.put("subscription_id", "sub_test"); adjustment.put("transaction_id", "txn_test");
		adjustment.put("action", "refund"); adjustment.put("type", "full"); adjustment.put("status", "pending_approval");
		adjustment.put("currency_code", "EUR"); adjustment.put("reason", "Initial refund [FB:" + reference + ":end]");
		adjustment.put("updated_at", now.toString()); adjustment.set("totals", json.valueToTree(Map.of("total", "1200")));
		service.acceptAdjustment(adjustment);
		assertThat(db.repository.find("sub_test").refunded()).isFalse();
		var approved = adjustment.deepCopy(); approved.put("status", "approved"); approved.put("updated_at", now.plusSeconds(1).toString());
		service.acceptAdjustment(approved);
		service.acceptAdjustment(adjustment);
		assertThat(db.repository.find("sub_test").refunded()).isTrue();
		assertThat(db.jdbc.queryForObject("select status from billing_refund where adjustment_id = 'adj_test'", String.class)).isEqualTo("approved");
		verify(sync).applyAccess(any());
		verifyNoInteractions(paddle);
	}

	@Test
	void refundAdministrationRejectsRegularUsersBeforeContactingPaddle() {
		var paddle = mock(PaddleClient.class);
		var service = new RefundService(mock(BillingRepository.class), paddle, mock(SubscriptionSyncService.class), mock(BillingOperations.class));
		var user = new CurrentUser(1, "user@example.com", "User", UserRole.USER);
		assertThatThrownBy(() -> service.search(user, "", 0, 10)).isInstanceOf(ResponseStatusException.class);
		assertThatThrownBy(() -> service.submit(user, "sub_test", "txn_test", UUID.randomUUID().toString(), null, "Test reason", true)).isInstanceOf(ResponseStatusException.class);
		verifyNoInteractions(paddle);
	}

	@Test
	void administratorsCanFindTheLeagueFromAnEmailedPaymentReference() throws Exception {
		var db = new BillingTestDatabase();
		var now = Instant.now().truncatedTo(java.time.temporal.ChronoUnit.SECONDS);
		db.repository.saveSubscription(1, new SubscriptionTests().subscription("active", "standard", now, now.plus(Duration.ofDays(20))), BillingPlan.STANDARD);
		db.repository.savePayment(json.readTree("""
			{"id":"txn_test","subscription_id":"sub_test","origin":"api","status":"completed","currency_code":"EUR","created_at":"2026-10-29T10:00:00Z","details":{"totals":{"grand_total":"699"}}}
			"""));
		var paddle = mock(PaddleClient.class);
		var service = new RefundService(db.repository, paddle, mock(SubscriptionSyncService.class), db.operations);
		assertThat(service.search(new CurrentUser(2, "admin@example.com", "Admin", UserRole.ADMIN), "txn_test", 0, 10).items()).singleElement().satisfies(subscription -> assertThat(subscription.leagueName()).isEqualTo("Test league"));
		verifyNoInteractions(paddle);
	}

	@Test
	void subscriptionsPageNewestFirstWithFilteredTotals() throws Exception {
		var db = new BillingTestDatabase();
		var now = Instant.now();
		var data = new SubscriptionTests().subscription("active", "standard", now, now.plus(Duration.ofDays(20)));
		for (int id = 1; id <= 12; id++) {
			((tools.jackson.databind.node.ObjectNode) data).put("id", "sub_" + id);
			if (id > 1) db.jdbc.update("insert into league (id, fpl_league_id, display_name, owner_user_id) values (?, ?, ?, 1)", id, 100 + id, "League " + id);
			db.repository.saveSubscription(id, data, BillingPlan.STANDARD);
		}
		var service = new RefundService(db.repository, mock(PaddleClient.class), mock(SubscriptionSyncService.class), db.operations);
		var admin = new CurrentUser(2, "admin@example.com", "Admin", UserRole.ADMIN);
		var first = service.search(admin, "", 0, 10);
		assertThat(first.totalItems()).isEqualTo(12);
		assertThat(first.items()).hasSize(10);
		assertThat(first.items().getFirst().id()).isEqualTo("sub_12");
		assertThat(service.search(admin, "", 1, 10).items()).extracting(RefundService.AdminSubscription::id).containsExactly("sub_2", "sub_1");
		assertThat(service.search(admin, "sub_4", 0, 10).totalItems()).isEqualTo(1);
		assertThat(service.search(admin, "missing", 0, 10).totalItems()).isZero();
		assertThat(service.search(admin, "", 2, 10).items()).isEmpty();
	}

	private JsonNode payment() {
		return json.readTree("""
			{"details":{"totals":{"grand_total":"1200"},"line_items":[{"id":"line1","totals":{"total":"600"}},{"id":"line2","totals":{"total":"600"}}]}}
			""");
	}
}
