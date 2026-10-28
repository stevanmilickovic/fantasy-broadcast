package com.fantasybroadcast.backend.fpl;

import java.io.IOException;
import java.net.URI;
import java.time.Duration;
import java.time.Clock;
import java.time.Instant;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Autowired;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Component
public class FplDraftClient {
	private static final Logger log = LoggerFactory.getLogger(FplDraftClient.class);
	private static final int LIVE_CACHE_SECONDS = 10;

	private final FplDraftProperties properties;
	private final ObjectMapper objectMapper;
	private final HttpClient httpClient;
	private final Clock clock;
	private final ConcurrentHashMap<String, CachedJson> cache = new ConcurrentHashMap<>();

	@Autowired
	public FplDraftClient(FplDraftProperties properties, ObjectMapper objectMapper) {
		this(properties, objectMapper, Clock.systemUTC());
	}

	FplDraftClient(FplDraftProperties properties, ObjectMapper objectMapper, Clock clock) {
		this.properties = properties;
		this.objectMapper = objectMapper;
		this.clock = clock;
		this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(properties.getTimeoutSeconds())).build();
	}

	public JsonNode getDraftBootstrapStatic() {
		return getCachedJson(properties.getDraftBaseUrl() + "/bootstrap-static");
	}

	public JsonNode getFantasyBootstrapStatic() {
		return getCachedJson(properties.getFantasyBaseUrl() + "/bootstrap-static/");
	}

	public JsonNode getFantasyFixtures() {
		return getCachedJson(properties.getFantasyBaseUrl() + "/fixtures/");
	}

	public JsonNode getFantasyPlayerSummary(int playerId) {
		return getCachedJson(properties.getFantasyBaseUrl() + "/element-summary/" + playerId + "/");
	}

	public JsonNode getLeagueDetails(long leagueId) {
		return getCachedJson(properties.getDraftBaseUrl() + "/league/" + leagueId + "/details");
	}

	public JsonNode getLeagueElementStatus(long leagueId) {
		return getCachedJson(properties.getDraftBaseUrl() + "/league/" + leagueId + "/element-status");
	}

	public JsonNode getLeagueTransactions(long leagueId) {
		return getCachedJson(properties.getDraftBaseUrl() + "/draft/league/" + leagueId + "/transactions");
	}

	public JsonNode getDraftChoices(long draftId) {
		return getCachedJson(properties.getDraftBaseUrl() + "/draft/" + draftId + "/choices");
	}

	public JsonNode getEntryEvent(long entryId, int eventId) {
		return getCachedJson(properties.getDraftBaseUrl() + "/entry/" + entryId + "/event/" + eventId);
	}

	public JsonNode getDraftEventLive(int eventId) {
		return getCachedJson(properties.getDraftBaseUrl() + "/event/" + eventId + "/live");
	}

	public JsonNode getFantasyEventLive(int eventId) {
		return getCachedJson(properties.getFantasyBaseUrl() + "/event/" + eventId + "/live/");
	}

	public JsonNode getBroadcastDraftEventLive(int eventId) {
		return getCachedJson(properties.getDraftBaseUrl() + "/event/" + eventId + "/live", LIVE_CACHE_SECONDS);
	}

	public JsonNode getBroadcastFantasyEventLive(int eventId) {
		return getCachedJson(properties.getFantasyBaseUrl() + "/event/" + eventId + "/live/", LIVE_CACHE_SECONDS);
	}

	public JsonNode getFantasyEntryEvent(long entryId, int eventId) {
		return getCachedJson(properties.getFantasyBaseUrl() + "/entry/" + entryId + "/event/" + eventId + "/picks/");
	}

	public JsonNode getClassicLeagueStandings(long leagueId) {
		return getClassicLeagueStandings(leagueId, 1);
	}

	public JsonNode getClassicLeagueStandings(long leagueId, int page) {
		return getCachedJson(properties.getFantasyBaseUrl() + "/leagues-h2h/" + leagueId
				+ "/standings/?page_new_entries=1&page_standings=" + page);
	}

	public JsonNode getClassicPointsLeagueStandings(long leagueId) {
		return getClassicPointsLeagueStandings(leagueId, 1);
	}

	public JsonNode getClassicPointsLeagueStandings(long leagueId, int page) {
		return getCachedJson(properties.getFantasyBaseUrl() + "/leagues-classic/" + leagueId
				+ "/standings/?page_new_entries=1&page_standings=" + page);
	}

	public JsonNode getClassicLeagueMatches(long leagueId, int eventId) {
		return getCachedJson(properties.getFantasyBaseUrl() + "/leagues-h2h-matches/league/" + leagueId + "/?event=" + eventId);
	}

	private JsonNode getJson(String url) {
		var request = HttpRequest.newBuilder(URI.create(url))
				.timeout(Duration.ofSeconds(properties.getTimeoutSeconds()))
				.header("Accept", "application/json")
				.header("User-Agent", "fantasy-broadcast/0.1")
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
			throw new FplDraftClientException("FPL request failed: " + url, exception);
		}
		catch (InterruptedException exception) {
			Thread.currentThread().interrupt();
			throw new FplDraftClientException("FPL request interrupted: " + url, exception);
		}
	}

	private JsonNode getCachedJson(String url) {
		return getCachedJson(url, properties.getCacheTtlSeconds());
	}

	private JsonNode getCachedJson(String url, int maxAgeSeconds) {
		var cached = cache.compute(url, (key, previous) -> {
			var now = clock.instant();
			if (fresh(previous, maxAgeSeconds, now)) return previous;
			if (previous != null && previous.failure() != null && previous.retryAt().isAfter(now)) return previous;
			try {
				return new CachedJson(getJson(key), clock.instant(), null, Instant.EPOCH);
			}
			catch (RuntimeException exception) {
				return new CachedJson(previous == null ? null : previous.value(),
						previous == null ? Instant.EPOCH : previous.loadedAt(), exception,
						clock.instant().plusSeconds(LIVE_CACHE_SECONDS));
			}
		});
		if (cached.failure() != null && !fresh(cached, maxAgeSeconds, clock.instant())) throw cached.failure();
		return cached.value().deepCopy();
	}

	private boolean fresh(CachedJson cached, int maxAgeSeconds, Instant now) {
		return cached != null && cached.value() != null && cached.loadedAt().plusSeconds(maxAgeSeconds).isAfter(now);
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

	private record CachedJson(JsonNode value, Instant loadedAt, RuntimeException failure, Instant retryAt) { }
}
