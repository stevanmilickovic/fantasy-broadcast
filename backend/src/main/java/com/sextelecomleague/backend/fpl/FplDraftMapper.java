package com.sextelecomleague.backend.fpl;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

@Component
public class FplDraftMapper {

	public FplDraftLeague mapLeagueDetails(JsonNode root) {
		return new FplDraftLeague(
				mapLeagueEntries(root.path("league_entries")),
				mapMatches(root.path("matches")),
				mapStandings(root.path("standings")));
	}

	public List<FplPlayer> mapPlayers(JsonNode root) {
		var teams = mapNamesById(root.path("teams"), "name");
		var positions = mapNamesById(root.path("element_types"), "singular_name_short");
		var players = new ArrayList<FplPlayer>();

		for (JsonNode element : root.path("elements")) {
			var firstName = text(element, "first_name");
			var secondName = text(element, "second_name");
			players.add(new FplPlayer(
					intValue(element, "id"),
					text(element, "web_name"),
					(firstName + " " + secondName).trim(),
					teams.getOrDefault(intValue(element, "team"), ""),
					positions.getOrDefault(intValue(element, "element_type"), "")));
		}

		return players;
	}

	public List<FplLivePlayer> mapLivePlayers(JsonNode root) {
		var livePlayers = new ArrayList<FplLivePlayer>();
		var elements = root.path("elements");

		if (elements.isObject()) {
			for (var property : elements.properties()) {
				livePlayers.add(mapLivePlayer(property.getValue(), integerValue(property.getKey())));
			}
		}
		else {
			for (JsonNode element : elements) {
				livePlayers.add(mapLivePlayer(element, null));
			}
		}

		return livePlayers;
	}

	public List<FplDraftElementStatus> mapElementStatuses(JsonNode root) {
		var statuses = new ArrayList<FplDraftElementStatus>();

		for (JsonNode status : root.path("element_status")) {
			statuses.add(new FplDraftElementStatus(
					intValue(status, "element"),
					integerValue(status, "owner"),
					text(status, "status"),
					booleanValue(status, "in_accepted_trade")));
		}

		return statuses;
	}

	public FplEntryEvent mapEntryEvent(JsonNode root) {
		var picks = new ArrayList<FplEntryPick>();

		for (JsonNode pick : root.path("picks")) {
			picks.add(new FplEntryPick(
					intValue(pick, "element"),
					intValue(pick, "position"),
					intValue(pick, "multiplier")));
		}

		return new FplEntryEvent(picks);
	}

	public FplDraftEventLive mapDraftEventLive(JsonNode root) {
		return new FplDraftEventLive(mapLivePlayers(root), mapFixtures(root.path("fixtures")));
	}

	private FplLivePlayer mapLivePlayer(JsonNode element, Integer fallbackId) {
		var id = intValue(element, "id");
		return new FplLivePlayer(
				id == 0 && fallbackId != null ? fallbackId : id,
				mapLiveStats(element.path("stats")),
				mapLiveExplanations(element.path("explain")));
	}

	private FplLiveStats mapLiveStats(JsonNode stats) {
		return new FplLiveStats(
				intValue(stats, "minutes"),
				intValue(stats, "goals_scored"),
				intValue(stats, "assists"),
				intValue(stats, "clean_sheets"),
				intValue(stats, "goals_conceded"),
				intValue(stats, "own_goals"),
				intValue(stats, "penalties_saved"),
				intValue(stats, "penalties_missed"),
				intValue(stats, "yellow_cards"),
				intValue(stats, "red_cards"),
				intValue(stats, "saves"),
				intValue(stats, "bonus"),
				intValue(stats, "bps"),
				intValue(stats, "total_points"));
	}

	private List<FplLiveExplanation> mapLiveExplanations(JsonNode explanationsNode) {
		var explanations = new ArrayList<FplLiveExplanation>();
		for (JsonNode explanation : explanationsNode) {
			explanations.add(new FplLiveExplanation(
					intValue(explanation, "fixture"),
					mapLivePointBreakdowns(explanation.path("stats"))));
		}
		return explanations;
	}

	private List<FplLivePointBreakdown> mapLivePointBreakdowns(JsonNode breakdownsNode) {
		var breakdowns = new ArrayList<FplLivePointBreakdown>();
		for (JsonNode breakdown : breakdownsNode) {
			breakdowns.add(new FplLivePointBreakdown(
					text(breakdown, "identifier"),
					intValue(breakdown, "points"),
					intValue(breakdown, "value")));
		}
		return breakdowns;
	}

	private List<FplFixture> mapFixtures(JsonNode fixturesNode) {
		var fixtures = new ArrayList<FplFixture>();
		for (JsonNode fixture : fixturesNode) {
			fixtures.add(new FplFixture(
					intValue(fixture, "id"),
					intValue(fixture, "event"),
					intValue(fixture, "team_h"),
					intValue(fixture, "team_a"),
					integerValue(fixture, "team_h_score"),
					integerValue(fixture, "team_a_score"),
					booleanValue(fixture, "started"),
					booleanValue(fixture, "finished"),
					booleanValue(fixture, "finished_provisional"),
					intValue(fixture, "minutes"),
					text(fixture, "kickoff_time")));
		}
		return fixtures;
	}

	private List<FplDraftLeagueEntry> mapLeagueEntries(JsonNode entriesNode) {
		var entries = new ArrayList<FplDraftLeagueEntry>();
		for (JsonNode entry : entriesNode) {
			entries.add(new FplDraftLeagueEntry(
					intValue(entry, "id"),
					intValue(entry, "entry_id"),
					text(entry, "entry_name"),
					(text(entry, "player_first_name") + " " + text(entry, "player_last_name")).trim()));
		}
		return entries;
	}

	private List<FplDraftMatch> mapMatches(JsonNode matchesNode) {
		var matches = new ArrayList<FplDraftMatch>();
		for (JsonNode match : matchesNode) {
			matches.add(new FplDraftMatch(
					intValue(match, "id"),
					intValue(match, "event"),
					intValue(match, "league_entry_1"),
					intValue(match, "league_entry_2"),
					intValue(match, "league_entry_1_points"),
					intValue(match, "league_entry_2_points"),
					booleanValue(match, "finished")));
		}
		return matches;
	}

	private List<FplDraftStanding> mapStandings(JsonNode standingsNode) {
		var standings = new ArrayList<FplDraftStanding>();
		for (JsonNode standing : standingsNode) {
			standings.add(new FplDraftStanding(
					intValue(standing, "league_entry"),
					intValue(standing, "rank"),
					intValue(standing, "total"),
					intValue(standing, "points_for")));
		}
		return standings;
	}

	private Map<Integer, String> mapNamesById(JsonNode nodes, String fieldName) {
		var names = new HashMap<Integer, String>();
		for (JsonNode node : nodes) {
			names.put(intValue(node, "id"), text(node, fieldName));
		}
		return names;
	}

	private String text(JsonNode node, String fieldName) {
		var value = node.path(fieldName);
		return value.isMissingNode() || value.isNull() ? "" : value.asString("");
	}

	private int intValue(JsonNode node, String fieldName) {
		return node.path(fieldName).asInt(0);
	}

	private Integer integerValue(JsonNode node, String fieldName) {
		var value = node.path(fieldName);
		return value.isMissingNode() || value.isNull() ? null : value.asInt(0);
	}

	private Integer integerValue(String value) {
		try {
			return Integer.parseInt(value);
		}
		catch (NumberFormatException exception) {
			return null;
		}
	}

	private boolean booleanValue(JsonNode node, String fieldName) {
		return node.path(fieldName).asBoolean(false);
	}
}
