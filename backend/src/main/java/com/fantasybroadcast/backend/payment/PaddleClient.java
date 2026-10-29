package com.fantasybroadcast.backend.payment;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Component
@Profile("db & !test")
public class PaddleClient {

	private final PaddleProperties properties;
	private final ObjectMapper json;
	private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

	public PaddleClient(PaddleProperties properties, ObjectMapper json) {
		this.properties = properties;
		this.json = json;
	}

	public boolean configured() { return properties.isConfigured(); }
	public JsonNode get(String path) { return request("GET", path, null).path("data"); }
	public JsonNode post(String path, Object body) { return request("POST", path, body).path("data"); }
	public JsonNode patch(String path, Object body) { return request("PATCH", path, body).path("data"); }

	public List<JsonNode> list(String path) {
		var result = new ArrayList<JsonNode>();
		var next = path;
		do {
			var page = request("GET", next, null);
			page.path("data").forEach(result::add);
			var pagination = page.path("meta").path("pagination");
			next = pagination.path("has_more").asBoolean(false) ? pagination.path("next").asText("") : "";
			if (!next.isBlank()) {
				var uri = URI.create(next);
				if (uri.isAbsolute() && !URI.create(properties.getApiUrl()).getAuthority().equals(uri.getAuthority()))
					throw new IllegalStateException("Unexpected Paddle pagination host.");
				next = uri.getRawPath() + (uri.getRawQuery() == null ? "" : "?" + uri.getRawQuery());
			}
		} while (!next.isBlank());
		return result;
	}

	private JsonNode request(String method, String path, Object body) {
		if (!configured()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Subscription billing is not configured.");
		try {
			var publisher = body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body));
			var request = HttpRequest.newBuilder(URI.create(properties.getApiUrl() + path))
					.timeout(Duration.ofSeconds(40)).header("Authorization", "Bearer " + properties.getApiKey())
					.header("Content-Type", "application/json").method(method, publisher).build();
			var response = http.send(request, HttpResponse.BodyHandlers.ofString());
			if (response.statusCode() >= 400) {
				if (response.statusCode() >= 500 || response.statusCode() == 429)
					throw new UncertainResult("Paddle did not confirm the request. Refresh its status before trying again.");
				throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
						"Paddle could not complete this request. Check the payment details and subscription status, then refresh.");
			}
			return json.readTree(response.body());
		} catch (InterruptedException exception) {
			Thread.currentThread().interrupt();
			throw new UncertainResult("Paddle did not confirm the request. Refresh its status before trying again.");
		} catch (java.io.IOException exception) {
			throw new UncertainResult("Paddle did not confirm the request. Refresh its status before trying again.");
		}
	}

	public static class UncertainResult extends ResponseStatusException {
		public UncertainResult(String message) { super(HttpStatus.SERVICE_UNAVAILABLE, message); }
	}
}
