package com.fantasybroadcast.backend.payment;

import com.fantasybroadcast.backend.fpl.FplDraftClient;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@Profile("db & !test")
public class BillingMaintenance {
	private final BillingRepository repository;
	private final PaddleClient paddle;
	private final SubscriptionSyncService sync;
	private final RefundService refunds;
	private final FplDraftClient fpl;

	public BillingMaintenance(BillingRepository repository, PaddleClient paddle, SubscriptionSyncService sync, RefundService refunds, FplDraftClient fpl) {
		this.repository = repository;
		this.paddle = paddle;
		this.sync = sync;
		this.refunds = refunds;
		this.fpl = fpl;
	}

	@Scheduled(fixedDelay = 30000, initialDelay = 15000)
	public void expireAccess() {
		for (var subscription : repository.all()) {
			sync.applyAccess(subscription);
			if (paddle.configured() && subscription.refunded() && !subscription.status().equals("canceled")) {
				try { sync.acceptSubscription(paddle.post("/subscriptions/" + subscription.id() + "/cancel", Map.of("effective_from", "immediately"))); }
				catch (RuntimeException exception) { logFailure("Refund cancellation", exception); }
			}
		}
	}

	@Scheduled(fixedDelay = 3600000, initialDelay = 30000)
	public void reconcile() {
		if (!paddle.configured()) return;
		try {
			// Also imports subscriptions purchased before lifecycle tracking was introduced.
			for (var subscription : paddle.list("/subscriptions?per_page=200&order_by=id[ASC]")) {
				if (repository.find(subscription.path("id").asText()) == null && !subscription.path("custom_data").path("application").asText().equals("fantasy-broadcast")) continue;
				try {
					sync.acceptSubscription(subscription);
					var stored = repository.find(subscription.path("id").asText());
					if (stored == null) continue;
				} catch (RuntimeException exception) { logFailure("Subscription reconciliation", exception); }
			}
			for (var payment : paddle.list("/transactions?status=draft,ready,completed&per_page=200")) {
				try {
					sync.recoverCheckout(payment);
					if (payment.path("status").asText().equals("completed") && repository.find(payment.path("subscription_id").asText()) != null) repository.savePayment(payment);
				} catch (RuntimeException exception) { logFailure("Payment reconciliation", exception); }
			}
			for (var adjustment : paddle.list("/adjustments?per_page=50")) {
				try { refunds.acceptAdjustment(adjustment); }
				catch (RuntimeException exception) { logFailure("Refund reconciliation", exception); }
			}
			cancelAtSeasonEnd();
		} catch (RuntimeException exception) { logFailure("Billing reconciliation", exception); }
	}

	void cancelAtSeasonEnd() {
		var fixtures = fpl.getFantasyFixtures();
		Instant lastKickoff = null;
		boolean allFinished = !fixtures.isEmpty();
		for (var fixture : fixtures) {
			if (!fixture.path("finished").asBoolean(false)) allFinished = false;
			var kickoff = BillingRepository.instant(fixture, "kickoff_time");
			if (kickoff != null && (lastKickoff == null || kickoff.isAfter(lastKickoff))) lastKickoff = kickoff;
		}
		if (lastKickoff == null) return;
		var finalMonth = lastKickoff.atZone(ZoneOffset.UTC).withDayOfMonth(1).toLocalDate().atStartOfDay(ZoneOffset.UTC).toInstant();
		for (var subscription : repository.all()) {
			if (!java.util.List.of("active", "past_due").contains(subscription.status()) || subscription.cancelAt() != null || subscription.periodEnd() == null) continue;
			var renewal = subscription.periodEnd();
			var renewalMonth = renewal.atZone(ZoneOffset.UTC).withDayOfMonth(1).toLocalDate().atStartOfDay(ZoneOffset.UTC).toInstant();
			if (allFinished || (renewal.isAfter(lastKickoff) && renewalMonth.isAfter(finalMonth))) {
				try { sync.acceptSubscription(paddle.post("/subscriptions/" + subscription.id() + "/cancel", Map.of("effective_from", "next_billing_period"))); }
				catch (RuntimeException exception) { logFailure("Season-end cancellation", exception); }
			}
		}
	}

	private void logFailure(String operation, RuntimeException exception) {
		LoggerFactory.getLogger(BillingMaintenance.class).warn("{} could not complete: {}", operation, exception.getClass().getSimpleName());
	}
}
