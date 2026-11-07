package com.fantasybroadcast.backend.customer;

import java.util.HashSet;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import liquibase.change.custom.CustomTaskChange;
import liquibase.database.Database;
import liquibase.database.jvm.JdbcConnection;
import liquibase.exception.CustomChangeException;
import liquibase.exception.ValidationErrors;
import liquibase.resource.ResourceAccessor;

/** Preserve existing usernames; unexpected canonical duplicates require explicit repair. */
public class UsernameKeyMigration implements CustomTaskChange {
	@Override public void execute(Database database) throws CustomChangeException {
		try {
			var connection = ((JdbcConnection) database.getConnection()).getUnderlyingConnection();
			var keys = new LinkedHashMap<Long, byte[]>();
			var used = new HashSet<String>();
			try (var statement = connection.createStatement(); var rows = statement.executeQuery("select id, display_name from app_user order by id")) {
				while (rows.next()) {
					var key = Usernames.key(rows.getString("display_name"));
					if (key.length == 0 || key.length > 2048 || !used.add(HexFormat.of().formatHex(key)))
						throw new CustomChangeException("Existing usernames need review before enabling uniqueness; no names were changed.");
					keys.put(rows.getLong("id"), key);
				}
			}
			try (var update = connection.prepareStatement("update app_user set username_key = ? where id = ?")) {
				for (var entry : keys.entrySet()) {
					update.setBytes(1, entry.getValue()); update.setLong(2, entry.getKey()); update.addBatch();
				}
				update.executeBatch();
			}
		} catch (java.sql.SQLException exception) {
			throw new CustomChangeException("Could not initialize username uniqueness.", exception);
		}
	}
	@Override public String getConfirmationMessage() { return "Existing username keys initialized without renaming accounts."; }
	@Override public void setUp() { }
	@Override public void setFileOpener(ResourceAccessor accessor) { }
	@Override public ValidationErrors validate(Database database) { return new ValidationErrors(); }
}
