package com.fantasybroadcast.backend.live;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.spy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import com.fantasybroadcast.backend.api.ApiExceptionHandler;
import com.fantasybroadcast.backend.api.LiveStateController;
import com.fantasybroadcast.backend.customer.CurrentUser;
import com.fantasybroadcast.backend.customer.LeagueRegistrationService;
import com.fantasybroadcast.backend.customer.SessionService;
import com.fantasybroadcast.backend.customer.UserRole;
import com.fantasybroadcast.backend.fpl.FplDraftClient;
import com.fantasybroadcast.backend.fpl.FplDraftMapper;
import com.fantasybroadcast.backend.narration.BroadcastNarrationRepository;
import com.fantasybroadcast.backend.narration.NarrationJobService;
import com.fantasybroadcast.backend.narration.NarrationProperties;
import com.fantasybroadcast.backend.security.BroadcastSecurityProperties;
import jakarta.servlet.AsyncEvent;
import jakarta.servlet.http.Cookie;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import org.springframework.mock.web.MockAsyncContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import tools.jackson.databind.ObjectMapper;

class BroadcastViewerLimitTests {

	private final List<MvcResult> connections = new CopyOnWriteArrayList<>();
	private MockLiveStateService service;
	private MockMvc mvc;
	private Cookie session;

	@BeforeEach
	void setUp() {
		var beans = new StaticListableBeanFactory();
		service = spy(new MockLiveStateService(new ObjectMapper(), mock(FplDraftClient.class), new FplDraftMapper(),
				beans.getBeanProvider(NarrationJobService.class), beans.getBeanProvider(BroadcastNarrationRepository.class),
				beans.getBeanProvider(NarrationProperties.class), beans.getBeanProvider(BroadcastNotificationRepository.class)));
		doReturn(service.currentState()).when(service).currentState(anyLong());
		var sessions = new SessionService();
		session = new Cookie(SessionService.COOKIE_NAME, sessions.create(new CurrentUser(1, "test@example.com", "Viewer", UserRole.ADMIN)));
		var controller = new LiveStateController(service, sessions, mock(LeagueRegistrationService.class), new BroadcastSecurityProperties(),
				mock(com.fantasybroadcast.backend.payment.SubscriptionService.class));
		mvc = MockMvcBuilders.standaloneSetup(controller).setControllerAdvice(new ApiExceptionHandler()).build();
	}

	@AfterEach
	void closeStreams() {
		for (var result : connections) if (result.getRequest().isAsyncStarted()) result.getRequest().getAsyncContext().complete();
		if (service != null) service.shutdown();
	}

	@Test
	void acceptsFiftyViewersAndRejectsTheNextWithAClearTerminalEvent() throws Exception {
		for (int i = 0; i < 50; i++) assertLive(open("?leagueId=1"));
		var full = open("?leagueId=1");
		assertThat(full.getResponse().getContentAsString()).contains("event:broadcast-full", "50 simultaneous viewers")
				.doesNotContain("event:live-state");
		assertThat(full.getAsyncResult(1000)).isNull();
	}

	@Test
	void simultaneousJoinsCannotExceedTheLimitAndOtherLeaguesHaveTheirOwnSlots() throws Exception {
		try (var executor = Executors.newFixedThreadPool(8)) {
			var start = new CountDownLatch(1);
			var results = new ArrayList<java.util.concurrent.Future<MvcResult>>();
			for (int i = 0; i < 75; i++) results.add(executor.submit(() -> { start.await(); return open("?leagueId=1"); }));
			start.countDown();
			int accepted = 0;
			int rejected = 0;
			for (var result : results) {
				var body = result.get(10, TimeUnit.SECONDS).getResponse().getContentAsString();
				if (body.contains("event:live-state")) accepted++;
				if (body.contains("event:broadcast-full")) rejected++;
			}
			assertThat(accepted).isEqualTo(50);
			assertThat(rejected).isEqualTo(25);
		}
		assertLive(open("?leagueId=2"));
	}

	@Test
	void completionTimeoutAndNetworkFailureReleaseViewerSlots() throws Exception {
		for (int i = 0; i < 50; i++) open("?leagueId=1");
		connections.getFirst().getRequest().getAsyncContext().complete();
		assertLive(open("?leagueId=1"));
		var timeout = (MockAsyncContext) connections.get(1).getRequest().getAsyncContext();
		for (var listener : timeout.getListeners()) listener.onTimeout(new AsyncEvent(timeout));
		assertLive(open("?leagueId=1"));
		var failed = (MockAsyncContext) connections.get(2).getRequest().getAsyncContext();
		for (var listener : failed.getListeners()) listener.onError(new AsyncEvent(failed, new IOException("Client disconnected")));
		assertLive(open("?leagueId=1"));
		assertThat(open("?leagueId=1").getResponse().getContentAsString()).contains("event:broadcast-full");
	}

	@Test
	void endingLeagueSessionsClosesTheirStreamsAndReleasesAllSlots() throws Exception {
		for (int i = 0; i < 50; i++) open("?leagueId=1");
		service.stopLeagueSessions();
		for (var connection : connections) assertThat(connection.getAsyncResult(1000)).isNull();
		assertLive(open("?leagueId=1"));
	}

	@Test
	void theAdminBroadcastAlsoHasAFiftyViewerLimit() throws Exception {
		for (int i = 0; i < 50; i++) assertLive(open(""));
		assertThat(open("").getResponse().getContentAsString()).contains("event:broadcast-full");
	}

	private MvcResult open(String query) throws Exception {
		var result = mvc.perform(get("/api/live-state/stream" + query).cookie(session)).andReturn();
		assertThat(result.getResponse().getStatus()).isEqualTo(200);
		connections.add(result);
		return result;
	}

	private void assertLive(MvcResult result) throws Exception {
		assertThat(result.getResponse().getContentAsString()).contains("event:live-state").doesNotContain("event:broadcast-full");
	}
}
