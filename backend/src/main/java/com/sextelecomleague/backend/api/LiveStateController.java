package com.sextelecomleague.backend.api;

import com.sextelecomleague.backend.live.LiveStateResponse;
import com.sextelecomleague.backend.live.MockLiveStateService;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "http://localhost:5173")
public class LiveStateController {

	private final MockLiveStateService liveStateService;

	public LiveStateController(MockLiveStateService liveStateService) {
		this.liveStateService = liveStateService;
	}

	@GetMapping("/live-state")
	public LiveStateResponse liveState() {
		return liveStateService.currentState();
	}

	@PostMapping("/mock-live/start")
	public LiveStateResponse start() {
		return liveStateService.start();
	}

	@PostMapping("/mock-live/advance")
	public LiveStateResponse advance() {
		return liveStateService.advance();
	}

	@PostMapping("/mock-live/reset")
	public LiveStateResponse reset() {
		return liveStateService.reset();
	}
}
