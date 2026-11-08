package com.fantasybroadcast.backend.fpl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Supplier;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

class FplDraftClientCachingTests {

	private final MutableClock clock = new MutableClock();
	private final ConcurrentHashMap<String, AtomicInteger> requests = new ConcurrentHashMap<>();
	private final AtomicInteger status = new AtomicInteger(200);
	private HttpServer server;
	private FplDraftClient client;

	@BeforeEach
	void startServer() throws Exception {
		server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
		server.createContext("/", exchange -> {
			var count = requests.computeIfAbsent(exchange.getRequestURI().toString(), unused -> new AtomicInteger()).incrementAndGet();
			var body = ("{\"request\":" + count + "}").getBytes(StandardCharsets.UTF_8);
			exchange.sendResponseHeaders(status.get(), body.length);
			try (var output = exchange.getResponseBody()) { output.write(body); }
		});
		server.start();
		var properties = new FplDraftProperties();
		var base = "http://127.0.0.1:" + server.getAddress().getPort();
		properties.setDraftBaseUrl(base + "/draft");
		properties.setFantasyBaseUrl(base + "/classic");
		client = new FplDraftClient(properties, new ObjectMapper(), clock);
	}

	@AfterEach
	void stopServer() {
		if (server != null) server.stop(0);
	}

	@Test
	void staticMetadataKeepsHourlyCachingWhileMutableDataRefreshesOnDemand() {
		List<Supplier<JsonNode>> stable = List.of(client::getDraftBootstrapStatic, client::getFantasyBootstrapStatic,
				() -> client.getFantasyPlayerSummary(1), () -> client.getDraftChoices(1), () -> client.getLeagueTransactions(1));
		List<Supplier<JsonNode>> current = List.of(client::getCurrentFantasyBootstrapStatic, client::getCurrentDraftBootstrapStatic,
				client::getFantasyFixtures, () -> client.getLeagueDetails(1), () -> client.getLeagueElementStatus(1),
				() -> client.getEntryEvent(1,8), () -> client.getFantasyEntryEvent(1,8), () -> client.getClassicLeagueStandings(1),
				() -> client.getClassicPointsLeagueStandings(1), () -> client.getClassicLeagueMatches(1,8));
		current.forEach(call -> assertThat(call.get().path("request").asInt()).isEqualTo(1));
		clock.advance(29);
		current.forEach(call -> assertThat(call.get().path("request").asInt()).isEqualTo(1));
		clock.advance(1);
		current.forEach(call -> assertThat(call.get().path("request").asInt()).isEqualTo(2));
		stable.forEach(Supplier::get);
		clock.advance(3599);
		stable.forEach(call -> assertThat(call.get().path("request").asInt()).isEqualTo(call == stable.get(0) || call == stable.get(1) ? 2 : 1));
	}

	@Test
	void concurrentViewersShareOneUpstreamRequestAndCannotMutateTheCachedResponse() throws Exception {
		try (var executor = Executors.newFixedThreadPool(8)) {
			var start = new CountDownLatch(1);
			var results = new ArrayList<java.util.concurrent.Future<JsonNode>>();
			for (int i = 0; i < 8; i++) results.add(executor.submit(() -> {
				start.await();
				return client.getFantasyEventLive(8);
			}));
			start.countDown();
			for (var result : results) assertThat(result.get(5, TimeUnit.SECONDS).path("request").asInt()).isEqualTo(1);
		}
		var first = client.getFantasyEventLive(8);
		if (first instanceof ObjectNode object) object.put("request", 99);
		assertThat(client.getFantasyEventLive(8).path("request").asInt()).isEqualTo(1);
		assertThat(requests.get("/classic/event/8/live/").get()).isEqualTo(1);
	}

	@Test
	void broadcastsRefreshTheSameCacheEveryTenSecondsAndOrdinaryReadersReuseIt() {
		assertThat(client.getDraftEventLive(8).path("request").asInt()).isEqualTo(1);
		clock.advance(9);
		assertThat(client.getBroadcastDraftEventLive(8).path("request").asInt()).isEqualTo(1);
		clock.advance(1);
		assertThat(client.getBroadcastDraftEventLive(8).path("request").asInt()).isEqualTo(2);
		assertThat(client.getDraftEventLive(8).path("request").asInt()).isEqualTo(2);
		clock.advance(10);
		assertThat(client.getBroadcastDraftEventLive(8).path("request").asInt()).isEqualTo(3);
		clock.advance(10);
		assertThat(client.getDraftEventLive(8).path("request").asInt()).isEqualTo(4);
		assertThat(requests.get("/draft/event/8/live").get()).isEqualTo(4);
	}

	@Test
	void draftAndClassicFeedsAndGameweeksHaveIndependentSharedEntries() {
		for (int i = 0; i < 10; i++) {
			client.getBroadcastDraftEventLive(8);
			client.getBroadcastFantasyEventLive(8);
		}
		assertThat(requests).hasSize(2);
		assertThat(requests.values()).allSatisfy(count -> assertThat(count.get()).isEqualTo(1));
		clock.advance(10);
		client.getBroadcastDraftEventLive(8);
		client.getBroadcastFantasyEventLive(8);
		assertThat(requests.values()).allSatisfy(count -> assertThat(count.get()).isEqualTo(2));
		client.getBroadcastFantasyEventLive(9);
		assertThat(requests.get("/classic/event/9/live/").get()).isEqualTo(1);
	}

	@Test
	void failedFeedsAreRetriedOncePerTenSecondsAndNeverClaimOldPointsAreCurrent() {
		client.getFantasyEventLive(8);
		clock.advance(10);
		status.set(503);
		for (int i = 0; i < 10; i++) {
			assertThatThrownBy(() -> client.getBroadcastFantasyEventLive(8)).isInstanceOf(FplDraftClientException.class);
		}
		assertThat(requests.get("/classic/event/8/live/").get()).isEqualTo(2);
		assertThatThrownBy(() -> client.getFantasyEventLive(8)).isInstanceOf(FplDraftClientException.class);
		clock.advance(10);
		status.set(200);
		assertThat(client.getBroadcastFantasyEventLive(8).path("request").asInt()).isEqualTo(3);
		assertThat(client.getFantasyEventLive(8).path("request").asInt()).isEqualTo(3);
	}

	@Test
	void currentSnapshotsExposeActualFetchTimesAndDoNotPollWithoutDemand() {
		var first = client.getCurrentPoints(FplLeagueType.CLASSIC, 8);
		var fixtures = client.getCurrentFixtures();
		clock.advance(9);
		assertThat(client.getCurrentPoints(FplLeagueType.CLASSIC, 8).fetchedAt()).isEqualTo(first.fetchedAt());
		clock.advance(1);
		assertThat(client.getCurrentPoints(FplLeagueType.CLASSIC, 8).fetchedAt()).isEqualTo(first.fetchedAt().plusSeconds(10));
		assertThat(client.getCurrentFixtures().fetchedAt()).isEqualTo(fixtures.fetchedAt());
		clock.advance(20);
		assertThat(client.getCurrentFixtures().fetchedAt()).isEqualTo(fixtures.fetchedAt().plusSeconds(30));
		clock.advance(3600);
		assertThat(requests.get("/classic/fixtures/").get()).isEqualTo(2);
	}

	@Test
	void coldFailuresAreSharedAndCanRecoverWithoutWaitingAnHour() {
		status.set(503);
		for (int i = 0; i < 8; i++) assertThatThrownBy(() -> client.getLeagueDetails(1)).isInstanceOf(FplDraftClientException.class);
		assertThat(requests.get("/draft/league/1/details").get()).isEqualTo(1);
		clock.advance(10);
		status.set(200);
		assertThat(client.getLeagueDetails(1).path("request").asInt()).isEqualTo(2);
	}

	private static class MutableClock extends Clock {
		private volatile Instant now = Instant.parse("2026-10-28T12:00:00Z");
		void advance(long seconds) { now = now.plusSeconds(seconds); }
		@Override public Instant instant() { return now; }
		@Override public ZoneId getZone() { return ZoneOffset.UTC; }
		@Override public Clock withZone(ZoneId zone) { return this; }
	}
}
