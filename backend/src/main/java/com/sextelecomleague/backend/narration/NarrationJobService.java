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
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

@Service
@Profile("db & !test")
public class NarrationJobService {
	private static final Logger log = LoggerFactory.getLogger(NarrationJobService.class);

	private final NarrationProperties properties;
	private final BroadcastNarrationRepository repository;
	private final NarrationEventSelector eventSelector;
	private final NarrationBudgetService budgetService;
	private final CommentaryTextGenerator textGenerator;
	private final VoiceNarrationGenerator voiceGenerator;
	private final Executor executor;

	@Autowired
	public NarrationJobService(NarrationProperties properties, BroadcastNarrationRepository repository,
			NarrationEventSelector eventSelector, NarrationBudgetService budgetService, CommentaryTextGenerator textGenerator,
			VoiceNarrationGenerator voiceGenerator) {
		this(properties, repository, eventSelector, budgetService, textGenerator, voiceGenerator, Executors.newFixedThreadPool(2));
	}

	NarrationJobService(NarrationProperties properties, BroadcastNarrationRepository repository,
			NarrationEventSelector eventSelector, NarrationBudgetService budgetService, CommentaryTextGenerator textGenerator,
			VoiceNarrationGenerator voiceGenerator, Executor executor) {
		this.properties = properties;
		this.repository = repository;
		this.eventSelector = eventSelector;
		this.budgetService = budgetService;
		this.textGenerator = textGenerator;
		this.voiceGenerator = voiceGenerator;
		this.executor = executor;
	}

	public boolean enqueueForEvents(long leagueId, LiveStateResponse state) {
		return enqueueForEvents(leagueId, state, true);
	}

	public boolean enqueueForEvents(long leagueId, LiveStateResponse state, boolean voiceNarrationEnabled) {
		if (!properties.isEnabled() || state.events().isEmpty()) return false;
		var staged = false;
		for (var event : selectedEvents(state.events())) {
			if (!budgetService.canCreateNarration(leagueId, state.gameweek())) {
				log.info("Skipping narration: leagueId={}, gameweek={}, sourceEventId={}, reason=league_gameweek_limit",
						leagueId, state.gameweek(), event.id());
				continue;
			}
			staged = true;
			repository.createPendingIfAbsent(leagueId, state.gameweek(), event.id())
					.ifPresent(narration -> executor.execute(() -> generate(narration.id(), context(leagueId, state.gameweek(), event, voiceNarrationEnabled))));
		}
		return staged;
	}

	void generate(long narrationId, NarrationContext context) {
		try {
			var commentary = textGenerator.generate(context);
			var narration = repository.markTextReady(narrationId, commentary.text(), commentary.inputTokens(), commentary.outputTokens()).orElseThrow();
			if (!properties.isAudioEnabled() || !context.voiceNarrationEnabled()) {
				return;
			}
			if (!budgetService.canGenerateAudio(narration.text().length())) {
				log.info("Publishing text-only narration: narrationId={}, reason=monthly_tts_budget", narration.id());
				return;
			}
			var voice = voiceGenerator.generate(context.sourceEventId(), narration.text());
			repository.markAudioReady(narration.id(), voice.audioPath(), voice.characters(), voice.expiresAt());
		}
		catch (RuntimeException exception) {
			log.warn("Narration generation failed: narrationId={}, sourceEventId={}", narrationId, context.sourceEventId(), exception);
			repository.markFailed(narrationId, exception.getMessage());
		}
	}

	private List<FantasyEventView> selectedEvents(List<FantasyEventView> events) {
		return events.stream().filter(eventSelector::shouldNarrate).toList();
	}

	private NarrationContext context(long leagueId, int gameweek, FantasyEventView event, boolean voiceNarrationEnabled) {
		return new NarrationContext(leagueId, gameweek, event.id(), event.type(), event.managerId(),
				event.playerId(), event.summary(), event.pointDelta(), properties.getLimits().getMaxTextCharacters(),
				voiceNarrationEnabled);
	}

	@PreDestroy
	void shutdown() {
		if (executor instanceof ExecutorService executorService) {
			executorService.shutdownNow();
		}
	}
}
