package com.sextelecomleague.backend.live;

import jakarta.annotation.PreDestroy;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import tools.jackson.databind.ObjectMapper;

@Service
public class MockLiveStateService {

	private static final long STREAM_TIMEOUT = Long.MAX_VALUE;
	private static final long STEP_INTERVAL_SECONDS = 10L;

	private final List<LiveStateResponse> snapshots;
	private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();
	private final ScheduledExecutorService sequenceExecutor = Executors.newSingleThreadScheduledExecutor();
	private int currentIndex;
	private boolean started;
	private ScheduledFuture<?> sequenceTask;

	public MockLiveStateService(ObjectMapper objectMapper) {
		try {
			var resource = new ClassPathResource("mock/live-sequence.json");
			this.snapshots = objectMapper.readValue(resource.getInputStream(), MockLiveSequence.class).snapshots();
		}
		catch (IOException exception) {
			throw new UncheckedIOException("Failed to load mock live sequence", exception);
		}
	}

	public synchronized LiveStateResponse currentState() {
		return withRuntimeSequence(snapshots.get(currentIndex));
	}

	public SseEmitter connectStream() {
		var emitter = new SseEmitter(STREAM_TIMEOUT);
		emitters.add(emitter);
		emitter.onCompletion(() -> emitters.remove(emitter));
		emitter.onTimeout(() -> emitters.remove(emitter));
		emitter.onError((error) -> emitters.remove(emitter));
		send(emitter, currentState());
		return emitter;
	}

	public synchronized LiveStateResponse start() {
		started = true;
		currentIndex = 0;
		cancelSequenceTask();
		var state = currentState();
		broadcast(state);
		sequenceTask = sequenceExecutor.scheduleAtFixedRate(this::advanceFromSchedule, STEP_INTERVAL_SECONDS,
				STEP_INTERVAL_SECONDS, TimeUnit.SECONDS);
		return state;
	}

	public synchronized LiveStateResponse advance() {
		started = true;
		if (currentIndex < snapshots.size() - 1) {
			currentIndex++;
		}
		if (currentIndex == snapshots.size() - 1) {
			cancelSequenceTask();
		}
		var state = currentState();
		broadcast(state);
		return state;
	}

	public synchronized LiveStateResponse reset() {
		started = false;
		currentIndex = 0;
		cancelSequenceTask();
		var state = currentState();
		broadcast(state);
		return state;
	}

	private void advanceFromSchedule() {
		advance();
	}

	private void cancelSequenceTask() {
		if (sequenceTask != null) {
			sequenceTask.cancel(false);
			sequenceTask = null;
		}
	}

	@PreDestroy
	public void shutdown() {
		cancelSequenceTask();
		sequenceExecutor.shutdownNow();
	}

	private void broadcast(LiveStateResponse state) {
		for (SseEmitter emitter : emitters) {
			send(emitter, state);
		}
	}

	private void send(SseEmitter emitter, LiveStateResponse state) {
		try {
			emitter.send(SseEmitter.event()
					.name("live-state")
					.data(state, MediaType.APPLICATION_JSON));
		}
		catch (IOException exception) {
			emitters.remove(emitter);
			emitter.completeWithError(exception);
		}
	}

	private LiveStateResponse withRuntimeSequence(LiveStateResponse state) {
		return new LiveStateResponse(
				state.status(),
				new SequenceState(currentIndex + 1, snapshots.size(), started, currentIndex == snapshots.size() - 1),
				state.gameweek(),
				state.matchups(),
				state.events(),
				state.commentary());
	}
}
