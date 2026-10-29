package com.fantasybroadcast.backend.payment;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public enum BillingPlan {
	STANDARD, AI_BROADCASTER;

	public String price(PaddleProperties properties) {
		return this == STANDARD ? properties.getStandardPriceId() : properties.getAiBroadcasterPriceId();
	}

	public static BillingPlan fromPrice(String id, PaddleProperties properties) {
		for (var plan : values()) if (!id.isBlank() && id.equals(plan.price(properties))) return plan;
		throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Unrecognized subscription price. Contact support.");
	}
}
