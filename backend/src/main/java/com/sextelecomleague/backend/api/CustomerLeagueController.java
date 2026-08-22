package com.sextelecomleague.backend.api;

import com.sextelecomleague.backend.customer.CurrentUser;
import com.sextelecomleague.backend.customer.LeagueRegistrationService;
import com.sextelecomleague.backend.customer.LeagueRegistrationService.AdminLeague;
import com.sextelecomleague.backend.customer.LeagueRegistrationService.RegisteredLeague;
import com.sextelecomleague.backend.customer.SessionService;
import com.sextelecomleague.backend.fpl.FplLeagueType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import java.util.List;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
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

	public CustomerLeagueController(SessionService sessionService, LeagueRegistrationService leagueService) {
		this.sessionService = sessionService;
		this.leagueService = leagueService;
	}

	@GetMapping("/leagues")
	public List<RegisteredLeague> leagues(@RequestHeader("Authorization") String authorization) {
		return leagueService.forUser(currentUser(authorization));
	}

	@PostMapping("/leagues")
	public RegisteredLeague registerLeague(@RequestHeader("Authorization") String authorization,
			@Valid @RequestBody LeagueRequest request) {
		var leagueType = request.leagueType() == null ? FplLeagueType.DRAFT : request.leagueType();
		return leagueService.register(currentUser(authorization), request.fplLeagueId(), leagueType);
	}

	@GetMapping("/admin/leagues")
	public List<AdminLeague> allLeagues(@RequestHeader("Authorization") String authorization) {
		return leagueService.allForAdmin(currentUser(authorization));
	}

	private CurrentUser currentUser(String authorization) {
		return sessionService.require(authorization);
	}

	public record LeagueRequest(@Positive long fplLeagueId, FplLeagueType leagueType) {
	}
}
