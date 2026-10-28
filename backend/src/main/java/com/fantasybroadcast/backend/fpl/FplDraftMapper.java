package com.fantasybroadcast.backend.fpl;

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
					intValue(element, "team"),
					positions.getOrDefault(intValue(element, "element_type"), ""), seasonStats(element)));
		}

		return players;
	}

	public List<FplPlayer> mapDraftPlayers(JsonNode draft, JsonNode fantasy) {
		var seasonByCode = new HashMap<Integer, FplPlayer.SeasonStats>();
		for (var element : fantasy.path("elements")) {
			var season = seasonStats(element);
			if (intValue(element, "code") > 0 && season != null) seasonByCode.put(intValue(element, "code"), season);
		}
		var codeById = new HashMap<Integer, Integer>();
		for (var element : draft.path("elements")) codeById.put(intValue(element, "id"), intValue(element, "code"));
		return mapPlayers(draft).stream().map(player -> new FplPlayer(player.id(), player.webName(), player.fullName(),
				player.premierLeagueClub(), player.premierLeagueClubId(), player.position(),
				seasonByCode.getOrDefault(codeById.get(player.id()), player.season()))).toList();
	}

	private FplPlayer.SeasonStats seasonStats(JsonNode element) {
		for (var field : List.of("total_points", "goals_scored", "assists", "clean_sheets")) {
			if (!element.path(field).isNumber()) return null;
		}
		return new FplPlayer.SeasonStats(intValue(element, "total_points"), intValue(element, "goals_scored"),
				intValue(element, "assists"), intValue(element, "clean_sheets"));
	}

	public FplClassicLeague mapClassicLeague(JsonNode standingsRoot, JsonNode matchesRoot) {
		var entries = mapClassicLeagueEntries(standingsRoot);
		var matches = new ArrayList<FplClassicMatch>();
		for (JsonNode match : matchesRoot.path("results")) {
			matches.add(new FplClassicMatch(
					match.path("entry_1_entry").asLong(),
					match.path("entry_2_entry").asLong(),
					intValue(match, "entry_1_points"),
					intValue(match, "entry_2_points")));
		}
		return new FplClassicLeague(entries, matches);
	}

	public List<FplClassicLeagueEntry> mapClassicLeagueEntries(JsonNode standingsRoot) {
		var entries = new ArrayList<FplClassicLeagueEntry>();
		for (JsonNode standing : standingsRoot.path("standings").path("results")) {
			entries.add(new FplClassicLeagueEntry(
					standing.path("entry").asLong(),
					text(standing, "entry_name"),
					text(standing, "player_name"),
					intValue(standing, "rank"),
					integerValue(standing, "last_rank"),
					standing.has("points_total") ? intValue(standing, "points_total") : intValue(standing, "total"),
					intValue(standing, "event_total"),
					intValue(standing, "points_for")));
		}
		return entries;
	}

	public List<FplClubShirt> mapClubShirts(JsonNode root) {
		var shirts = new ArrayList<FplClubShirt>();
		for (JsonNode team : root.path("teams")) {
			shirts.add(new FplClubShirt(
					text(team, "name"),
					text(team, "short_name"),
					intValue(team, "code")));
		}
		return shirts;
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
					intValue(pick, "multiplier"),
					booleanValue(pick, "is_captain"),
					booleanValue(pick, "is_vice_captain")));
		}

		var automaticSubstitutions = new ArrayList<FplAutomaticSubstitution>();
		for (JsonNode substitution : root.path("automatic_subs")) {
			automaticSubstitutions.add(new FplAutomaticSubstitution(
					intValue(substitution, "element_in"), intValue(substitution, "element_out")));
		}
		return new FplEntryEvent(picks, automaticSubstitutions, text(root, "active_chip"),
				intValue(root.path("entry_history"), "event_transfers_cost"),
				intValue(root.path("entry_history"), "points"));
	}

	public FplDraftEventLive mapDraftEventLive(JsonNode root) {
		var players = new ArrayList<FplLivePlayer>();
		var elements = root.path("elements");
		if (elements.isObject()) {
			for (var property : elements.properties()) players.add(mapDraftLivePlayer(property.getValue(), integerValue(property.getKey())));
		}
		else {
			for (JsonNode element : elements) players.add(mapDraftLivePlayer(element, null));
		}
		return new FplDraftEventLive(players, mapFixtures(root.path("fixtures")));
	}

	private FplLivePlayer mapDraftLivePlayer(JsonNode element, Integer fallbackId) {
		var id = intValue(element, "id");
		var totalPoints = sumDraftExplanationPoints(element.path("explain"));
		var explanations = mapDraftLiveExplanations(element.path("explain"));
		var stats = element.path("stats").has("total_points")
				? mapLiveStats(element.path("stats"))
				: new FplLiveStats(draftStat(explanations, "minutes"), draftStat(explanations, "goals_scored"),
						draftStat(explanations, "assists"), draftStat(explanations, "clean_sheets"),
						draftStat(explanations, "goals_conceded"), draftStat(explanations, "own_goals"),
						draftStat(explanations, "penalties_saved"), draftStat(explanations, "penalties_missed"),
						draftStat(explanations, "yellow_cards"), draftStat(explanations, "red_cards"),
						draftStat(explanations, "saves"), draftStat(explanations, "bonus"), draftStat(explanations, "bps"), totalPoints);
		return new FplLivePlayer(id == 0 && fallbackId != null ? fallbackId : id,
				stats, explanations);
	}

	private int draftStat(List<FplLiveExplanation> explanations, String identifier) {
		return explanations.stream().flatMap(explanation -> explanation.stats().stream())
				.filter(stat -> identifier.equals(stat.identifier())).mapToInt(FplLivePointBreakdown::value).sum();
	}

	private List<FplLiveExplanation> mapDraftLiveExplanations(JsonNode explanations) {
		var mapped = new ArrayList<FplLiveExplanation>();
		for (JsonNode fixtureExplanation : explanations) {
			if (!fixtureExplanation.isArray() || fixtureExplanation.size() < 2) continue;
			var breakdowns = new ArrayList<FplLivePointBreakdown>();
			for (JsonNode breakdown : fixtureExplanation.path(0)) {
				breakdowns.add(new FplLivePointBreakdown(text(breakdown, "stat"), intValue(breakdown, "points"),
						intValue(breakdown, "value"), intValue(breakdown, "points_modification")));
			}
			mapped.add(new FplLiveExplanation(fixtureExplanation.path(1).asInt(), breakdowns));
		}
		return mapped;
	}

	private int sumDraftExplanationPoints(JsonNode node) {
		if (node == null || node.isMissingNode() || node.isNull()) return 0;
		if (node.isObject()) {
			var points = node.has("points") ? intValue(node, "points") : 0;
			for (var property : node.properties()) if (!property.getKey().equals("points")) points += sumDraftExplanationPoints(property.getValue());
			return points;
		}
		var points = 0;
		for (JsonNode item : node) points += sumDraftExplanationPoints(item);
		return points;
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
					intValue(breakdown, "value"),
					intValue(breakdown, "points_modification")));
		}
		return breakdowns;
	}

	public List<FplFixture> mapFixtures(JsonNode fixturesNode) {
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
					integerValue(standing, "last_rank"),
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
