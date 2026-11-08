package com.fantasybroadcast.backend.fpl;

import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;

/** On-demand shared source data; does not start broadcasts, polling or narration. */
@Service
public class FplGameweekData {
	private final FplDraftClient client;
	private final FplDraftMapper mapper;
	public FplGameweekData(FplDraftClient client, FplDraftMapper mapper) { this.client = client; this.mapper = mapper; }

	public Snapshot load(FplLeagueType type, int gameweek) {
		if (gameweek < 1 || gameweek > 38) throw new IllegalArgumentException("Invalid gameweek");
		var points = client.getCurrentPoints(type, gameweek);
		var fixtures = client.getCurrentFixtures();
		var elements = points.value().path("elements");
		var valid = (elements.isArray() || elements.isObject()) && !elements.isEmpty() && fixtures.value().isArray();
		for (var element : elements) {
			if (!element.path("stats").path("total_points").isNumber()
					&& !(type == FplLeagueType.DRAFT && element.path("explain").isArray())) valid = false;
		}
		var players = type == FplLeagueType.DRAFT ? mapper.mapDraftEventLive(points.value()).players() : mapper.mapLivePlayers(points.value());
		return new Snapshot(type, gameweek, players, mapper.mapFixtures(fixtures.value()), points.fetchedAt(), fixtures.fetchedAt(),
				valid, valid ? null : "FPL returned incomplete current data.");
	}

	public static int currentGameweek(JsonNode bootstrap) {
		for(var event : bootstrap.path("events")) if(event.path("is_current").asBoolean()) return event.path("id").asInt();
		for(var event : bootstrap.path("events")) if(event.path("is_next").asBoolean()) return event.path("id").asInt();
		throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "FPL did not return a current or next gameweek.");
	}

	public record Snapshot(FplLeagueType source, int gameweek, List<FplLivePlayer> players, List<FplFixture> fixtures,
			Instant pointsFetchedAt, Instant fixturesFetchedAt, boolean complete, String unavailableReason) { }
}
