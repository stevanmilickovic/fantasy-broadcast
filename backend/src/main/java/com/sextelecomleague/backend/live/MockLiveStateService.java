package com.sextelecomleague.backend.live;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.List;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

@Service
public class MockLiveStateService {

	private final List<LiveStateResponse> snapshots;
	private int currentIndex;
	private boolean started;

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

	public synchronized LiveStateResponse start() {
		started = true;
		currentIndex = 0;
		return currentState();
	}

	public synchronized LiveStateResponse advance() {
		started = true;
		if (currentIndex < snapshots.size() - 1) {
			currentIndex++;
		}
		return currentState();
	}

	public synchronized LiveStateResponse reset() {
		started = false;
		currentIndex = 0;
		return currentState();
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
