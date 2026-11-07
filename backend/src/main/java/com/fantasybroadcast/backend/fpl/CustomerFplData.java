package com.fantasybroadcast.backend.fpl;

import java.util.Map;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.JsonNodeFactory;

/** Only documented display fields may cross the customer API boundary. */
public final class CustomerFplData {
	private CustomerFplData() { }

	public static JsonNode leagueDetails(JsonNode source) {
		return project(source, Map.of(
				"league", "id name draft_status draft_dt max_entries min_entries scoring start_event stop_event",
				"league_entries", "id entry_id entry_name player_first_name player_last_name short_name",
				"matches", "id event league_entry_1 league_entry_2 league_entry_1_points league_entry_2_points finished",
				"standings", "league_entry rank last_rank total points_for"));
	}

	public static JsonNode elementStatus(JsonNode source) {
		return project(source, Map.of("element_status", "element owner status in_accepted_trade"));
	}

	private static JsonNode project(JsonNode source, Map<String, String> sections) {
		var result = JsonNodeFactory.instance.objectNode();
		sections.forEach((section, fields) -> {
			var value = source.path(section);
			if (value.isArray()) {
				var rows = JsonNodeFactory.instance.arrayNode();
				for (var row : value) rows.add(fields(row, fields));
				result.set(section, rows);
			} else if (value.isObject()) result.set(section, fields(value, fields));
		});
		return result;
	}

	private static JsonNode fields(JsonNode source, String names) {
		var result = JsonNodeFactory.instance.objectNode();
		for (var name : names.split(" ")) {
			var value = source.path(name);
			if (value.isValueNode()) result.set(name, value);
		}
		return result;
	}
}
