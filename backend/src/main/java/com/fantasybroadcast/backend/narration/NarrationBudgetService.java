package com.fantasybroadcast.backend.narration;

import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneOffset;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

@Service
@Profile("db & !test")
public class NarrationBudgetService {

	private final NarrationProperties properties;
	private final BroadcastNarrationRepository repository;

	public NarrationBudgetService(NarrationProperties properties, BroadcastNarrationRepository repository) {
		this.properties = properties;
		this.repository = repository;
	}

	public boolean canCreateNarration(long leagueId, int gameweek) {
		return repository.countForLeagueGameweek(leagueId, gameweek) < properties.getLimits().getMaxNarrationsPerLeagueGameweek();
	}

	public boolean canGenerateAudio(int characters) {
		var month = YearMonth.now(ZoneOffset.UTC);
		var startsAt = month.atDay(1).atStartOfDay().toInstant(ZoneOffset.UTC);
		var endsAt = month.plusMonths(1).atDay(1).atStartOfDay().toInstant(ZoneOffset.UTC);
		return repository.ttsCharactersCreatedBetween(startsAt, endsAt) + Math.max(0, characters)
				<= properties.getLimits().getMonthlyTtsCharacterBudget();
	}

	public Instant audioExpiresAt() {
		return Instant.now().plus(properties.getStorage().getAudioTtl());
	}
}
