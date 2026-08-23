package com.sextelecomleague.backend.api;

import com.sextelecomleague.backend.live.LiveStateResponse;
import com.sextelecomleague.backend.live.MockLiveStateService;
import com.sextelecomleague.backend.fpl.FplLeagueType;
import com.sextelecomleague.backend.fpl.FplLeagueScoring;
import com.sextelecomleague.backend.customer.SessionService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "http://localhost:5173")
public class LiveStateController {

	private final MockLiveStateService liveStateService;
	private final SessionService sessionService;

	public LiveStateController(MockLiveStateService liveStateService, SessionService sessionService) {
		this.liveStateService = liveStateService;
		this.sessionService = sessionService;
	}

	@GetMapping("/live-state")
	public LiveStateResponse liveState(@RequestParam(required = false) Long leagueId) {
		return leagueId == null ? liveStateService.currentState() : liveStateService.currentState(leagueId);
	}

	@GetMapping(path = "/live-state/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
	public SseEmitter liveStateStream(@RequestParam(required = false) Long leagueId) {
		return leagueId == null ? liveStateService.connectStream() : liveStateService.connectStream(leagueId);
	}

	@PostMapping("/mock-live/start")
	public LiveStateResponse start(@RequestHeader("Authorization") String authorization) {
		requireAdmin(authorization);
		return liveStateService.start();
	}

	@PostMapping("/mock-live/comprehensive/start")
	public LiveStateResponse startComprehensive(@RequestHeader("Authorization") String authorization) {
		requireAdmin(authorization);
		return liveStateService.startComprehensive();
	}

	@PostMapping("/mock-live/total-points/start")
	public LiveStateResponse startTotalPointsMock(@RequestHeader("Authorization") String authorization) {
		requireAdmin(authorization);
		return liveStateService.startTotalPointsMock();
	}

	@PostMapping("/mock-live/advance")
	public LiveStateResponse advance(@RequestHeader("Authorization") String authorization) {
		requireAdmin(authorization);
		return liveStateService.advance();
	}

	@PostMapping("/mock-live/reset")
	public LiveStateResponse reset(@RequestHeader("Authorization") String authorization) {
		requireAdmin(authorization);
		return liveStateService.reset();
	}

	@PostMapping("/live-broadcast/start")
	public LiveStateResponse startRealBroadcast(@RequestParam long leagueId,
			@RequestParam(defaultValue = "DRAFT") FplLeagueType leagueType,
			@RequestParam(defaultValue = "H2H") FplLeagueScoring scoringType,
			@RequestHeader("Authorization") String authorization) {
		requireAdmin(authorization);
		return liveStateService.startReal(leagueId, leagueType, scoringType);
	}

	private void requireAdmin(String authorization) {
		if (!sessionService.require(authorization).admin()) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Administrator access is required.");
		}
	}
}
