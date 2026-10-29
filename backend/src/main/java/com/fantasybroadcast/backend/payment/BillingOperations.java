package com.fantasybroadcast.backend.payment;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.UUID;
import java.util.function.Supplier;
import org.springframework.context.annotation.Profile;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Commit the claim before contacting Paddle: an ambiguous timeout must never submit twice. */
@Repository
@Profile("db & !test")
public class BillingOperations {
	private final JdbcTemplate jdbc;
	private final ObjectMapper json;
	public BillingOperations(JdbcTemplate jdbc, ObjectMapper json) { this.jdbc = jdbc; this.json = json; }

	public JsonNode run(String id, String scope, long actor, Object input, Supplier<JsonNode> action) {
		try { UUID.fromString(id); }
		catch (IllegalArgumentException exception) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A valid request reference is required."); }
		var fingerprint = fingerprint(input);
		var previous = jdbc.queryForList("select * from billing_operation where id = ?", id);
		if (!previous.isEmpty()) {
			var row = previous.getFirst();
			if (!scope.equals(row.get("scope")) || actor != ((Number) row.get("actor_id")).longValue() || !fingerprint.equals(row.get("fingerprint")))
				throw new ResponseStatusException(HttpStatus.CONFLICT, "This request reference has already been used.");
			if ("completed".equals(row.get("status"))) return json.readTree((String) row.get("result"));
			throw new ResponseStatusException(HttpStatus.CONFLICT, "This request is awaiting confirmation. Refresh its status; do not submit it again.");
		}
		try {
			jdbc.update("insert into billing_operation (id, active_scope, scope, actor_id, fingerprint, request_data, status) values (?, ?, ?, ?, ?, ?, 'processing')", id, scope, scope, actor, fingerprint, json.writeValueAsString(input));
		} catch (DuplicateKeyException exception) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "Another billing request is awaiting confirmation. Refresh its status first.");
		}
		try {
			var result = action.get();
			complete(id, result);
			return result;
		} catch (PaddleClient.UncertainResult exception) {
			jdbc.update("update billing_operation set status = 'uncertain' where id = ?", id);
			throw exception;
		} catch (ResponseStatusException exception) {
			jdbc.update("update billing_operation set status = 'failed', active_scope = null where id = ?", id);
			throw exception;
		} catch (RuntimeException exception) {
			jdbc.update("update billing_operation set status = 'uncertain' where id = ?", id);
			throw exception;
		}
	}

	public void complete(String id, JsonNode result) {
		jdbc.update("update billing_operation set status = 'completed', active_scope = null, provider_id = ?, result = ? where id = ?",
				result.path("id").asText(""), json.writeValueAsString(result), id);
	}

	public void confirm(String id, String scope, JsonNode result) {
		jdbc.update("update billing_operation set status = 'completed', active_scope = null, provider_id = ?, result = ? where id = ? and scope = ?",
				result.path("id").asText(""), json.writeValueAsString(result), id, scope);
	}

	public boolean pending(String scope) {
		return jdbc.queryForObject("select count(*) from billing_operation where active_scope = ?", Integer.class, scope) > 0;
	}

	public void reconcileSubscription(String id, JsonNode data, BillingPlan plan) {
		var rows = jdbc.queryForList("select id, request_data from billing_operation where active_scope = ? and created_at < ?", "subscription:" + id,
				java.sql.Timestamp.from(java.time.Instant.now().minusSeconds(120)));
		for (var row : rows) {
			var input = json.readTree((String) row.get("request_data"));
			boolean confirmed = false;
			if (input.has("target")) {
				var version = BillingRepository.instant(input, "version");
				var updated = BillingRepository.instant(data, "updated_at");
				confirmed = input.path("target").asText().equals(plan.name()) && version != null && updated != null && updated.isAfter(version);
			} else if (input.has("undo")) {
				var cancelling = data.path("scheduled_change").path("action").asText().equals("cancel");
				confirmed = input.path("undo").asBoolean() ? !cancelling && data.path("status").asText().equals("active") : cancelling || data.path("status").asText().equals("canceled");
			}
			if (confirmed) confirm((String) row.get("id"), "subscription:" + id, data);
		}
	}

	private String fingerprint(Object value) {
		try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(json.writeValueAsString(value).getBytes(StandardCharsets.UTF_8))); }
		catch (java.security.NoSuchAlgorithmException exception) { throw new IllegalStateException(exception); }
	}
}
