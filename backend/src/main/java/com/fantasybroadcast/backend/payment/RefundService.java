package com.fantasybroadcast.backend.payment;

import com.fantasybroadcast.backend.customer.CurrentUser;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;

@Service
@Profile("db & !test")
public class RefundService {
	private static final Pattern REFERENCE = Pattern.compile("\\[FB:([0-9a-f-]{36}):(end|keep)\\]");
	private final BillingRepository repository;
	private final PaddleClient paddle;
	private final SubscriptionSyncService sync;
	private final BillingOperations operations;

	public RefundService(BillingRepository repository, PaddleClient paddle, SubscriptionSyncService sync, BillingOperations operations) {
		this.repository = repository;
		this.paddle = paddle;
		this.sync = sync;
		this.operations = operations;
	}

	public AdminSubscriptionPage search(CurrentUser user, String search, int page, int size) {
		requireAdmin(user);
		var term = search.trim();
		if (term.length() > 160) throw badRequest("Search is too long.");
		var from = """
				from subscription s join league l on l.id = s.league_id join app_user u on u.id = l.owner_user_id
				where lower(l.display_name) like concat('%', lower(?), '%') or lower(u.email) like concat('%', lower(?), '%')
				or s.billing_subscription_id = ? or cast(l.fpl_league_id as char) = ?
				or exists (select 1 from billing_payment p where p.subscription_id = s.billing_subscription_id and p.transaction_id = ?)
				""";
		var total = repository.jdbc().queryForObject("select count(*) " + from, Long.class, term, term, term, term, term);
		var items = repository.jdbc().query("select s.billing_subscription_id, s.league_id, l.display_name, u.email, s.plan_code, s.status, s.current_period_end "
				+ from + " order by s.id desc limit ? offset ?",
				(rs, row) -> new AdminSubscription(rs.getString(1), rs.getLong(2), rs.getString(3), rs.getString(4), rs.getString(5), rs.getString(6),
					rs.getTimestamp(7) == null ? null : rs.getTimestamp(7).toInstant()), term, term, term, term, term, size, (long) page * size);
		return new AdminSubscriptionPage(items, page, size, total == null ? 0 : total);
	}

	public record AdminSubscriptionPage(List<AdminSubscription> items, int page, int size, long totalItems) { }

	public List<Payment> payments(CurrentUser user, String subscriptionId) {
		requireAdmin(user);
		requireKnown(subscriptionId);
		var result = new ArrayList<Payment>();
		for (var payment : paddle.list("/transactions?subscription_id=" + subscriptionId + "&status=completed&per_page=200")) {
			repository.savePayment(payment);
			var adjustments = paddle.list("/adjustments?transaction_id=" + payment.path("id").asText() + "&per_page=200");
			adjustments.forEach(this::acceptAdjustment);
			var refunds = adjustments.stream().filter(this::reducesPayment).map(this::refundView).toList();
			var total = payment.path("details").path("totals").path("grand_total").asLong();
			var reserved = refunds.stream().filter(refund -> List.of("approved", "pending_approval").contains(refund.status())).mapToLong(Refund::amount).sum();
			var paid = BillingRepository.paymentTime(payment);
			var initial = !payment.path("origin").asText().startsWith("subscription_");
			result.add(new Payment(payment.path("id").asText(), payment.path("currency_code").asText(), total, Math.max(0, total - reserved), paid,
					initial, initial && !Instant.now().isAfter(paid.plus(Duration.ofDays(14))), refunds,
					operations.pending("refund:" + payment.path("id").asText())));
		}
		return result.stream().sorted(java.util.Comparator.comparing(Payment::paidAt).reversed()).toList();
	}

	public Refund submit(CurrentUser admin, String subscriptionId, String transactionId, String requestId, Long partialAmount, String reason, boolean endsAccess) {
		requireAdmin(admin);
		requireKnown(subscriptionId);
		if (reason == null || reason.trim().length() < 5 || reason.length() > 700 || reason.contains("[FB:")) throw badRequest("Enter a refund reason between 5 and 700 characters without an internal request reference.");
		var result = operations.run(requestId, "refund:" + transactionId, admin.id(),
				List.of(subscriptionId, transactionId, partialAmount == null ? "full" : partialAmount, reason.trim(), endsAccess), () -> {
			var payment = paddle.get("/transactions/" + transactionId);
			if (!subscriptionId.equals(payment.path("subscription_id").asText()) || !payment.path("status").asText().equals("completed"))
				throw badRequest("Choose a completed payment belonging to this subscription.");
			repository.savePayment(payment);
			var adjustments = paddle.list("/adjustments?transaction_id=" + transactionId + "&per_page=200");
			if (adjustments.stream().anyMatch(adjustment -> adjustment.path("status").asText().equals("pending_approval")))
				throw badRequest("This payment already has a refund awaiting Paddle approval.");
			var body = refundBody(payment, adjustments, partialAmount);
			body.put("action", "refund");
			body.put("transaction_id", transactionId);
			body.put("reason", reason.trim() + " [FB:" + requestId + ":" + (endsAccess ? "end" : "keep") + "]");
			return paddle.post("/adjustments", body);
		});
		acceptAdjustment(result);
		return refundView(result);
	}

	/** Paddle amounts are integer minor units, including tax; allocate partial refunds by line item. */
	static java.util.HashMap<String, Object> refundBody(JsonNode payment, List<JsonNode> adjustments, Long partialAmount) {
		var total = payment.path("details").path("totals").path("grand_total").asLong();
		var approved = adjustments.stream().filter(a -> List.of("refund", "chargeback", "credit").contains(a.path("action").asText()) && a.path("status").asText().equals("approved")).toList();
		var refunded = approved.stream().mapToLong(a -> a.path("totals").path("total").asLong()).sum();
		var remaining = total - refunded;
		var amount = partialAmount == null ? remaining : partialAmount;
		if (amount <= 0 || amount > remaining) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Refund amount must be positive and no greater than the remaining payment balance.");
		var body = new java.util.HashMap<String, Object>();
		if (amount == total && refunded == 0) { body.put("type", "full"); return body; }
		var items = new ArrayList<Map<String, String>>();
		for (var item : payment.path("details").path("line_items")) {
			var id = item.path("id").asText();
			long used = 0;
			for (var adjustment : approved) for (var prior : adjustment.path("items"))
				if (id.equals(prior.path("item_id").asText())) used += prior.path("totals").path("total").asLong();
			var part = Math.min(amount, Math.max(0, item.path("totals").path("total").asLong() - used));
			if (part > 0) items.add(Map.of("item_id", id, "type", "partial", "amount", Long.toString(part)));
			amount -= part;
			if (amount == 0) break;
		}
		if (amount != 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "The remaining refundable line amounts could not be verified. Review this payment in Paddle.");
		body.put("type", "partial");
		body.put("items", items);
		return body;
	}

	public void acceptAdjustment(JsonNode adjustment) {
		var subscriptionId = adjustment.path("subscription_id").asText("");
		var subscription = repository.find(subscriptionId);
		if (subscription == null || !reducesPayment(adjustment)) return;
		var matcher = REFERENCE.matcher(adjustment.path("reason").asText());
		var hasReference = matcher.find();
		var endsAccess = hasReference && matcher.group(2).equals("end");
		var transactionId = adjustment.path("transaction_id").asText();
		// Refunds made directly in Paddle must also revoke an entirely refunded current period.
		if (!hasReference && adjustment.path("action").asText().equals("refund") && adjustment.path("type").asText().equals("full")) {
			var payment = paddle.get("/transactions/" + transactionId);
			repository.savePayment(payment);
			var end = BillingRepository.instant(payment.path("billing_period"), "ends_at");
			endsAccess = !payment.path("origin").asText().equals("subscription_update")
					&& end != null && subscription.periodEnd() != null && !end.isBefore(subscription.periodEnd());
		}
		var id = adjustment.path("id").asText();
		var version = BillingRepository.instant(adjustment, "updated_at");
		var rows = repository.jdbc().queryForList("select provider_updated_at from billing_refund where adjustment_id = ?", id);
		if (!rows.isEmpty()) {
			var stored = (java.sql.Timestamp) rows.getFirst().get("provider_updated_at");
			if (stored != null && version != null && version.isBefore(stored.toInstant())) return;
			repository.jdbc().update("update billing_refund set status = ?, provider_updated_at = ? where adjustment_id = ? and (provider_updated_at is null or provider_updated_at <= ?)", adjustment.path("status").asText(), BillingRepository.timestamp(version), id, BillingRepository.timestamp(version));
		} else {
			repository.jdbc().update("insert ignore into billing_refund (adjustment_id, transaction_id, subscription_id, status, amount, currency_code, reason, ends_access, provider_updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)",
					id, transactionId, subscriptionId, adjustment.path("status").asText(), adjustment.path("totals").path("total").asLong(),
					adjustment.path("currency_code").asText(), adjustment.path("reason").asText(), endsAccess, BillingRepository.timestamp(version));
		}
		if (hasReference) operations.confirm(matcher.group(1), "refund:" + transactionId, adjustment);
		if (adjustment.path("status").asText().equals("approved") && (endsAccess || adjustment.path("action").asText().equals("chargeback"))) {
			repository.endRefundedAccess(subscriptionId);
			sync.applyAccess(repository.find(subscriptionId));
		}
	}

	private boolean reducesPayment(JsonNode data) { return List.of("refund", "chargeback", "credit").contains(data.path("action").asText()); }
	private Refund refundView(JsonNode data) {
		return new Refund(data.path("id").asText(), data.path("status").asText(), data.path("totals").path("total").asLong(), data.path("reason").asText().replaceAll(" \\[FB:[^]]+]", ""));
	}
	private void requireKnown(String id) { if (repository.find(id) == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Subscription not found."); }
	private void requireAdmin(CurrentUser user) { if (!user.admin()) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Administrator access is required."); }
	private ResponseStatusException badRequest(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }

	public record AdminSubscription(String id, long leagueId, String leagueName, String ownerEmail, String plan, String status, Instant periodEnd) { }
	public record Payment(String id, String currencyCode, long total, long refundable, Instant paidAt, boolean initialPurchase, boolean withinRefundWindow, List<Refund> refunds, boolean awaitingConfirmation) { }
	public record Refund(String id, String status, long amount, String reason) { }
}
