package com.fantasybroadcast.backend.api;

import com.fantasybroadcast.backend.customer.LeagueRegistrationService;
import com.fantasybroadcast.backend.customer.SessionService;
import com.fantasybroadcast.backend.fpl.FplLeagueType;
import com.fantasybroadcast.backend.fpl.FplDraftClientException;
import com.fantasybroadcast.backend.payment.PaddleProperties;
import com.fantasybroadcast.backend.payment.PaddleCheckoutService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.Positive;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("db & !test")
@RequestMapping("/api/customer/league-payment")
@CrossOrigin(origins = "${BROADCAST_ALLOWED_ORIGIN:http://localhost:5173}")
public class LeaguePaymentController {
	private final SessionService sessions; private final LeagueRegistrationService leagues; private final PaddleProperties paddle; private final PaddleCheckoutService checkouts;
	public LeaguePaymentController(SessionService sessions, LeagueRegistrationService leagues, PaddleProperties paddle, PaddleCheckoutService checkouts) { this.sessions = sessions; this.leagues = leagues; this.paddle = paddle; this.checkouts = checkouts; }
	@GetMapping("/preview")
	public LeaguePreview preview(HttpServletRequest request, @RequestParam @Positive long fplLeagueId, @RequestParam FplLeagueType leagueType) {
		sessions.require(request);
		try {
			var league = leagues.preview(fplLeagueId, leagueType);
			return new LeaguePreview(league.displayName(), league.managerCount(), league.validationMessage() == null, league.validationMessage(), paddle.isConfigured());
		}
		catch (FplDraftClientException exception) {
			var message = exception.getStatusCode() != null && exception.getStatusCode() == 404
					? "No " + leagueType.name().toLowerCase() + " FPL league was found with this ID."
					: "FPL could not verify this league. Please try again.";
			return new LeaguePreview("League unavailable", 0, false, message, false);
		}
	}
	@org.springframework.web.bind.annotation.PostMapping("/checkout")
	public PaddleCheckoutService.Checkout checkout(HttpServletRequest request, @jakarta.validation.Valid @org.springframework.web.bind.annotation.RequestBody CheckoutRequest checkout) {
		return checkouts.createCheckout(sessions.require(request), checkout.fplLeagueId(), checkout.leagueType(), checkout.plan());
	}
	public record LeaguePreview(String displayName, int managerCount, boolean registrationEligible, String validationMessage, boolean checkoutReady) { }
	public record CheckoutRequest(@Positive long fplLeagueId, FplLeagueType leagueType, String plan) { }
}
