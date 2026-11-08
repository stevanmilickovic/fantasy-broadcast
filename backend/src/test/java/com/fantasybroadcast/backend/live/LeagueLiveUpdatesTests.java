package com.fantasybroadcast.backend.live;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class LeagueLiveUpdatesTests {
	@Test void streamsRecheckAccessAndRemoveRevokedListenersWithoutStartingAnyBroadcast() {
		var updates = new LeagueLiveUpdates();
		var allowed = new AtomicBoolean(true); var checks = new AtomicInteger();
		assertThat(updates.current(4)).isNull();
		updates.connect(4, () -> { checks.incrementAndGet(); if (!allowed.get()) throw new IllegalStateException("Revoked"); });
		assertThat(checks.get()).isEqualTo(2);
		var projection = mock(LeagueLiveProjection.Projection.class);
		updates.publish(4, projection);
		assertThat(updates.current(4)).isSameAs(projection);
		assertThat(checks.get()).isEqualTo(3);
		allowed.set(false);
		updates.publish(4, projection);
		assertThat(checks.get()).isEqualTo(4);
		updates.failed(4); updates.stopped(4);
		assertThat(checks.get()).isEqualTo(4);
		assertThat(updates.current(4)).isNull();
		assertThatThrownBy(() -> updates.connect(4, () -> { throw new IllegalStateException("Denied"); })).hasMessage("Denied");
	}
}
