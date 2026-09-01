# Fantasy Broadcast Service

Live companion and broadcast service for Fantasy Premier League leagues, supporting both Draft and Classic formats.

The app reads the appropriate FPL or FPL Draft data source, builds live league state, detects fantasy events, displays live matchups in a web UI, sends notification-worthy updates, and can generate broadcaster-style commentary for optional text-to-speech narration.

## Repository Layout

```text
backend/   Spring Boot API, FPL integration, live-state logic
frontend/  React/Vite web application
docs/      shared project notes and FPL discovery notes
```

Main product brief:

```text
Fantasy Broadcast Service.md
```

## Requirements

- Java 21
- Node.js and npm
- Maven wrapper is included in `backend/`

## Backend

Build and run the backend in one command on Linux/macOS (recommended, from the repository root):

```bash
./backend/mvnw -f backend/pom.xml clean package
java -jar backend/target/backend-0.0.1-SNAPSHOT.jar
```

This compiles, tests, packages, and starts the backend. Stop it with `Ctrl+C`.

To only build and test:

```bash
./backend/mvnw -f backend/pom.xml clean package
```

For local development, run the backend directly without first packaging a JAR:

```bash
cd backend
./mvnw spring-boot:run
```

To enable the database-backed customer accounts and registered leagues, start with the `db` profile. To bootstrap the first administrator, set `BROADCAST_INITIAL_ADMIN_EMAIL` and `BROADCAST_INITIAL_ADMIN_PASSWORD` to strong local-only credentials before starting the service.

```bash
docker compose up -d db
cd backend
SPRING_PROFILES_ACTIVE=db ./mvnw spring-boot:run
```

The Compose service starts only the local MySQL database using the backend's default database settings. It publishes MySQL on host port `3307` by default so it does not conflict with a local MySQL already using `3306`. Override it with `MYSQL_HOST_PORT=3308 docker compose up -d db` if needed, and set `DB_URL` to the matching port when running the backend. Stop it with `docker compose down`; use `docker compose down -v` to also remove its local database data.

Windows PowerShell equivalents:

```powershell
docker compose up -d db
cd backend
$env:SPRING_PROFILES_ACTIVE = "db"
.\mvnw.cmd spring-boot:run
```

Stop the development command with `Ctrl+C` and rerun it after making backend changes.

Default local URL:

```text
http://localhost:8080
```

Health check:

```bash
curl http://localhost:8080/actuator/health
```

## Frontend

Install dependencies:

```bash
cd frontend
npm install
```

Run locally:

```bash
npm run dev
```

Build:

```bash
npm run build
```

## Current Direction

The service should be built for many registered FPL leagues—Draft or Classic—not one hardcoded private league.

Core principle:

```text
FPL data
  -> deterministic backend state
  -> deterministic event detection
  -> commentary decision logic
  -> external LLM writes commentary text
  -> frontend displays/narrates it
```

AI should not calculate scores or infer facts. It should only turn verified backend facts into natural-language commentary.

## Documentation

- [Product brief](Fantasy%20Broadcast%20Service.md)
- [FPL discovery notes](docs/fpl-discovery.md)
- [FPL JSON structures](docs/fpl-json-structures.md)
- [AI narration setup](docs/narration.md)
- [Backend FPL API notes](backend/docs/fpl-draft-api-notes.md)

## Security

Never commit API keys, FPL cookies, FPL access tokens, refresh tokens, Cloudflare tokens, database passwords, or model-provider secrets.

## Server configuration

The backend optionally imports an external configuration file from `./data/backend/application.yaml`, relative to the process that starts it. Set `BROADCAST_CONFIG_DIRECTORY` when that file is mounted elsewhere (for example, inside a future container).

Keep this server-only file out of Git. When authentication email is added, email delivery is enabled only when both `broadcast.email.from` and `broadcast.email.public-base-url` are set; otherwise the service will not attempt to use an email provider.

```yaml
broadcast:
  email:
    from: no-reply@your-domain.example
    public-base-url: https://preprod.your-domain.example
```
