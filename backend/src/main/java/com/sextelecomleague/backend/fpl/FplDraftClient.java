package com.sextelecomleague.backend.fpl;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.springframework.stereotype.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Component
public class FplDraftClient {
	private static final Logger log = LoggerFactory.getLogger(FplDraftClient.class);

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

	public JsonNode getFantasyBootstrapStatic() {
		return getJson(properties.getFantasyBaseUrl() + "/bootstrap-static/");
	}

	public JsonNode getFantasyFixtures() {
		return getJson(properties.getFantasyBaseUrl() + "/fixtures/");
	}

	public JsonNode getLeagueDetails(long leagueId) {
		return getJson(properties.getDraftBaseUrl() + "/league/" + leagueId + "/details");
	}

	public JsonNode getLeagueElementStatus(long leagueId) {
		return getJson(properties.getDraftBaseUrl() + "/league/" + leagueId + "/element-status");
	}

	public JsonNode getLeagueTransactions(long leagueId) {
		return getJson(properties.getDraftBaseUrl() + "/draft/league/" + leagueId + "/transactions");
	}

	public JsonNode getDraftChoices(long draftId) {
		return getJson(properties.getDraftBaseUrl() + "/draft/" + draftId + "/choices");
	}

	public JsonNode getEntryEvent(long entryId, int eventId) {
		return getJson(properties.getDraftBaseUrl() + "/entry/" + entryId + "/event/" + eventId);
	}

	public JsonNode getDraftEventLive(int eventId) {
		return getJson(properties.getDraftBaseUrl() + "/event/" + eventId + "/live");
	}

	public JsonNode getFantasyEventLive(int eventId) {
		return getJson(properties.getFantasyBaseUrl() + "/event/" + eventId + "/live/");
	}

	public JsonNode getFantasyEntryEvent(long entryId, int eventId) {
		return getJson(properties.getFantasyBaseUrl() + "/entry/" + entryId + "/event/" + eventId + "/picks/");
	}

	public JsonNode getClassicLeagueStandings(long leagueId) {
		return getJson(properties.getFantasyBaseUrl() + "/leagues-h2h/" + leagueId
				+ "/standings/?page_new_entries=1&page_standings=1");
	}

	public JsonNode getClassicPointsLeagueStandings(long leagueId) {
		return getJson(properties.getFantasyBaseUrl() + "/leagues-classic/" + leagueId
				+ "/standings/?page_new_entries=1&page_standings=1");
	}

	public JsonNode getClassicLeagueMatches(long leagueId, int eventId) {
		return getJson(properties.getFantasyBaseUrl() + "/leagues-h2h-matches/league/" + leagueId + "/?event=" + eventId);
	}

	private JsonNode getJson(String url) {
		var request = HttpRequest.newBuilder(URI.create(url))
				.header("Accept", "application/json")
				.header("User-Agent", "stk-broadcast/0.1")
				.header("Cache-Control", "no-cache, no-store, max-age=0")
				.header("Pragma", "no-cache")
				.GET()
				.build();
		try {
			var response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
			log.info("FPL response: status={}, url={}, cache-control={}, age={}", response.statusCode(), url,
					response.headers().firstValue("cache-control").orElse("—"), response.headers().firstValue("age").orElse("—"));
			if (response.statusCode() < 200 || response.statusCode() >= 300) {
				throw new FplDraftClientException(
						"FPL request failed: " + response.statusCode() + " " + url,
						response.statusCode(),
						url,
						preview(response.body()));
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

	private String preview(String body) {
		if (body == null || body.isBlank()) {
			return "";
		}
		var compactBody = body.replaceAll("\\s+", " ").trim();
		if (compactBody.length() <= 500) {
			return compactBody;
		}
		return compactBody.substring(0, 500);
	}
}
