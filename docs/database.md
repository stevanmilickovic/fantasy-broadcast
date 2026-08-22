# Database

The application uses MySQL only when the `db` Spring profile is active.

Default local/test startup does not require a database. This keeps FPL discovery and mock broadcast work lightweight while the paid-service data model is being built.

## Profile

Run the backend with database support:

```bash
SPRING_PROFILES_ACTIVE=db ./mvnw spring-boot:run
```

Default connection settings:

```text
DB_URL=jdbc:mysql://localhost:3306/stk_broadcast
DB_USERNAME=stk_broadcast
DB_PASSWORD=stk_broadcast
```

Override them as environment variables for local or production deployments.

## Liquibase

Liquibase changelog:

```text
backend/src/main/resources/db/changelog/db.changelog-master.yaml
```

Initial migration:

```text
backend/src/main/resources/db/changelog/changes/001-initial-service-schema.yaml
```

The initial schema stores service/customer data, not live FPL state:

- `app_user`
- `league`
- `league_context`
- `subscription`

The follow-up migration adds customer authentication fields and `league_registration`, which lets several customer accounts register the same stored league. With the `db` profile active, the backend creates the initial administrator account on startup: username `admin`, password `admin`. Change that password before any non-local deployment.

FPL remains the source of truth for live scores, players, fixtures, ownership, league members, and standings. The database stores app-specific state such as accounts, registered leagues, paid subscriptions, and free-form league context.

AI access is currently represented on `subscription` with `ai_enabled` and `ai_monthly_limit`. Add detailed usage-event tracking later only if the billing model needs metered AI accounting.
