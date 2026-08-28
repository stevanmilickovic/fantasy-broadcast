package com.fantasybroadcast.backend.api;

import com.fantasybroadcast.backend.fpl.FplDraftEventLive;
import com.fantasybroadcast.backend.fpl.FplDraftMapper;
import com.fantasybroadcast.backend.fpl.FplEntryEvent;
import com.fantasybroadcast.backend.fpl.FplLivePlayer;
import com.fantasybroadcast.backend.fpl.FplPlayer;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.core.io.ClassPathResource;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@RestController
@RequestMapping("/api/fpl/mock")
@CrossOrigin(origins = "http://localhost:5173")
public class FplMockDiscoveryController {

	private static final String MOCK_ROOT = "mock/fpl/start/";
	private static final List<Long> ENTRY_IDS = List.of(9001L, 9002L, 9003L, 9004L);

	private final ObjectMapper objectMapper;
	private final FplDraftMapper mapper;

	public FplMockDiscoveryController(ObjectMapper objectMapper, FplDraftMapper mapper) {
		this.objectMapper = objectMapper;
		this.mapper = mapper;
	}

	@GetMapping("/start")
	public FplMockDiscoveryResponse start() {
		var bootstrap = readJson("bootstrap-static.json");
		var eventLive = readJson("event-live.json");
		var draftEventLive = readJson("draft-event-live.json");
		var entryEvents = new LinkedHashMap<Long, FplEntryEvent>();

		for (long entryId : ENTRY_IDS) {
			entryEvents.put(entryId, mapper.mapEntryEvent(readJson("entry-" + entryId + "-event-1.json")));
		}

		return new FplMockDiscoveryResponse(
				readJson("league-details.json"),
				readJson("element-status.json"),
				mapper.mapPlayers(bootstrap),
				entryEvents,
				mapper.mapLivePlayers(eventLive),
				mapper.mapDraftEventLive(draftEventLive));
	}

	private JsonNode readJson(String fileName) {
		try {
			var resource = new ClassPathResource(MOCK_ROOT + fileName);
			return objectMapper.readTree(resource.getInputStream());
		}
		catch (IOException exception) {
			throw new UncheckedIOException("Failed to load FPL mock: " + fileName, exception);
		}
	}

	public record FplMockDiscoveryResponse(
			JsonNode details,
			JsonNode elementStatus,
			List<FplPlayer> players,
			Map<Long, FplEntryEvent> entryEvents,
			List<FplLivePlayer> livePlayers,
			FplDraftEventLive draftEventLive
	) {
	}
}
