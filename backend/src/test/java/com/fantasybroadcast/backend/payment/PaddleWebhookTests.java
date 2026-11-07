package com.fantasybroadcast.backend.payment;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.fantasybroadcast.backend.api.PaddleWebhookController;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;

class PaddleWebhookTests {
	@Test
	void signedEventsAreSavedBeforeAcknowledgmentAndDuplicatesRunOnlyOnce() throws Exception {
		var fixture = new Fixture();
		var request = fixture.request("evt_payment", "transaction.completed");
		assertThat(fixture.controller.webhook(request).getStatusCode()).isEqualTo(HttpStatus.OK);
		assertThat(fixture.controller.webhook(fixture.request("evt_payment", "transaction.completed")).getStatusCode()).isEqualTo(HttpStatus.OK);
		verifyNoInteractions(fixture.subscriptions, fixture.refunds);
		assertThat(fixture.db.jdbc.queryForObject("select count(*) from billing_event where processed_at is null and payload is not null", Integer.class)).isEqualTo(1);
		fixture.processor.processPending();
		fixture.processor.processPending();
		verify(fixture.subscriptions, times(1)).acceptPayment(any());
		assertThat(fixture.db.jdbc.queryForObject("select count(*) from billing_event where processed_at is not null and payload is null", Integer.class)).isEqualTo(1);
		fixture.controller.webhook(fixture.request("evt_payment", "transaction.completed"));
		fixture.processor.processPending();
		verifyNoMoreInteractions(fixture.subscriptions);
	}

	@Test
	void invalidOrExpiredSignaturesNeverEnterTheInboxAndDatabaseFailuresAreNotAcknowledged() throws Exception {
		var fixture = new Fixture();
		var tampered = fixture.request("evt_invalid", "subscription.updated");
		tampered.setContent("{}".getBytes(StandardCharsets.UTF_8));
		assertThat(fixture.controller.webhook(tampered).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
		var expired = fixture.request("evt_expired", "subscription.updated", Instant.now().minusSeconds(301).getEpochSecond());
		assertThat(fixture.controller.webhook(expired).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
		assertThat(fixture.db.jdbc.queryForObject("select count(*) from billing_event", Integer.class)).isZero();
		var failedStorage = mock(PaddleWebhookProcessor.class);
		doThrow(new DataAccessResourceFailureException("Database unavailable")).when(failedStorage).enqueue(anyString(), anyString());
		var controller = new PaddleWebhookController(fixture.properties, fixture.db.json, failedStorage);
		assertThatThrownBy(() -> controller.webhook(fixture.request("evt_unstored", "subscription.updated")))
				.isInstanceOf(DataAccessResourceFailureException.class);
		fixture.properties.setWebhookSecretKey("");
		assertThat(fixture.controller.webhook(fixture.request("evt_disabled", "subscription.updated")).getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
	}

	@Test
	void slowApiCallsDoNotBlockAcknowledgmentOrAllowAnotherWorkerToClaimTheEvent() throws Exception {
		var fixture = new Fixture();
		fixture.controller.webhook(fixture.request("evt_slow", "subscription.updated"));
		var started = new CountDownLatch(1);
		var release = new CountDownLatch(1);
		when(fixture.subscriptions.refresh("sub_test")).thenAnswer(call -> {
			started.countDown();
			if (!release.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Test did not release API call");
			return fixture.db.json.createObjectNode();
		});
		try (var executor = Executors.newSingleThreadExecutor()) {
			var processing = executor.submit(fixture.processor::processPending);
			try {
				assertThat(started.await(5, TimeUnit.SECONDS)).isTrue();
				org.junit.jupiter.api.Assertions.assertTimeoutPreemptively(Duration.ofSeconds(2), () ->
						assertThat(fixture.controller.webhook(fixture.request("evt_slow", "subscription.updated")).getStatusCode()).isEqualTo(HttpStatus.OK));
				fixture.newProcessor().processPending();
				verify(fixture.subscriptions, times(1)).refresh("sub_test");
			} finally {
				release.countDown();
			}
			processing.get(5, TimeUnit.SECONDS);
		}
	}

	@Test
	void failedEventsSurviveWorkerRestartAndExpiredClaimsAreRecovered() throws Exception {
		var fixture = new Fixture();
		fixture.controller.webhook(fixture.request("evt_retry", "subscription.updated"));
		when(fixture.subscriptions.refresh("sub_test")).thenThrow(new PaddleClient.UncertainResult("Timeout")).thenReturn(fixture.db.json.createObjectNode());
		fixture.processor.processPending();
		assertThat(fixture.db.jdbc.queryForObject("select payload from billing_event where event_id = 'evt_retry'", String.class)).isNotBlank();
		fixture.newProcessor().processPending();
		verify(fixture.subscriptions, times(1)).refresh("sub_test");
		fixture.db.jdbc.update("update billing_event set next_attempt_at = ?, locked_until = ? where event_id = 'evt_retry'",
				BillingRepository.timestamp(Instant.now().minusSeconds(2)), BillingRepository.timestamp(Instant.now().minusSeconds(1)));
		fixture.newProcessor().processPending();
		verify(fixture.subscriptions, times(2)).refresh("sub_test");
		assertThat(fixture.db.jdbc.queryForObject("select processed_at from billing_event where event_id = 'evt_retry'", java.sql.Timestamp.class)).isNotNull();
	}

	@Test
	void existingProcessedEventsStayProcessedAndRefundEventsAreRouted() throws Exception {
		var fixture = new Fixture();
		fixture.db.jdbc.update("insert into billing_event (event_id) values ('evt_previous')");
		fixture.controller.webhook(fixture.request("evt_previous", "transaction.completed"));
		fixture.controller.webhook(fixture.request("evt_refund", "adjustment.updated"));
		fixture.processor.processPending();
		verifyNoInteractions(fixture.subscriptions);
		verify(fixture.refunds).acceptAdjustment(any());
	}

	private static class Fixture {
		final BillingTestDatabase db = new BillingTestDatabase();
		final PaddleProperties properties = new PaddleProperties();
		final SubscriptionSyncService subscriptions = mock(SubscriptionSyncService.class);
		final RefundService refunds = mock(RefundService.class);
		final PaddleWebhookProcessor processor = newProcessor();
		final PaddleWebhookController controller = new PaddleWebhookController(properties, db.json, processor);

		Fixture() throws Exception {
			properties.setWebhookSecretKey("webhook-secret");
		}

		PaddleWebhookProcessor newProcessor() {
			return new PaddleWebhookProcessor(db.jdbc, db.json, subscriptions, refunds);
		}

		MockHttpServletRequest request(String id, String type) throws Exception {
			return request(id, type, Instant.now().getEpochSecond());
		}

		MockHttpServletRequest request(String id, String type, long timestamp) throws Exception {
			var body = "{\"event_id\":\"" + id + "\",\"event_type\":\"" + type + "\",\"data\":{\"id\":\"sub_test\"}}";
			var mac = Mac.getInstance("HmacSHA256");
			mac.init(new SecretKeySpec("webhook-secret".getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
			var signature = HexFormat.of().formatHex(mac.doFinal((timestamp + ":" + body).getBytes(StandardCharsets.UTF_8)));
			var request = new MockHttpServletRequest();
			request.setContent(body.getBytes(StandardCharsets.UTF_8));
			request.addHeader("Paddle-Signature", "ts=" + timestamp + ";h1=" + signature);
			return request;
		}
	}
}
