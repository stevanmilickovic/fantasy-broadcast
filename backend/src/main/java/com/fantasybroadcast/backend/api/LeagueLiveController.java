package com.fantasybroadcast.backend.api;

import com.fantasybroadcast.backend.customer.LeagueRegistrationService;
import com.fantasybroadcast.backend.customer.SessionService;
import com.fantasybroadcast.backend.live.LeagueLiveProjection;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.Positive;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.*;

@RestController
@Profile("db & !test")
@RequestMapping("/api/customer/leagues")
@CrossOrigin(origins="${BROADCAST_ALLOWED_ORIGIN:http://localhost:5173}")
public class LeagueLiveController {
	private final SessionService sessions;
	private final LeagueRegistrationService leagues;
	private final LeagueLiveProjection projection;
	public LeagueLiveController(SessionService sessions,LeagueRegistrationService leagues,LeagueLiveProjection projection) {
		this.sessions=sessions; this.leagues=leagues; this.projection=projection;
	}
	@GetMapping("/{leagueId}/live")
	public LeagueLiveProjection.Projection live(HttpServletRequest request,@PathVariable @Positive long leagueId) {
		var league=leagues.accessibleLeague(sessions.require(request),leagueId);
		return projection.load(league.fplLeagueId(),league.leagueType(),league.scoringType());
	}
}
