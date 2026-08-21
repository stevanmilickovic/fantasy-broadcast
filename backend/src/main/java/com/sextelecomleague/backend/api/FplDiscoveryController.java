package com.sextelecomleague.backend.api;

import com.sextelecomleague.backend.fpl.FplDraftClient;
import com.sextelecomleague.backend.fpl.FplClubShirt;
import com.sextelecomleague.backend.fpl.FplDraftElementStatus;
import com.sextelecomleague.backend.fpl.FplDraftEventLive;
import com.sextelecomleague.backend.fpl.FplDraftLeague;
import com.sextelecomleague.backend.fpl.FplDraftMapper;
import com.sextelecomleague.backend.fpl.FplEntryEvent;
import com.sextelecomleague.backend.fpl.FplLivePlayer;
import com.sextelecomleague.backend.fpl.FplPlayer;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/api/fpl/discovery")
@CrossOrigin(origins = "http://localhost:5173")
public class FplDiscoveryController {

	private final FplDraftClient client;
	private final FplDraftMapper mapper;

	public FplDiscoveryController(FplDraftClient client, FplDraftMapper mapper) {
		this.client = client;
		this.mapper = mapper;
	}

	@GetMapping("/league/{leagueId}")
	public FplDraftLeague leagueDetails(@PathVariable long leagueId) {
		return mapper.mapLeagueDetails(client.getLeagueDetails(leagueId));
	}

	@GetMapping("/league/{leagueId}/raw")
	public JsonNode rawLeagueDetails(@PathVariable long leagueId) {
		return client.getLeagueDetails(leagueId);
	}

	@GetMapping("/league/{leagueId}/element-status/raw")
	public JsonNode rawLeagueElementStatus(@PathVariable long leagueId) {
		return client.getLeagueElementStatus(leagueId);
	}

	@GetMapping("/league/{leagueId}/element-status")
	public List<FplDraftElementStatus> leagueElementStatus(@PathVariable long leagueId,
			@RequestParam(defaultValue = "50") int limit) {
		return mapper.mapElementStatuses(client.getLeagueElementStatus(leagueId)).stream()
				.limit(limit)
				.toList();
	}

	@GetMapping("/league/{leagueId}/transactions/raw")
	public JsonNode rawLeagueTransactions(@PathVariable long leagueId) {
		return client.getLeagueTransactions(leagueId);
	}

	@GetMapping("/draft/{draftId}/choices/raw")
	public JsonNode rawDraftChoices(@PathVariable long draftId) {
		return client.getDraftChoices(draftId);
	}

	@GetMapping("/entry/{entryId}/event/{eventId}/raw")
	public JsonNode rawEntryEvent(@PathVariable long entryId, @PathVariable int eventId) {
		return client.getEntryEvent(entryId, eventId);
	}

	@GetMapping("/entry/{entryId}/event/{eventId}")
	public FplEntryEvent entryEvent(@PathVariable long entryId, @PathVariable int eventId) {
		return mapper.mapEntryEvent(client.getEntryEvent(entryId, eventId));
	}

	@GetMapping("/players")
	public List<FplPlayer> players(@RequestParam(defaultValue = "25") int limit) {
		return mapper.mapPlayers(client.getDraftBootstrapStatic()).stream()
				.limit(limit)
				.toList();
	}

	@GetMapping("/shirts")
	public List<FplClubShirt> shirts() {
		return mapper.mapClubShirts(client.getFantasyBootstrapStatic());
	}

	@GetMapping("/players/{playerId}")
	public FplPlayer player(@PathVariable int playerId) {
		return mapper.mapPlayers(client.getDraftBootstrapStatic()).stream()
				.filter(player -> player.id() == playerId)
				.findFirst()
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "FPL player not found: " + playerId));
	}

	@GetMapping("/event/{eventId}/live")
	public List<FplLivePlayer> livePlayers(@PathVariable int eventId, @RequestParam(defaultValue = "25") int limit) {
		return mapper.mapLivePlayers(client.getFantasyEventLive(eventId)).stream()
				.limit(limit)
				.toList();
	}

	@GetMapping("/event/{eventId}/live/raw")
	public JsonNode rawFantasyEventLive(@PathVariable int eventId) {
		return client.getFantasyEventLive(eventId);
	}

	@GetMapping("/draft/event/{eventId}/live/raw")
	public JsonNode rawDraftEventLive(@PathVariable int eventId) {
		return client.getDraftEventLive(eventId);
	}

	@GetMapping("/draft/event/{eventId}/live")
	public FplDraftEventLive draftEventLive(@PathVariable int eventId) {
		return mapper.mapDraftEventLive(client.getDraftEventLive(eventId));
	}
}
