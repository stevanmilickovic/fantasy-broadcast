package com.fantasybroadcast.backend.live;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/** League-only updates do not start broadcasts or consume paid broadcast viewer slots. */
@Service
public class LeagueLiveUpdates {
	private final Map<Long, LeagueLiveProjection.Projection> current = new HashMap<>();
	private final Map<Long, CopyOnWriteArrayList<SseEmitter>> listeners = new HashMap<>();

	public synchronized LeagueLiveProjection.Projection current(long leagueId) { return current.get(leagueId); }

	public synchronized SseEmitter connect(long leagueId, Runnable accessCheck) {
		accessCheck.run();
		var leagueListeners = listeners.computeIfAbsent(leagueId, unused -> new CopyOnWriteArrayList<>());
		if (leagueListeners.size() >= 100) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "League updates are busy. Please try again.");
		var emitter = new SseEmitter(60_000L) {
			@Override public void send(SseEventBuilder event) throws IOException { accessCheck.run(); super.send(event); }
		};
		Runnable remove = () -> remove(leagueId, emitter);
		emitter.onCompletion(remove);
		emitter.onTimeout(remove);
		emitter.onError(error -> remove.run());
		leagueListeners.add(emitter);
		var projection = current.get(leagueId);
		send(leagueId, emitter, projection == null ? "broadcast-stopped" : "league-live", projection == null ? "" : projection);
		return emitter;
	}

	public synchronized void publish(long leagueId, LeagueLiveProjection.Projection projection) {
		current.put(leagueId, projection);
		notify(leagueId, "league-live", projection);
	}
	public synchronized void failed(long leagueId) { notify(leagueId, "broadcast-error", "FPL update failed. Showing last received values."); }
	public synchronized void stopped(long leagueId) {
		current.remove(leagueId);
		notify(leagueId, "broadcast-stopped", "");
	}
	private void notify(long leagueId, String event, Object data) {
		var subscribers = listeners.get(leagueId);
		if (subscribers != null) for (var emitter : subscribers) send(leagueId, emitter, event, data);
	}
	private synchronized void remove(long leagueId, SseEmitter emitter) {
		var subscribers = listeners.get(leagueId);
		if (subscribers == null) return;
		subscribers.remove(emitter);
		if (subscribers.isEmpty()) listeners.remove(leagueId);
	}
	private void send(long leagueId, SseEmitter emitter, String event, Object data) {
		try { emitter.send(SseEmitter.event().name(event).data(data)); }
		catch (IOException | RuntimeException error) { remove(leagueId, emitter); emitter.completeWithError(error); }
	}
}
