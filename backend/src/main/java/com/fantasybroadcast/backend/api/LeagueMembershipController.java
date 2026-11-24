package com.fantasybroadcast.backend.api;

import com.fantasybroadcast.backend.customer.LeagueMembershipService;
import com.fantasybroadcast.backend.customer.LeagueMembershipService.FollowRequest;
import com.fantasybroadcast.backend.customer.LeagueMembershipService.FollowerPage;
import com.fantasybroadcast.backend.customer.SessionService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import java.util.List;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.*;

@RestController
@Profile("db & !test")
@RequestMapping("/api/customer")
@CrossOrigin(origins = "${BROADCAST_ALLOWED_ORIGIN:http://localhost:5173}")
public class LeagueMembershipController {
	private final SessionService sessions;
	private final LeagueMembershipService memberships;
	public LeagueMembershipController(SessionService sessions, LeagueMembershipService memberships) {
		this.sessions = sessions; this.memberships = memberships;
	}
	@GetMapping("/leagues/{leagueId}/followers")
	public FollowerPage followers(HttpServletRequest request, @PathVariable @Positive long leagueId,
			@RequestParam(defaultValue = "0") @PositiveOrZero int page,
			@RequestParam(defaultValue = "10") @Positive @Max(100) int size) {
		return memberships.followers(sessions.require(request), leagueId, page, size);
	}
	@DeleteMapping("/leagues/{leagueId}/followers/{userId}")
	public void removeFollower(HttpServletRequest request, @PathVariable @Positive long leagueId, @PathVariable @Positive long userId) {
		memberships.removeFollower(sessions.require(request), leagueId, userId);
	}
	@GetMapping("/follow-requests")
	public List<FollowRequest> mine(HttpServletRequest request) { return memberships.requests(sessions.require(request), null); }
	@GetMapping("/leagues/{leagueId}/follow-requests")
	public List<FollowRequest> requests(HttpServletRequest request, @PathVariable @Positive long leagueId) {
		return memberships.requests(sessions.require(request), leagueId);
	}
	@PatchMapping("/leagues/{leagueId}/privacy")
	public void privacy(HttpServletRequest request, @PathVariable @Positive long leagueId, @Valid @RequestBody Privacy body) {
		memberships.setPrivacy(sessions.require(request), leagueId, body.privateLeague());
	}
	@PostMapping("/leagues/{leagueId}/follow-requests/{userId}")
	public void decide(HttpServletRequest request, @PathVariable @Positive long leagueId, @PathVariable @Positive long userId, @Valid @RequestBody Decision body) {
		memberships.decide(sessions.require(request), leagueId, userId, body.approve());
	}
	@DeleteMapping("/leagues/{leagueId}/follow-request")
	public void cancel(HttpServletRequest request, @PathVariable @Positive long leagueId) { memberships.cancel(sessions.require(request), leagueId); }
	public record Privacy(@NotNull Boolean privateLeague) { }
	public record Decision(@NotNull Boolean approve) { }
}
