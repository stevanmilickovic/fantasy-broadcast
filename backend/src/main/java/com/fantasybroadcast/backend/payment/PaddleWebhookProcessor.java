package com.fantasybroadcast.backend.payment;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

@Component
@Profile("db & !test")
public class PaddleWebhookProcessor {

	private final JdbcTemplate jdbc;
	private final ObjectMapper json;
	private final SubscriptionSyncService subscriptions;
	private final RefundService refunds;

	public PaddleWebhookProcessor(JdbcTemplate jdbc, ObjectMapper json, SubscriptionSyncService subscriptions, RefundService refunds) {
		this.jdbc = jdbc;
		this.json = json;
		this.subscriptions = subscriptions;
		this.refunds = refunds;
	}

	public void enqueue(String eventId, String payload) {
		try {
			jdbc.update("insert into billing_event (event_id, payload, processed_at, next_attempt_at) values (?, ?, null, ?)",
					eventId, payload, BillingRepository.timestamp(Instant.now().truncatedTo(ChronoUnit.SECONDS)));
		} catch (DuplicateKeyException duplicate) {
			// A retry must leave the original verified payload and its processing state intact.
		}
	}

	@Scheduled(fixedDelay = 1000, initialDelay = 1000)
	public void processPending() {
		var now = BillingRepository.timestamp(Instant.now());
		var ids = jdbc.queryForList("""
				select event_id from billing_event
				where processed_at is null and next_attempt_at <= ? and (locked_until is null or locked_until <= ?)
				order by next_attempt_at limit 20
				""", String.class, now, now);
		for (var id : ids) process(id);
	}

	private void process(String id) {
		var now = Instant.now();
		var lease = BillingRepository.timestamp(now.plusSeconds(300).truncatedTo(ChronoUnit.SECONDS));
		// The lease prevents another app instance from processing this event, and expires after a crash.
		var claimed = jdbc.update("""
				update billing_event set locked_until = ? where event_id = ? and processed_at is null
				and next_attempt_at <= ? and (locked_until is null or locked_until <= ?)
				""", lease, id, BillingRepository.timestamp(now), BillingRepository.timestamp(now));
		if (claimed == 0) return;
		try {
			var event = json.readTree(jdbc.queryForObject("select payload from billing_event where event_id = ?", String.class, id));
			var type = event.path("event_type").asText();
			var data = event.path("data");
			if (type.equals("transaction.completed")) subscriptions.acceptPayment(data);
			else if (type.startsWith("subscription.")) subscriptions.refresh(data.path("id").asText());
			else if (type.startsWith("adjustment.")) refunds.acceptAdjustment(data);
			jdbc.update("update billing_event set processed_at = current_timestamp, payload = null, locked_until = null where event_id = ? and locked_until = ?", id, lease);
		} catch (RuntimeException exception) {
			jdbc.update("update billing_event set next_attempt_at = ?, locked_until = null where event_id = ? and locked_until = ?",
					BillingRepository.timestamp(Instant.now().plusSeconds(30)), id, lease);
			LoggerFactory.getLogger(PaddleWebhookProcessor.class).warn("Paddle event {} will be retried: {}", id, exception.getClass().getSimpleName());
		}
	}
}
