package com.fantasybroadcast.backend.customer;

import static org.assertj.core.api.Assertions.*;
import java.time.*;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class LeagueChatTests extends LeaguePrivacyTests {
	private LeagueChatService chat;
	private final MutableClock clock = new MutableClock();
	@Test void responsesNeverSerializeAccountEmails() throws Exception {
		var mapper = new tools.jackson.databind.ObjectMapper();
		var sent = chat.send(owner, 1, "Hello", UUID.randomUUID().toString());
		assertThat(mapper.writeValueAsString(sent)).doesNotContain("email", owner.email());
		assertThat(mapper.writeValueAsString(chat.messages(owner, 1, null, null)))
				.doesNotContain("email", owner.email());
		memberships.setPrivacy(owner, 1, true);
		leagues.follow(follower, 1);
		assertThat(mapper.writeValueAsString(memberships.requests(owner, 1L)))
				.contains("Follower").doesNotContain("email", follower.email());
		assertThat(mapper.writeValueAsString(memberships.requests(follower, null)))
				.doesNotContain("email", follower.email());
	}
	@BeforeEach void chatSetup() throws Exception {
		try (var connection = jdbc.getDataSource().getConnection(); var migration = new liquibase.Liquibase("db/changelog/changes/016-league-chat.yaml", new liquibase.resource.ClassLoaderResourceAccessor(), new liquibase.database.jvm.JdbcConnection(connection))) {
			migration.update(new liquibase.Contexts(), new liquibase.LabelExpression());
		}
		chat = new LeagueChatService(jdbc, leagues, clock);
	}
	@Test void authorIdentityIsResolvedFromAccountsAndSendRetriesAreIdempotent() {
		var sendId = UUID.randomUUID().toString();
		var first = chat.send(owner, 1, "<script>plain text</script>", sendId);
		assertThat(chat.send(owner, 1, first.body(), sendId).id()).isEqualTo(first.id());
		jdbc.update("update app_user set display_name = 'New name' where id = 1");
		assertThat(chat.messages(owner, 1, null, null).messages().getFirst().displayName()).isEqualTo("New name");
		assertThatThrownBy(() -> chat.send(owner, 1, "different", sendId)).isInstanceOf(ResponseStatusException.class);
		assertThatThrownBy(() -> chat.messages(follower, 1, null, null)).isInstanceOf(ResponseStatusException.class);
		assertThatThrownBy(() -> chat.send(follower, 1, "Hello", UUID.randomUUID().toString())).isInstanceOf(ResponseStatusException.class);
		leagues.follow(follower, 1);
		assertThat(chat.messages(follower, 1, null, null).messages()).hasSize(1);
		leagues.unfollow(follower, 1);
		assertThatThrownBy(() -> chat.messages(follower, 1, null, null)).isInstanceOf(ResponseStatusException.class);
		assertThat(chat.messages(follower, 2, null, null).messages()).isEmpty();
	}
	@Test void expiryIsExactEvenBeforeCleanupAndDatabaseDeletionCascades() {
		chat.send(owner, 1, "Hello", UUID.randomUUID().toString());
		clock.now = clock.now.plus(Duration.ofHours(24)).minusMillis(1);
		assertThat(chat.messages(owner, 1, null, null).messages()).hasSize(1);
		clock.now = clock.now.plusMillis(1);
		assertThat(chat.messages(owner, 1, null, null).messages()).isEmpty();
		chat.deleteExpired();
		assertThat(jdbc.queryForObject("select count(*) from league_chat_message", Integer.class)).isZero();
		chat.send(owner, 1, "Fresh", UUID.randomUUID().toString());
		jdbc.update("delete from app_user where id = 1");
		assertThat(jdbc.queryForObject("select count(*) from league_chat_message", Integer.class)).isZero();
	}
	@Test void paginationAndRateLimitsAreBounded() {
		for (int i = 0; i < 61; i++) {
			chat.send(owner, 1, "Message " + i, UUID.randomUUID().toString());
			clock.now = clock.now.plusSeconds(4);
		}
		var latest = chat.messages(owner, 1, null, null);
		assertThat(latest.messages()).hasSize(50);
		assertThat(latest.hasOlder()).isTrue();
		var older = chat.messages(owner, 1, Long.parseLong(latest.messages().getFirst().id()), null);
		assertThat(older.messages()).hasSize(11);
		assertThat(older.hasOlder()).isFalse();
		var newer = chat.messages(owner, 1, null, Long.parseLong(older.messages().getFirst().id()));
		assertThat(newer.hasMore()).isTrue();
		assertThatThrownBy(() -> chat.messages(owner, 1, 1L, 2L)).isInstanceOf(ResponseStatusException.class);
		clock.now = clock.now.plusSeconds(61);
		for (int i = 0; i < 5; i++) chat.send(owner, 1, "Burst", UUID.randomUUID().toString());
		assertThatThrownBy(() -> chat.send(owner, 1, "Too fast", UUID.randomUUID().toString())).isInstanceOf(ResponseStatusException.class);
		assertThatThrownBy(() -> chat.send(owner, 1, "  ", UUID.randomUUID().toString())).isInstanceOf(ResponseStatusException.class);
	}
	private static class MutableClock extends Clock {
		Instant now = Instant.parse("2026-10-31T12:00:00Z");
		@Override public ZoneId getZone() { return ZoneOffset.UTC; }
		@Override public Clock withZone(ZoneId zone) { return this; }
		@Override public Instant instant() { return now; }
	}
}
