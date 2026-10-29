package com.fantasybroadcast.backend.payment;

import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import com.fantasybroadcast.backend.fpl.FplDraftClient;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class BillingMaintenanceTests {
	@Test
	void seasonCompletionCancelsRenewalWithoutRemovingTheRemainingPaidPeriod() {
		var repository = mock(BillingRepository.class);
		var paddle = mock(PaddleClient.class);
		var sync = mock(SubscriptionSyncService.class);
		var fpl = mock(FplDraftClient.class);
		var now = Instant.now();
		var subscription = new BillingRepository.Subscription(1, 1, "sub_test", "ctm_test", BillingPlan.STANDARD, "active", now.plus(Duration.ofDays(20)), null, null, null, now, false);
		when(repository.all()).thenReturn(List.of(subscription));
		when(fpl.getFantasyFixtures()).thenReturn(new ObjectMapper().readTree("[{\"finished\":true,\"kickoff_time\":\"" + now.minus(Duration.ofDays(1)) + "\"}]"));
		var maintenance = new BillingMaintenance(repository, paddle, sync, mock(RefundService.class), fpl);
		maintenance.cancelAtSeasonEnd();
		verify(paddle).post("/subscriptions/sub_test/cancel", Map.of("effective_from", "next_billing_period"));
	}

	@Test
	void unfinishedSeasonAndMissingFixturesDoNotCancelSubscriptions() {
		var repository = mock(BillingRepository.class);
		var paddle = mock(PaddleClient.class);
		var fpl = mock(FplDraftClient.class);
		var now = Instant.now();
		var subscription = new BillingRepository.Subscription(1, 1, "sub_test", "ctm_test", BillingPlan.STANDARD, "active", now.plus(Duration.ofDays(20)), null, null, null, now, false);
		when(repository.all()).thenReturn(List.of(subscription));
		var json = new ObjectMapper();
		when(fpl.getFantasyFixtures()).thenReturn(json.readTree("[]"), json.readTree("[{\"finished\":false,\"kickoff_time\":\"" + now.plus(Duration.ofDays(70)) + "\"}]"));
		var maintenance = new BillingMaintenance(repository, paddle, mock(SubscriptionSyncService.class), mock(RefundService.class), fpl);
		maintenance.cancelAtSeasonEnd();
		maintenance.cancelAtSeasonEnd();
		verifyNoInteractions(paddle);
	}
}
