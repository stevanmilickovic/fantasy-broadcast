package com.fantasybroadcast.backend.api;

import com.fantasybroadcast.backend.customer.LeagueRegistrationService;
import com.fantasybroadcast.backend.customer.SessionService;
import com.fantasybroadcast.backend.live.LeagueLiveProjection;
import com.fantasybroadcast.backend.live.LeagueLiveUpdates;
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
	private final LeagueLiveUpdates updates;
	public LeagueLiveController(SessionService sessions,LeagueRegistrationService leagues,LeagueLiveProjection projection,LeagueLiveUpdates updates) {
		this.sessions=sessions; this.leagues=leagues; this.projection=projection; this.updates=updates;
	}
	@GetMapping("/{leagueId}/live")
	public LeagueLiveProjection.Projection live(HttpServletRequest request,@PathVariable @Positive long leagueId) {
		var league=leagues.accessibleLeague(sessions.require(request),leagueId);
		var active = updates.current(leagueId);
		if (active != null && active.scoresUnavailableReason() == null) return active;
		return projection.load(league.fplLeagueId(),league.leagueType(),league.scoringType());
	}
	@GetMapping(path="/{leagueId}/live/stream", produces=org.springframework.http.MediaType.TEXT_EVENT_STREAM_VALUE)
	public org.springframework.web.servlet.mvc.method.annotation.SseEmitter stream(HttpServletRequest request,@PathVariable @Positive long leagueId) {
		return updates.connect(leagueId, () -> leagues.accessibleLeague(sessions.require(request),leagueId));
	}
}
