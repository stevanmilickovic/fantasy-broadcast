package com.sextelecomleague.backend.api;

import com.sextelecomleague.backend.fpl.FplDraftClient;
import com.sextelecomleague.backend.fpl.FplDraftLeague;
import com.sextelecomleague.backend.fpl.FplDraftMapper;
import com.sextelecomleague.backend.fpl.FplLivePlayer;
import com.sextelecomleague.backend.fpl.FplPlayer;
import java.util.List;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

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

	@GetMapping("/players")
	public List<FplPlayer> players(@RequestParam(defaultValue = "25") int limit) {
		return mapper.mapPlayers(client.getDraftBootstrapStatic()).stream()
				.limit(limit)
				.toList();
	}

	@GetMapping("/event/{eventId}/live")
	public List<FplLivePlayer> livePlayers(@PathVariable int eventId, @RequestParam(defaultValue = "25") int limit) {
		return mapper.mapLivePlayers(client.getFantasyEventLive(eventId)).stream()
				.limit(limit)
				.toList();
	}
}
