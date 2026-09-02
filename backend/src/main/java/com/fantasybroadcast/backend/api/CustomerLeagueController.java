package com.fantasybroadcast.backend.api;

import com.fantasybroadcast.backend.customer.CurrentUser;
import com.fantasybroadcast.backend.customer.LeagueRegistrationService;
import com.fantasybroadcast.backend.customer.LeagueRegistrationService.AdminLeague;
import com.fantasybroadcast.backend.customer.LeagueRegistrationService.AdminLeaguePage;
import com.fantasybroadcast.backend.customer.LeagueRegistrationService.RegisteredLeague;
import com.fantasybroadcast.backend.customer.SessionService;
import com.fantasybroadcast.backend.customer.BroadcastScheduleService;
import com.fantasybroadcast.backend.fpl.FplDraftClient;
import com.fantasybroadcast.backend.fpl.FplDraftMapper;
import com.fantasybroadcast.backend.fpl.FplClubShirt;
import com.fantasybroadcast.backend.fpl.FplEntryEvent;
import com.fantasybroadcast.backend.fpl.FplLeagueScoring;
import com.fantasybroadcast.backend.fpl.FplLeagueType;
import com.fantasybroadcast.backend.fpl.FplLivePlayer;
import com.fantasybroadcast.backend.fpl.FplPlayer;
import com.fantasybroadcast.backend.live.LiveStateResponse;
import com.fantasybroadcast.backend.live.MockLiveStateService;
import com.fantasybroadcast.backend.security.BroadcastSecurityProperties;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Max;
import java.util.List;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import jakarta.servlet.http.HttpServletRequest;

@RestController
@Profile("db & !test")
@RequestMapping("/api/customer")
@CrossOrigin(origins = "${BROADCAST_ALLOWED_ORIGIN:http://localhost:5173}")
public class CustomerLeagueController {

	private final SessionService sessionService;
	private final LeagueRegistrationService leagueService;
	private final BroadcastScheduleService scheduleService;
	private final MockLiveStateService liveStateService;
	private final FplDraftClient fplClient;
	private final FplDraftMapper fplMapper;
	private final BroadcastSecurityProperties securityProperties;

	public CustomerLeagueController(SessionService sessionService, LeagueRegistrationService leagueService, BroadcastScheduleService scheduleService,
			MockLiveStateService liveStateService, FplDraftClient fplClient, FplDraftMapper fplMapper, BroadcastSecurityProperties securityProperties) {
		this.sessionService = sessionService;
		this.leagueService = leagueService;
		this.scheduleService = scheduleService;
		this.liveStateService = liveStateService;
		this.fplClient = fplClient;
		this.fplMapper = fplMapper;
		this.securityProperties = securityProperties;
	}

	@GetMapping("/leagues")
	public List<RegisteredLeague> leagues(HttpServletRequest request) {
		return leagueService.forUser(currentUser(request));
	}

	@GetMapping("/league-registration")
	public LeagueRegistrationAccess leagueRegistrationAccess(HttpServletRequest request) {
		return new LeagueRegistrationAccess(securityProperties.canRegisterLeague(currentUser(request)));
	}

	@PostMapping("/leagues")
	public RegisteredLeague registerLeague(HttpServletRequest httpRequest,
			@Valid @RequestBody LeagueRequest request) {
		var leagueType = request.leagueType() == null ? FplLeagueType.DRAFT : request.leagueType();
		return leagueService.register(currentUser(httpRequest), request.fplLeagueId(), leagueType);
	}

	@GetMapping("/admin/leagues")
	public AdminLeaguePage allLeagues(HttpServletRequest request,
			@RequestParam(defaultValue = "0") @PositiveOrZero int page,
			@RequestParam(defaultValue = "10") @Positive @Max(100) int size,
			@RequestParam(defaultValue = "") String search) {
		return leagueService.allForAdmin(currentUser(request), page, size, search);
	}

	@GetMapping("/leagues/search")
	public List<RegisteredLeague> searchRegisteredLeagues(HttpServletRequest request,
			@RequestParam(defaultValue = "") String query) {
		currentUser(request);
		return leagueService.searchRegistered(query);
	}

	@PostMapping("/leagues/{leagueId}/follow")
	public RegisteredLeague followLeague(HttpServletRequest request, @PathVariable @Positive long leagueId) {
		return leagueService.follow(currentUser(request), leagueId);
	}

	@DeleteMapping("/leagues/{leagueId}")
	public void deleteOwnedLeague(HttpServletRequest request, @PathVariable @Positive long leagueId) {
		leagueService.deleteOwned(currentUser(request), leagueId);
	}

	@GetMapping("/leagues/{leagueId}/overview")
	public ClassicLeagueDiscovery leagueOverview(HttpServletRequest request, @PathVariable @Positive long leagueId) {
		var league = leagueService.accessibleLeague(currentUser(request), leagueId);
		if (league.leagueType() != FplLeagueType.CLASSIC) {
			throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST,
					"This overview is only available for Classic leagues.");
		}
		var standingsRoot = league.scoringType() == FplLeagueScoring.H2H
				? fplClient.getClassicLeagueStandings(league.fplLeagueId())
				: fplClient.getClassicPointsLeagueStandings(league.fplLeagueId());
		var entries = fplMapper.mapClassicLeagueEntries(standingsRoot);
		var trackedPlayerCount = entries.size() * 15;
		if (trackedPlayerCount > 200) {
			throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST,
					"This league requires " + trackedPlayerCount + " tracked players; the maximum is 200.");
		}
		var bootstrap = fplClient.getFantasyBootstrapStatic();
		var gameweek = currentGameweek(bootstrap);
		var matches = league.scoringType() == FplLeagueScoring.H2H
				? fplMapper.mapClassicLeague(standingsRoot, fplClient.getClassicLeagueMatches(league.fplLeagueId(), gameweek)).matches()
				: List.<com.fantasybroadcast.backend.fpl.FplClassicMatch>of();
		var entryEvents = new java.util.LinkedHashMap<Long, FplEntryEvent>();
		for (var entry : entries) entryEvents.put(entry.entryId(), fplMapper.mapEntryEvent(fplClient.getFantasyEntryEvent(entry.entryId(), gameweek)));
		return new ClassicLeagueDiscovery(league.displayName(), league.scoringType(), gameweek, entries, fplMapper.mapPlayers(bootstrap), entryEvents,
				fplMapper.mapLivePlayers(fplClient.getFantasyEventLive(gameweek)), matches);
	}

	private int currentGameweek(tools.jackson.databind.JsonNode bootstrap) {
		for (var event : bootstrap.path("events")) if (event.path("is_current").asBoolean(false)) return event.path("id").asInt();
		for (var event : bootstrap.path("events")) if (event.path("is_next").asBoolean(false)) return event.path("id").asInt();
		throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_GATEWAY,
				"FPL did not return a current or next gameweek.");
	}

	@PatchMapping("/admin/leagues/{leagueId}")
	public AdminLeague updateLeague(HttpServletRequest httpRequest, @PathVariable @Positive long leagueId,
			@Valid @RequestBody AdminLeagueSettingsRequest request) {
		return leagueService.updateForAdmin(currentUser(httpRequest), leagueId, request.serviceEnabled(),
				request.aiNarrationEnabled(), request.voiceNarrationEnabled());
	}

	private CurrentUser currentUser(HttpServletRequest request) {
		return sessionService.require(request);
	}

	public record LeagueRequest(@Positive long fplLeagueId, FplLeagueType leagueType) {
	}

	@GetMapping("/leagues/{leagueId}/draft-overview")
	public DraftLeagueDiscovery draftLeagueOverview(HttpServletRequest request, @PathVariable @Positive long leagueId) {
		var league = leagueService.accessibleLeague(currentUser(request), leagueId);
		if (league.leagueType() != FplLeagueType.DRAFT) {
			throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST,
					"This overview is only available for Draft leagues.");
		}
		var details = fplClient.getLeagueDetails(league.fplLeagueId());
		var gameweek = currentGameweek(fplClient.getFantasyBootstrapStatic());
		var entryEvents = new java.util.LinkedHashMap<Long, FplEntryEvent>();
		for (var entry : fplMapper.mapLeagueDetails(details).entries()) {
			entryEvents.put((long) entry.entryId(), fplMapper.mapEntryEvent(fplClient.getEntryEvent(entry.entryId(), gameweek)));
		}
		var livePlayers = fplMapper.mapDraftEventLive(fplClient.getDraftEventLive(gameweek)).players();
		return new DraftLeagueDiscovery(details, fplClient.getLeagueElementStatus(league.fplLeagueId()),
				fplMapper.mapPlayers(fplClient.getDraftBootstrapStatic()), entryEvents, livePlayers);
	}

	@GetMapping("/fpl/shirts")
	public List<FplClubShirt> shirts(HttpServletRequest request) {
		currentUser(request);
		return fplMapper.mapClubShirts(fplClient.getFantasyBootstrapStatic());
	}

	public record LeagueRegistrationAccess(boolean canRegisterLeague) {
	}

	@PostMapping("/leagues/{leagueId}/broadcast/open")
	public LiveStateResponse openBroadcast(HttpServletRequest request, @PathVariable @Positive long leagueId) {
		var user = currentUser(request);
		if (scheduleService.activeFor(user).isEmpty()) throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.FORBIDDEN, "There is no active broadcast for this time.");
		var league = leagueService.accessibleLeague(user, leagueId);
		return liveStateService.startRealForLeague(league.id(), league.fplLeagueId(), league.leagueType(), league.scoringType(),
				league.aiNarrationEnabled(), league.voiceNarrationEnabled());
	}

	public record AdminLeagueSettingsRequest(boolean serviceEnabled, boolean aiNarrationEnabled, boolean voiceNarrationEnabled) {
	}

	public record ClassicLeagueDiscovery(String leagueName, FplLeagueScoring scoringType, int gameweek,
			List<com.fantasybroadcast.backend.fpl.FplClassicLeagueEntry> entries, List<FplPlayer> players,
			java.util.Map<Long, FplEntryEvent> entryEvents, List<FplLivePlayer> livePlayers,
			List<com.fantasybroadcast.backend.fpl.FplClassicMatch> matches) {
	}

	public record DraftLeagueDiscovery(tools.jackson.databind.JsonNode details, tools.jackson.databind.JsonNode elementStatus,
			List<FplPlayer> players, java.util.Map<Long, FplEntryEvent> entryEvents, List<FplLivePlayer> livePlayers) {
	}
}
