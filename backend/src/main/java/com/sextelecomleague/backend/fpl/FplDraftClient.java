package com.sextelecomleague.backend.fpl;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Component
public class FplDraftClient {

	private final FplDraftProperties properties;
	private final ObjectMapper objectMapper;
	private final HttpClient httpClient;

	public FplDraftClient(FplDraftProperties properties, ObjectMapper objectMapper) {
		this.properties = properties;
		this.objectMapper = objectMapper;
		this.httpClient = HttpClient.newHttpClient();
	}

	public JsonNode getDraftBootstrapStatic() {
		return getJson(properties.getDraftBaseUrl() + "/bootstrap-static");
	}

	public JsonNode getLeagueDetails(long leagueId) {
		return getJson(properties.getDraftBaseUrl() + "/league/" + leagueId + "/details");
	}

	public JsonNode getDraftChoices(long draftId) {
		return getJson(properties.getDraftBaseUrl() + "/draft/" + draftId + "/choices");
	}

	public JsonNode getFantasyEventLive(int eventId) {
		return getJson(properties.getFantasyBaseUrl() + "/event/" + eventId + "/live/");
	}

	private JsonNode getJson(String url) {
		var request = HttpRequest.newBuilder(URI.create(url))
				.header("Accept", "application/json")
				.header("User-Agent", "stk-broadcast/0.1")
				.GET()
				.build();
		try {
			var response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
			if (response.statusCode() < 200 || response.statusCode() >= 300) {
				throw new FplDraftClientException("FPL request failed: " + response.statusCode() + " " + url);
			}
			return objectMapper.readTree(response.body());
		}
		catch (IOException exception) {
			throw new UncheckedIOException("FPL request failed: " + url, exception);
		}
		catch (InterruptedException exception) {
			Thread.currentThread().interrupt();
			throw new FplDraftClientException("FPL request interrupted: " + url, exception);
		}
	}
}
