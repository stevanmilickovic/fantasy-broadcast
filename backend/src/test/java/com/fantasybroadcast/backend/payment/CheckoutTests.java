package com.fantasybroadcast.backend.payment;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.fantasybroadcast.backend.customer.CurrentUser;
import com.fantasybroadcast.backend.customer.LeagueRegistrationService;
import com.fantasybroadcast.backend.customer.UserRole;
import com.fantasybroadcast.backend.fpl.FplLeagueType;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class CheckoutTests {
	@Test
	void repeatedCheckoutUsesTheSameServerCreatedTransactionAndCannotCreateTwoSubscriptions() throws Exception {
		var db = new BillingTestDatabase();
		var properties = SubscriptionTests.properties();
		properties.setApiKey("pdl_sdbx_apikey_test"); properties.setClientSideToken("test_token"); properties.setWebhookSecretKey("sandbox-secret");
		var leagues = mock(LeagueRegistrationService.class);
		var paddle = mock(PaddleClient.class);
		var owner = new CurrentUser(1, "owner@example.com", "Owner", UserRole.USER);
		var service = new PaddleCheckoutService(properties, leagues, db.repository, paddle, db.operations);
		when(leagues.preview(100, FplLeagueType.DRAFT)).thenReturn(new LeagueRegistrationService.LeaguePreview("Test", 10, null));
		var transaction = db.json.readTree("{\"id\":\"txn_test\",\"status\":\"ready\",\"custom_data\":{\"terms_version\":\"2026-10-29\",\"accepted_policies\":true}}");
		when(paddle.post(eq("/transactions"), any())).thenReturn(transaction);
		when(paddle.get("/transactions/txn_test")).thenReturn(transaction);
		assertThat(service.createCheckout(owner, 100, FplLeagueType.DRAFT, "STANDARD", true, PaddleCheckoutService.TERMS_VERSION).transactionId()).isEqualTo("txn_test");
		assertThat(service.createCheckout(owner, 100, FplLeagueType.DRAFT, "STANDARD", true, PaddleCheckoutService.TERMS_VERSION).transactionId()).isEqualTo("txn_test");
		verify(paddle, times(1)).post(eq("/transactions"), any());
		db.repository.saveSubscription(1, new SubscriptionTests().subscription("active", "standard", Instant.now(), Instant.now().plus(Duration.ofDays(20))), BillingPlan.STANDARD);
		assertThatThrownBy(() -> service.createCheckout(owner, 100, FplLeagueType.DRAFT, "AI_BROADCASTER", true, PaddleCheckoutService.TERMS_VERSION)).isInstanceOf(ResponseStatusException.class).hasMessageContaining("already has a subscription");
		verify(paddle, times(1)).post(eq("/transactions"), any());
	}

	@Test
	void disabledAiRejectsCheckoutButStandardWorksWithoutAnAiPrice() throws Exception {
		var db = new BillingTestDatabase();
		var properties = SubscriptionTests.properties();
		properties.setAiBroadcasterEnabled(false);
		properties.setAiBroadcasterPriceId("");
		properties.setApiKey("pdl_sdbx_apikey_test"); properties.setClientSideToken("test_token"); properties.setWebhookSecretKey("sandbox-secret");
		var leagues = mock(LeagueRegistrationService.class);
		var paddle = mock(PaddleClient.class);
		var owner = new CurrentUser(1, "owner@example.com", "Owner", UserRole.USER);
		var service = new PaddleCheckoutService(properties, leagues, db.repository, paddle, db.operations);
		when(leagues.preview(100, FplLeagueType.DRAFT)).thenReturn(new LeagueRegistrationService.LeaguePreview("Test", 10, null));
		assertThatThrownBy(() -> service.createCheckout(owner, 100, FplLeagueType.DRAFT, "AI_BROADCASTER", true, PaddleCheckoutService.TERMS_VERSION))
				.isInstanceOf(ResponseStatusException.class).hasMessageContaining("AI Broadcaster is currently unavailable");
		verifyNoInteractions(paddle);
		when(paddle.post(eq("/transactions"), any())).thenReturn(db.json.readTree("{\"id\":\"txn_standard\"}"));
		assertThat(service.createCheckout(owner, 100, FplLeagueType.DRAFT, "STANDARD", true, PaddleCheckoutService.TERMS_VERSION).transactionId()).isEqualTo("txn_standard");
		properties.setAiBroadcasterEnabled(true);
		assertThat(properties.isConfigured()).isFalse();
	}

	@Test
	void customersCannotUseTheOldFreeRegistrationEndpoint() {
		var security = new com.fantasybroadcast.backend.security.BroadcastSecurityProperties();
		security.setLeagueRegistrationEnabled(true);
		var fpl = mock(com.fantasybroadcast.backend.fpl.FplDraftClient.class);
		var leagues = new LeagueRegistrationService(mock(org.springframework.jdbc.core.JdbcTemplate.class), fpl, security);
		assertThatThrownBy(() -> leagues.register(new CurrentUser(1, "owner@example.com", "Owner", UserRole.USER), 100, FplLeagueType.DRAFT))
				.isInstanceOf(ResponseStatusException.class).hasMessageContaining("paid checkout");
		verifyNoInteractions(fpl);
	}
}
