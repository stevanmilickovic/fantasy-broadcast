package com.sextelecomleague.backend.live;

import com.sextelecomleague.backend.customer.BroadcastScheduleService;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@Profile("db & !test")
public class BroadcastScheduleGenerator {

	private final BroadcastScheduleService schedules;

	public BroadcastScheduleGenerator(BroadcastScheduleService schedules) {
		this.schedules = schedules;
	}

	@Scheduled(cron = "0 0 1 * * *", zone = "Europe/Budapest")
	public void generateToday() {
		schedules.generateForToday();
	}
}
