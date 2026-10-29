package com.fantasybroadcast.backend.api;

import com.fantasybroadcast.backend.payment.PaddleProperties;
import org.springframework.context.annotation.Profile;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Only Paddle's browser-safe token is public; API keys and webhook secrets stay on the server. */
@RestController
@Profile("db & !test")
@RequestMapping("/api/paddle")
public class PaddleConfigurationController {
	private final PaddleProperties properties;

	public PaddleConfigurationController(PaddleProperties properties) {
		this.properties = properties;
	}

	@GetMapping("/configuration")
	public ResponseEntity<?> configuration() {
		if (!properties.isConfigured()) {
			return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).cacheControl(CacheControl.noStore())
					.body(ProblemDetail.forStatusAndDetail(HttpStatus.SERVICE_UNAVAILABLE,
							"Payment checkout is currently unavailable. Please try again later or contact support."));
		}
		return ResponseEntity.ok().cacheControl(CacheControl.noStore())
				.body(new CheckoutConfiguration(properties.getClientSideToken()));
	}

	public record CheckoutConfiguration(String clientSideToken) { }
}
