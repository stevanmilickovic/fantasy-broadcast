package com.sextelecomleague.backend.narration;

import java.util.List;
import java.util.concurrent.Executor;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import com.sextelecomleague.backend.live.FantasyEventView;
import com.sextelecomleague.backend.live.LiveStateResponse;

import jakarta.annotation.PreDestroy;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

@Service
@Profile("db & !test")
public class NarrationJobService {
	private static final Logger log = LoggerFactory.getLogger(NarrationJobService.class);

	private final NarrationProperties properties;
	private final BroadcastNarrationRepository repository;
	private final NarrationEventSelector eventSelector;
	private final CommentaryTextGenerator textGenerator;
	private final VoiceNarrationGenerator voiceGenerator;
	private final Executor executor;
	private final ApplicationEventPublisher eventPublisher;

	public NarrationJobService(NarrationProperties properties, BroadcastNarrationRepository repository,
			NarrationEventSelector eventSelector, CommentaryTextGenerator textGenerator,
			VoiceNarrationGenerator voiceGenerator, ApplicationEventPublisher eventPublisher) {
		this(properties, repository, eventSelector, textGenerator, voiceGenerator, eventPublisher, Executors.newFixedThreadPool(2));
	}

	NarrationJobService(NarrationProperties properties, BroadcastNarrationRepository repository,
			NarrationEventSelector eventSelector, CommentaryTextGenerator textGenerator,
			VoiceNarrationGenerator voiceGenerator, ApplicationEventPublisher eventPublisher, Executor executor) {
		this.properties = properties;
		this.repository = repository;
		this.eventSelector = eventSelector;
		this.textGenerator = textGenerator;
		this.voiceGenerator = voiceGenerator;
		this.eventPublisher = eventPublisher;
		this.executor = executor;
	}

	public void enqueueForEvents(long leagueId, LiveStateResponse state) {
		if (!properties.isEnabled() || state.events().isEmpty()) return;
		for (var event : selectedEvents(state.events())) {
			repository.createPendingIfAbsent(leagueId, state.gameweek(), event.id())
					.ifPresent(narration -> executor.execute(() -> generate(narration.id(), context(leagueId, state.gameweek(), event))));
		}
	}

	void generate(long narrationId, NarrationContext context) {
		try {
			var commentary = textGenerator.generate(context);
			var narration = repository.markTextReady(narrationId, commentary.text(), commentary.inputTokens(), commentary.outputTokens()).orElseThrow();
			if (!properties.isAudioEnabled()) {
				publishReady(context, narration.id());
				return;
			}
			var voice = voiceGenerator.generate(context.sourceEventId(), narration.text());
			repository.markAudioReady(narration.id(), voice.audioPath(), voice.characters(), voice.expiresAt());
			publishReady(context, narration.id());
		}
		catch (RuntimeException exception) {
			log.warn("Narration generation failed: narrationId={}, sourceEventId={}", narrationId, context.sourceEventId(), exception);
			repository.markFailed(narrationId, exception.getMessage());
		}
	}

	private List<FantasyEventView> selectedEvents(List<FantasyEventView> events) {
		return events.stream().filter(eventSelector::shouldNarrate).toList();
	}

	private NarrationContext context(long leagueId, int gameweek, FantasyEventView event) {
		return new NarrationContext(leagueId, gameweek, event.id(), event.type(), event.managerId(),
				event.playerId(), event.summary(), event.pointDelta(), properties.getLimits().getMaxTextCharacters());
	}

	private void publishReady(NarrationContext context, long narrationId) {
		eventPublisher.publishEvent(new NarrationReadyEvent(context.leagueId(), context.gameweek(), narrationId));
	}

	@PreDestroy
	void shutdown() {
		if (executor instanceof ExecutorService executorService) {
			executorService.shutdownNow();
		}
	}
}
