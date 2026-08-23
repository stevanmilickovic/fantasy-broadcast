package com.sextelecomleague.backend.api;

import com.sextelecomleague.backend.customer.CurrentUser;
import com.sextelecomleague.backend.customer.LeagueRegistrationService;
import com.sextelecomleague.backend.customer.LeagueRegistrationService.AdminLeague;
import com.sextelecomleague.backend.customer.LeagueRegistrationService.AdminLeaguePage;
import com.sextelecomleague.backend.customer.LeagueRegistrationService.RegisteredLeague;
import com.sextelecomleague.backend.customer.SessionService;
import com.sextelecomleague.backend.customer.BroadcastScheduleService;
import com.sextelecomleague.backend.fpl.FplLeagueType;
import com.sextelecomleague.backend.fpl.FplLeagueScoring;
import com.sextelecomleague.backend.live.LiveStateResponse;
import com.sextelecomleague.backend.live.MockLiveStateService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Max;
import java.util.List;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("db & !test")
@RequestMapping("/api/customer")
@CrossOrigin(origins = "http://localhost:5173")
public class CustomerLeagueController {

	private final SessionService sessionService;
	private final LeagueRegistrationService leagueService;
	private final BroadcastScheduleService scheduleService;
	private final MockLiveStateService liveStateService;

	public CustomerLeagueController(SessionService sessionService, LeagueRegistrationService leagueService, BroadcastScheduleService scheduleService, MockLiveStateService liveStateService) {
		this.sessionService = sessionService;
		this.leagueService = leagueService;
		this.scheduleService = scheduleService;
		this.liveStateService = liveStateService;
	}

	@GetMapping("/leagues")
	public List<RegisteredLeague> leagues(@RequestHeader("Authorization") String authorization) {
		return leagueService.forUser(currentUser(authorization));
	}

	@PostMapping("/leagues")
	public RegisteredLeague registerLeague(@RequestHeader("Authorization") String authorization,
			@Valid @RequestBody LeagueRequest request) {
		var leagueType = request.leagueType() == null ? FplLeagueType.DRAFT : request.leagueType();
		var scoringType = request.scoringType() == null ? FplLeagueScoring.H2H : request.scoringType();
		return leagueService.register(currentUser(authorization), request.fplLeagueId(), leagueType, scoringType);
	}

	@GetMapping("/admin/leagues")
	public AdminLeaguePage allLeagues(@RequestHeader("Authorization") String authorization,
			@RequestParam(defaultValue = "0") @PositiveOrZero int page,
			@RequestParam(defaultValue = "10") @Positive @Max(100) int size,
			@RequestParam(defaultValue = "") String search) {
		return leagueService.allForAdmin(currentUser(authorization), page, size, search);
	}

	@PatchMapping("/admin/leagues/{leagueId}")
	public AdminLeague updateLeague(@RequestHeader("Authorization") String authorization, @PathVariable @Positive long leagueId,
			@Valid @RequestBody AdminLeagueSettingsRequest request) {
		return leagueService.updateForAdmin(currentUser(authorization), leagueId, request.serviceEnabled());
	}

	private CurrentUser currentUser(String authorization) {
		return sessionService.require(authorization);
	}

	public record LeagueRequest(@Positive long fplLeagueId, FplLeagueType leagueType, FplLeagueScoring scoringType) {
	}

	@PostMapping("/leagues/{leagueId}/broadcast/open")
	public LiveStateResponse openBroadcast(@RequestHeader("Authorization") String authorization, @PathVariable @Positive long leagueId) {
		var user = currentUser(authorization);
		if (scheduleService.activeFor(user).isEmpty()) throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.FORBIDDEN, "There is no active broadcast for this time.");
		var league = leagueService.accessibleLeague(user, leagueId);
		return liveStateService.startRealForLeague(league.id(), league.fplLeagueId(), league.leagueType(), league.scoringType());
	}

	public record AdminLeagueSettingsRequest(boolean serviceEnabled) {
	}
}
