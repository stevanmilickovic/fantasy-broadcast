package com.fantasybroadcast.backend.customer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

import java.sql.Timestamp;
import java.time.Instant;
import com.fantasybroadcast.backend.fpl.FplDraftClient;
import com.fantasybroadcast.backend.live.BroadcastScheduleExpiry;
import com.fantasybroadcast.backend.live.MockLiveStateService;
import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class BroadcastScheduleCleanupTests {
	@Test
	void deletesCompletedManualAndGeneratedSchedulesButKeepsTheEndBoundaryAndFutureSchedules() {
		var source = new JdbcDataSource();
		source.setURL("jdbc:h2:mem:schedules-" + System.nanoTime() + ";MODE=MySQL;DB_CLOSE_DELAY=-1");
		var jdbc = new JdbcTemplate(source);
		jdbc.execute("create table broadcast_schedule (id bigint primary key, starts_at timestamp, ends_at timestamp, auto_generated boolean)");
		var now = Instant.parse("2026-10-28T12:00:00Z");
		for (int id = 1; id <= 5; id++) {
			var end = id <= 2 ? now.minusSeconds(1) : id == 3 ? now : now.plusSeconds(3600);
			jdbc.update("insert into broadcast_schedule values (?, ?, ?, ?)", id, Timestamp.from(id == 5 ? now.plusSeconds(60) : now.minusSeconds(3600)), Timestamp.from(end), id == 2);
		}
		var schedules = new BroadcastScheduleService(jdbc, mock(FplDraftClient.class));
		schedules.deleteExpired(now);
		assertThat(jdbc.queryForList("select id from broadcast_schedule order by id", Long.class)).containsExactly(3L, 4L, 5L);
		schedules.deleteExpired(now);
		assertThat(jdbc.queryForObject("select count(*) from broadcast_schedule", Integer.class)).isEqualTo(3);
	}

	@Test
	void expiryJobCleansSchedulesWithoutStoppingAnOverlappingActiveBroadcast() {
		var schedules = mock(BroadcastScheduleService.class);
		var liveStates = mock(MockLiveStateService.class);
		var expiry = new BroadcastScheduleExpiry(schedules, liveStates);
		when(schedules.hasActiveSchedule()).thenReturn(true);
		expiry.stopExpiredLeagueBroadcasts();
		verify(schedules).deleteExpired(any(Instant.class));
		verifyNoInteractions(liveStates);
		when(schedules.hasActiveSchedule()).thenReturn(false);
		expiry.stopExpiredLeagueBroadcasts();
		verify(liveStates).stopLeagueSessions();
	}
}
