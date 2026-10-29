package com.fantasybroadcast.backend.api;

import com.fantasybroadcast.backend.payment.PaddleProperties;
import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("db & !test")
@RequestMapping("/api/paddle")
public class PaddleWebhookController {
	private final PaddleProperties properties;
	private final com.fantasybroadcast.backend.payment.SubscriptionSyncService subscriptions;
	private final com.fantasybroadcast.backend.payment.RefundService refunds;
	private final com.fantasybroadcast.backend.payment.BillingRepository billing;
	private final tools.jackson.databind.ObjectMapper objectMapper;

	public PaddleWebhookController(PaddleProperties properties, tools.jackson.databind.ObjectMapper objectMapper,
			com.fantasybroadcast.backend.payment.SubscriptionSyncService subscriptions, com.fantasybroadcast.backend.payment.RefundService refunds, com.fantasybroadcast.backend.payment.BillingRepository billing) {
		this.properties = properties; this.objectMapper = objectMapper;
		this.subscriptions = subscriptions; this.refunds = refunds; this.billing = billing;
	}

	@PostMapping("/webhook")
	public ResponseEntity<Void> webhook(HttpServletRequest request) throws Exception {
		if (!properties.isWebhookConfigured()) return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
		var body = new String(request.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
		if (!validSignature(request.getHeader("Paddle-Signature"), body)) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
		var event = objectMapper.readTree(body);
		var id = event.path("event_id").asText("");
		if (id.isBlank()) return ResponseEntity.badRequest().build();
		if (billing.jdbc().queryForObject("select count(*) from billing_event where event_id = ?", Integer.class, id) > 0) return ResponseEntity.ok().build();
		var type = event.path("event_type").asText();
		var data = event.path("data");
		if (type.equals("transaction.completed")) subscriptions.acceptPayment(data);
		else if (type.startsWith("subscription.")) subscriptions.refresh(data.path("id").asText());
		else if (type.startsWith("adjustment.")) refunds.acceptAdjustment(data);
		billing.jdbc().update("insert ignore into billing_event (event_id) values (?)", id);
		return ResponseEntity.ok().build();
	}

	private boolean validSignature(String header, String body) {
		if (header == null) return false;
		String timestamp = null; String signature = null;
		for (var part : header.split(";")) { var pair = part.trim().split("=", 2); if (pair.length == 2 && pair[0].equals("ts")) timestamp = pair[1]; else if (pair.length == 2 && pair[0].equals("h1")) signature = pair[1]; }
		if (timestamp == null || signature == null) return false;
		try {
			if (Math.abs(Instant.now().getEpochSecond() - Long.parseLong(timestamp)) > 300) return false;
			var mac = Mac.getInstance("HmacSHA256"); mac.init(new SecretKeySpec(properties.getWebhookSecretKey().getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
			var expected = HexFormat.of().formatHex(mac.doFinal((timestamp + ":" + body).getBytes(StandardCharsets.UTF_8)));
			return MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), signature.getBytes(StandardCharsets.UTF_8));
		}
		catch (Exception exception) { return false; }
	}
}
