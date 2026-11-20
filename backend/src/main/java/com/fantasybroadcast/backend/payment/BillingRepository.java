package com.fantasybroadcast.backend.payment;

import com.fantasybroadcast.backend.fpl.FplLeagueType;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Repository
@Profile("db & !test")
public class BillingRepository {
	private final JdbcTemplate jdbc;
	private final TransactionTemplate transactions;
	private final ObjectMapper json;

	public BillingRepository(JdbcTemplate jdbc, TransactionTemplate transactions, ObjectMapper json) {
		this.jdbc = jdbc;
		this.transactions = transactions;
		this.json = json;
	}

	public Subscription find(String providerId) {
		return jdbc.query("select s.*, l.owner_user_id from subscription s join league l on l.id = s.league_id where billing_subscription_id = ?", this::map, providerId).stream().findFirst().orElse(null);
	}

	public Subscription forLeague(long leagueId) {
		return jdbc.query("select s.*, l.owner_user_id from subscription s join league l on l.id = s.league_id where league_id = ? order by s.id desc limit 1", this::map, leagueId).stream().findFirst().orElse(null);
	}

	public List<LeagueSubscription> forOwner(long ownerId) {
		return jdbc.query("""
				select s.*, l.owner_user_id, l.display_name, l.fpl_league_id, l.league_type
				from league l
				join subscription s on s.id = (
					select max(previous.id) from subscription previous where previous.league_id = l.id
				)
				where l.owner_user_id = ?
				order by l.display_name, l.id
				""", (rs, row) -> new LeagueSubscription(rs.getString("display_name"), rs.getLong("fpl_league_id"),
						FplLeagueType.valueOf(rs.getString("league_type")), map(rs, row)), ownerId);
	}

	public List<Subscription> all() {
		return jdbc.query("select s.*, l.owner_user_id from subscription s join league l on l.id = s.league_id order by s.id", this::map);
	}

	public boolean activeForSource(long sourceId, String type) {
		return jdbc.queryForObject("select count(*) from subscription s join league l on l.id = s.league_id where l.fpl_league_id = ? and l.league_type = ? and s.status <> 'canceled'", Integer.class, sourceId, type) > 0;
	}

	public void saveSubscription(long leagueId, JsonNode data, BillingPlan plan) {
		transactions.executeWithoutResult(status -> {
			jdbc.queryForObject("select id from league where id = ? for update", Long.class, leagueId);
			var id = data.path("id").asText();
			var current = find(id);
			var version = instant(data, "updated_at");
			if (current != null && current.version() != null && version != null && version.isBefore(current.version())) return;
			if (current == null) {
				var existing = forLeague(leagueId);
				if (existing != null && !existing.status().equals("canceled"))
					throw new ResponseStatusException(HttpStatus.CONFLICT, "This league already has an active subscription. Contact support to resolve the duplicate payment.");
				jdbc.update("insert into subscription (league_id, billing_provider, billing_subscription_id, billing_customer_id, plan_code, status) values (?, 'PADDLE', ?, ?, ?, ?)",
						leagueId, id, data.path("customer_id").asText(), plan.name(), data.path("status").asText());
				current = find(id);
			}
			var state = data.path("status").asText();
			var end = instant(data.path("current_billing_period"), "ends_at");
			var start = instant(data.path("current_billing_period"), "starts_at");
			// A failed renewal must not turn the newly invoiced month into another paid month.
			if (state.equals("past_due")) end = current.periodEnd();
			if (end == null) end = current.periodEnd();
			var cancelAt = data.path("scheduled_change").path("action").asText().equals("cancel")
					? instant(data.path("scheduled_change"), "effective_at") : null;
			var pastDue = state.equals("past_due") ? (current.pastDueSince() == null ? Instant.now() : current.pastDueSince()) : null;
			jdbc.update("""
					update subscription set billing_customer_id = ?, plan_code = ?, status = ?, ai_enabled = ?,
					current_period_start = ?, current_period_end = ?, cancel_at = ?, past_due_since = ?, provider_updated_at = ?, synced_at = current_timestamp, updated_at = current_timestamp
					where billing_subscription_id = ?
					""", data.path("customer_id").asText(), plan.name(), state, plan == BillingPlan.AI_BROADCASTER,
					timestamp(start), timestamp(end), timestamp(cancelAt), timestamp(pastDue), timestamp(version), id);
		});
	}

	public void retainAi(String subscriptionId, Instant until) {
		jdbc.update("update subscription set ai_access_until = ? where billing_subscription_id = ?", timestamp(until), subscriptionId);
	}

	public void endRefundedAccess(String subscriptionId) {
		jdbc.update("update subscription set refund_ends_access = true where billing_subscription_id = ?", subscriptionId);
	}

	public void savePayment(JsonNode payment) {
		var id = payment.path("id").asText();
		jdbc.update("insert ignore into billing_payment (transaction_id, subscription_id, origin, status, currency_code, total, paid_at, snapshot) values (?, ?, ?, ?, ?, ?, ?, ?)",
					id, payment.path("subscription_id").asText(), payment.path("origin").asText(), payment.path("status").asText(), payment.path("currency_code").asText(),
					payment.path("details").path("totals").path("grand_total").asLong(), timestamp(paymentTime(payment)), json.writeValueAsString(payment));
		var periodEnd = instant(payment.path("billing_period"), "ends_at");
		if (periodEnd != null && payment.path("status").asText().equals("completed"))
			jdbc.update("update subscription set current_period_end = ? where billing_subscription_id = ? and (current_period_end is null or current_period_end < ?)",
					timestamp(periodEnd), payment.path("subscription_id").asText(), timestamp(periodEnd));
	}

	public List<JsonNode> payments(String subscriptionId) {
		return jdbc.query("select snapshot from billing_payment where subscription_id = ? order by paid_at desc", (rs, row) -> json.readTree(rs.getString(1)), subscriptionId);
	}

	public static Instant paymentTime(JsonNode payment) {
		var billed = instant(payment, "billed_at");
		return billed == null ? instant(payment, "created_at") : billed;
	}

	public JdbcTemplate jdbc() { return jdbc; }
	public static Instant instant(JsonNode node, String field) {
		var value = node.path(field).asText("");
		return value.isBlank() ? null : Instant.parse(value);
	}
	public static Timestamp timestamp(Instant value) { return value == null ? null : Timestamp.from(value); }
	private static Instant instant(ResultSet rs, String column) throws SQLException {
		var value = rs.getTimestamp(column);
		return value == null ? null : value.toInstant();
	}
	private Subscription map(ResultSet rs, int row) throws SQLException {
		return new Subscription(rs.getLong("league_id"), rs.getLong("owner_user_id"), rs.getString("billing_subscription_id"), rs.getString("billing_customer_id"),
				BillingPlan.valueOf(rs.getString("plan_code")), rs.getString("status"), instant(rs, "current_period_end"), instant(rs, "ai_access_until"),
				instant(rs, "cancel_at"), instant(rs, "past_due_since"), instant(rs, "provider_updated_at"), rs.getBoolean("refund_ends_access"));
	}

	public record LeagueSubscription(String leagueName, long fplLeagueId, FplLeagueType leagueType, Subscription subscription) { }

	public record Subscription(long leagueId, long ownerId, String id, String customerId, BillingPlan renewalPlan, String status,
			Instant periodEnd, Instant aiUntil, Instant cancelAt, Instant pastDueSince, Instant version, boolean refunded) {
		public Instant accessUntil() {
			return status.equals("past_due") && periodEnd != null ? periodEnd.plus(java.time.Duration.ofDays(3)) : periodEnd;
		}
		public boolean accessible(Instant now) {
			return !refunded && List.of("active", "trialing", "past_due").contains(status) && accessUntil() != null && now.isBefore(accessUntil())
					&& (cancelAt == null || now.isBefore(cancelAt));
		}
		public BillingPlan effectivePlan(Instant now) {
			return aiUntil != null && now.isBefore(aiUntil) ? BillingPlan.AI_BROADCASTER : renewalPlan;
		}
	}
}
