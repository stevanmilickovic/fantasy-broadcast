package com.fantasybroadcast.backend.api;

import com.fantasybroadcast.backend.live.LiveStateResponse;
import com.fantasybroadcast.backend.live.MockLiveStateService;
import com.fantasybroadcast.backend.live.MockNarrationMode;
import com.fantasybroadcast.backend.fpl.FplLeagueType;
import com.fantasybroadcast.backend.customer.LeagueRegistrationService;
import org.springframework.context.annotation.Profile;
import com.fantasybroadcast.backend.customer.SessionService;
import com.fantasybroadcast.backend.customer.CurrentUser;
import com.fantasybroadcast.backend.security.BroadcastSecurityProperties;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import jakarta.servlet.http.HttpServletRequest;

@RestController
@Profile("db & !test")
@RequestMapping("/api")
@CrossOrigin(origins = "${BROADCAST_ALLOWED_ORIGIN:http://localhost:5173}")
public class LiveStateController {

	private final MockLiveStateService liveStateService;
	private final SessionService sessionService;
	private final LeagueRegistrationService leagueService;
	private final BroadcastSecurityProperties securityProperties;
	private final com.fantasybroadcast.backend.payment.SubscriptionService subscriptions;

	public LiveStateController(MockLiveStateService liveStateService, SessionService sessionService, LeagueRegistrationService leagueService,
			BroadcastSecurityProperties securityProperties, com.fantasybroadcast.backend.payment.SubscriptionService subscriptions) {
		this.liveStateService = liveStateService;
		this.sessionService = sessionService;
		this.leagueService = leagueService;
		this.securityProperties = securityProperties;
		this.subscriptions = subscriptions;
	}

	@GetMapping("/live-state")
	public LiveStateResponse liveState(HttpServletRequest request, @RequestParam(required = false) Long leagueId) {
		requireLiveAccess(sessionService.require(request), leagueId);
		return leagueId == null ? liveStateService.currentState() : liveStateService.currentState(leagueId);
	}

	@GetMapping(path = "/live-state/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
	public SseEmitter liveStateStream(HttpServletRequest request, @RequestParam(required = false) Long leagueId) {
		requireLiveAccess(sessionService.require(request), leagueId);
		return leagueId == null ? liveStateService.connectStream() : liveStateService.connectStream(leagueId,
				() -> requireLiveAccess(sessionService.require(request), leagueId));
	}

	@PostMapping("/mock-live/start")
	public LiveStateResponse start(HttpServletRequest request) {
		requireAdmin(request);
		requireDevelopmentEndpoints();
		return liveStateService.start();
	}

	@PostMapping("/mock-live/comprehensive/start")
	public LiveStateResponse startComprehensive(HttpServletRequest request,
			@RequestParam(defaultValue = "NONE") MockNarrationMode narrationMode) {
		requireAdmin(request);
		requireDevelopmentEndpoints();
		return liveStateService.startComprehensive(narrationMode);
	}

	@PostMapping("/mock-live/total-points/start")
	public LiveStateResponse startTotalPointsMock(HttpServletRequest request,
			@RequestParam(defaultValue = "NONE") MockNarrationMode narrationMode) {
		requireAdmin(request);
		requireDevelopmentEndpoints();
		return liveStateService.startTotalPointsMock(narrationMode);
	}

	@PostMapping("/mock-live/advance")
	public LiveStateResponse advance(HttpServletRequest request) {
		requireAdmin(request);
		requireDevelopmentEndpoints();
		return liveStateService.advance();
	}

	@PostMapping("/mock-live/reset")
	public LiveStateResponse reset(HttpServletRequest request) {
		requireAdmin(request);
		requireDevelopmentEndpoints();
		return liveStateService.reset();
	}

	@PostMapping("/live-broadcast/start")
	public LiveStateResponse startRealBroadcast(@RequestParam long leagueId,
			@RequestParam(defaultValue = "DRAFT") FplLeagueType leagueType,
			HttpServletRequest request) {
		requireAdmin(request);
		return liveStateService.startReal(leagueId, leagueType, leagueService.detectScoring(leagueId, leagueType));
	}

	private void requireAdmin(HttpServletRequest request) {
		if (!sessionService.require(request).admin()) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Administrator access is required.");
		}
	}

	private void requireLiveAccess(CurrentUser user, Long leagueId) {
		if (leagueId == null) {
			if (!user.admin()) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Administrator access is required.");
			return;
		}
		subscriptions.requireBroadcastAccess(user, leagueId);
	}

	private void requireDevelopmentEndpoints() {
		if (!securityProperties.isDevelopmentEndpointsEnabled()) {
			throw new ResponseStatusException(HttpStatus.NOT_FOUND, "This development endpoint is disabled.");
		}
	}
}
