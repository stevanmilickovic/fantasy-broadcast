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

		for (JsonNode element : root.path("elements")) {
			var stats = element.path("stats");
			livePlayers.add(new FplLivePlayer(
					intValue(element, "id"),
					intValue(stats, "total_points"),
					intValue(stats, "goals_scored"),
					intValue(stats, "assists"),
					intValue(stats, "clean_sheets"),
					intValue(stats, "yellow_cards"),
					intValue(stats, "red_cards"),
					intValue(stats, "bonus")));
		}

		return livePlayers;
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

	private boolean booleanValue(JsonNode node, String fieldName) {
		return node.path(fieldName).asBoolean(false);
	}
}
