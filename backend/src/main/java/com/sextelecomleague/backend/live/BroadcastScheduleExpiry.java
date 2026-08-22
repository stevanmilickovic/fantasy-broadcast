package com.sextelecomleague.backend.live;

import com.sextelecomleague.backend.customer.BroadcastScheduleService;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@Profile("db & !test")
public class BroadcastScheduleExpiry {
	private final BroadcastScheduleService schedules;
	private final MockLiveStateService liveStates;
	public BroadcastScheduleExpiry(BroadcastScheduleService schedules, MockLiveStateService liveStates) { this.schedules = schedules; this.liveStates = liveStates; }
	@Scheduled(fixedDelay = 30000)
	public void stopExpiredLeagueBroadcasts() {
		if (!schedules.hasActiveSchedule()) liveStates.stopLeagueSessions();
	}
}
