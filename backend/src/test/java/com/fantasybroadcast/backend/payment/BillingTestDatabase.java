package com.fantasybroadcast.backend.payment;

import liquibase.Contexts;
import liquibase.LabelExpression;
import liquibase.Liquibase;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import org.h2.jdbcx.JdbcDataSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.JdbcTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;

final class BillingTestDatabase {
	final JdbcTemplate jdbc;
	final BillingRepository repository;
	final BillingOperations operations;
	final ObjectMapper json = new ObjectMapper();

	BillingTestDatabase() throws Exception {
		var source = new JdbcDataSource();
		source.setURL("jdbc:h2:mem:billing-" + System.nanoTime() + ";MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1");
		jdbc = new JdbcTemplate(source);
		// Model the existing schema; older changesets use MySQL-specific constraint names.
		jdbc.execute("create table app_user (id bigint primary key, email varchar(255), display_name varchar(255))");
		jdbc.execute("create table league (id bigint primary key, fpl_league_id bigint, display_name varchar(255), owner_user_id bigint, league_type varchar(20) default 'DRAFT', service_enabled boolean default true, ai_narration_enabled boolean default false, voice_narration_enabled boolean default false)");
		jdbc.execute("create table subscription (id bigint auto_increment primary key, league_id bigint, billing_provider varchar(60), billing_customer_id varchar(160), billing_subscription_id varchar(160), plan_code varchar(80), status varchar(40), ai_enabled boolean default false, current_period_start timestamp, current_period_end timestamp, created_at timestamp default current_timestamp, updated_at timestamp default current_timestamp)");
		try (var connection = source.getConnection(); var liquibase = new Liquibase("db/billing-changelog.yaml", new ClassLoaderResourceAccessor(), new JdbcConnection(connection))) {
			liquibase.update(new Contexts(), new LabelExpression());
		}
		jdbc.update("insert into app_user (id, email, display_name) values (1, 'owner@example.com', 'Owner')");
		jdbc.update("insert into league (id, fpl_league_id, display_name, owner_user_id) values (1, 100, 'Test league', 1)");
		repository = new BillingRepository(jdbc, new TransactionTemplate(new JdbcTransactionManager(source)), json);
		operations = new BillingOperations(jdbc, json);
	}
}
