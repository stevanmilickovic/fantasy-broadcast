package com.fantasybroadcast.backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import com.fantasybroadcast.backend.fpl.FplDraftClientException;
import org.junit.jupiter.api.Test;

class ApiExceptionPrivacyTests {
	@Test void upstreamErrorBodiesAndMessagesStayOutOfCustomerResponses() throws Exception {
		var failure = new FplDraftClientException("Request failed for private@example.test", 503,
				"https://fantasy.premierleague.com/api/fixtures/", "{\"email\":\"private@example.test\"}");
		var response = new ApiExceptionHandler().handleFplDraftClientException(failure);
		assertThat(response.getStatusCode().value()).isEqualTo(502);
		assertThat(new tools.jackson.databind.ObjectMapper().writeValueAsString(response.getBody()))
				.contains("temporarily unavailable").doesNotContain("bodyPreview", "private@example.test");
	}
}
