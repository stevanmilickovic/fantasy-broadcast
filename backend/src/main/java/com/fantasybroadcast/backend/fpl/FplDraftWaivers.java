package com.fantasybroadcast.backend.fpl;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;

@Service
public class FplDraftWaivers {
	private static final Comparator<Player> BY_PROJECTION = Comparator
			.comparing(Player::expectedPoints, Comparator.nullsLast(Comparator.reverseOrder()))
			.thenComparing(Comparator.comparingInt(Player::seasonStarts).reversed())
			.thenComparingInt(player -> player.player().id());

	private final FplDraftClient client;
	private final FplDraftMapper mapper;

	public FplDraftWaivers(FplDraftClient client, FplDraftMapper mapper) {
		this.client = client;
		this.mapper = mapper;
	}

	public Snapshot load(long leagueId, long entryId) {
		if (leagueId < 1 || entryId < 1) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "League and Draft entry IDs must be positive.");
		}
		var statusResponse = client.getLeagueElementStatus(leagueId);
		if (!statusResponse.path("element_status").isArray() || statusResponse.path("element_status").isEmpty()) {
			throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "FPL did not return player ownership for this league.");
		}
		var statuses = new HashMap<Integer, FplDraftElementStatus>();
		for (var status : mapper.mapElementStatuses(statusResponse)) statuses.put(status.element(), status);
		if (statuses.values().stream().noneMatch(status -> status.owner() != null && status.owner() == entryId)) {
			throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No squad found for that Draft entry in this league.");
		}

		var draft = client.getCurrentDraftBootstrapStatic();
		var events = draft.path("events");
		var gameweek = events.path("next").asInt();
		var event = events.path("data").valueStream().filter(week -> week.path("id").asInt() == gameweek)
				.findFirst().orElse(null);
		var projections = projections(gameweek);
		var draftElements = new HashMap<Integer, JsonNode>();
		for (var element : draft.path("elements")) draftElements.put(element.path("id").asInt(), element);
		var squad = new ArrayList<Player>();
		var available = new ArrayList<Player>();
		for (var player : mapper.mapPlayers(draft)) {
			var status = statuses.get(player.id());
			if (status == null) continue;
			var element = draftElements.get(player.id());
			var candidate = new Player(player, projections.get(element.path("code").asInt()),
					element.path("starts").asInt(), decimal(element.path("points_per_game")),
					element.path("news_updated").asText(element.path("news_added").asText(null)));
			if (status.owner() != null && status.owner() == entryId) squad.add(candidate);
			if (status.owner() == null && "a".equals(status.status()) && !status.inAcceptedTrade()) available.add(candidate);
		}
		if (squad.isEmpty()) {
			throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "FPL squad players could not be matched to the player list.");
		}
		squad.sort(BY_PROJECTION);
		available.sort(BY_PROJECTION);

		var upgrades = new ArrayList<Upgrade>();
		for (var drop : squad) {
			if (drop.expectedPoints() == null || drop.player().position().isBlank()) continue;
			available.stream().filter(add -> isUpgrade(add, drop)).limit(5)
					.map(add -> new Upgrade(drop.player().id(), add.player().id(), add.expectedPoints().subtract(drop.expectedPoints())))
					.forEach(upgrades::add);
		}
		upgrades.sort(Comparator.comparing(Upgrade::expectedPointsGain).reversed());
		return new Snapshot(leagueId, entryId, gameweek > 0 ? gameweek : null,
				event == null ? null : event.path("waivers_time").asText(null),
				event == null ? null : event.path("deadline_time").asText(null), squad, available, upgrades);
	}

	private Map<Integer, BigDecimal> projections(int gameweek) {
		if (gameweek <= 0) return Map.of();
		var classic = client.getCurrentFantasyBootstrapStatic();
		if (classic.path("events").valueStream().noneMatch(event -> event.path("is_next").asBoolean()
				&& event.path("id").asInt() == gameweek)) return Map.of();

		// Player codes are shared between Classic and Draft. The element IDs can differ.
		var pointsByCode = new HashMap<Integer, BigDecimal>();
		for (var element : classic.path("elements")) {
			var code = element.path("code").asInt();
			var points = decimal(element.path("ep_next"));
			if (code > 0 && points != null) pointsByCode.put(code, points);
		}
		return pointsByCode;
	}

	private boolean isUpgrade(Player add, Player drop) {
		var availability = add.player().availability();
		return add.player().position().equals(drop.player().position()) && add.expectedPoints() != null
				&& add.expectedPoints().compareTo(drop.expectedPoints()) > 0
				&& (availability == null || !Integer.valueOf(0).equals(availability.chanceOfPlayingNextRound()));
	}

	private BigDecimal decimal(JsonNode node) {
		if (!node.isNumber() && !node.isTextual()) return null;
		try {
			return new BigDecimal(node.asText());
		}
		catch (NumberFormatException exception) {
			return null;
		}
	}

	public record Snapshot(long leagueId, long entryId, Integer gameweek, String waiverDeadline, String lineupDeadline,
			List<Player> squad, List<Player> availablePlayers, List<Upgrade> upgrades) { }

	public record Player(FplPlayer player, BigDecimal expectedPoints, int seasonStarts, BigDecimal pointsPerGame,
			String newsUpdatedAt) { }

	public record Upgrade(int dropPlayerId, int addPlayerId, BigDecimal expectedPointsGain) { }
}
