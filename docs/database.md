# Database

The application uses MySQL only when the `db` Spring profile is active.

Default local/test startup does not require a database. This keeps FPL discovery and mock broadcast work lightweight while the customer, payment, and broadcast data model remains available through the `db` profile.

Each stored league records both its FPL source type (`DRAFT` or `CLASSIC`) and scoring type (`H2H` or `TOTAL_POINTS`).
H2H broadcasts expose paired matchups; total-points broadcasts expose the participating teams without pairing them into matches.

## Profile

Run the backend with database support:

```bash
docker compose up -d db
cd backend
SPRING_PROFILES_ACTIVE=db ./mvnw spring-boot:run
```

Default connection settings:

```text
DB_URL=jdbc:mysql://localhost:3307/fantasy_broadcast
DB_USERNAME=fantasy_broadcast
DB_PASSWORD=fantasy_broadcast
MYSQL_HOST_PORT=3307
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

The database stores service/customer data, not live FPL state. Its schema includes:

- `app_user`
- `league`
- `league_context`
- `subscription` and payment-related registration data
- `broadcast_schedule`
- `broadcast_narration`
- password-reset and account-deletion request records

Customer authentication and `league_registration` let several customer accounts register or follow the same stored league. To create the initial administrator, configure both `BROADCAST_INITIAL_ADMIN_EMAIL` and `BROADCAST_INITIAL_ADMIN_PASSWORD` before the first production startup; no default `admin` account is created.

FPL remains the source of truth for live scores, players, fixtures, ownership, league members, and standings. The database stores app-specific state such as accounts, registered leagues, paid subscriptions, and free-form league context.

Per-league AI and voice narration settings control whether generated commentary and audio are available. Narration usage and audio lifecycle data are stored separately from the live FPL state.
