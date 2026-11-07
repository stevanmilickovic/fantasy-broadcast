# Fantasy Broadcast

For native client development, start with the [mobile client handoff](docs/mobile-handoff.md), which maps the implemented flows, API routes, authentication, live stream, and current mobile gaps.

Fantasy Broadcast is a Fantasy Premier League companion app that turns registered Draft and Classic leagues into live matchday broadcasts.

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
- Node.js 22 (minimum 22.12) and npm
- Maven wrapper is included in `backend/`

## One-command local testing

Run from the repository root (Docker with Compose and OpenSSL are required; Java, Node
and Maven run inside the image builds):

```bash
./scripts/test-stack.sh
```

This compiles and tests the backend, builds the frontend, creates both Docker images,
and starts MySQL, the API and the web server. Run the same command after editing code
to rebuild and recreate the containers. The database persists in a dedicated
`fantasy-broadcast-test` Compose volume, separate from development/production data.
Build failures stop before the running containers are replaced.

Open **http://localhost:5173**. The API is at **http://localhost:8080**. Ports bind to
localhost only; MySQL is accessible inside the Compose network. Change `TEST_WEB_PORT`
and `TEST_BACKEND_PORT` in `.env.testing` if those ports are occupied.

Sign in as **skelolegenda@gmail.com** using `TEST_ADMIN_PASSWORD` from the generated
`.env.testing` file. This ignored file is created with private permissions on the first
run; retain it to keep database credentials consistent. The test stack makes this account
the only administrator on every backend startup, resets its password to the configured
local password, and rejects promotion of other accounts. Other user and league data is
preserved. This policy is opt-in; other environments retain their existing admin behavior.

Email delivery and AI narration are disabled in this isolated test setup, so email
verification/reset flows need separately configured mail delivery. FPL access uses the
real upstream API. Local development endpoints and league registration are enabled.
The stack does not import the host's private application configuration.

View logs or stop the stack without removing its database:

```bash
docker compose --env-file .env.testing -f compose.testing.yaml logs -f backend web
docker compose --env-file .env.testing -f compose.testing.yaml down
```

## Backend

Build and run the backend in one command on Linux/macOS (recommended, from the repository root):

```bash
./backend/mvnw -f backend/pom.xml clean package
java -jar backend/target/backend-1.3.5.jar
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

Use `SPRING_PROFILES_ACTIVE=db,local` to include local-only testing defaults such as Gmail SMTP host/from address. Provide secrets separately, for example `SMTP_PASSWORD=your-gmail-app-password`.

The Compose service starts only the local MySQL database using the backend's default database settings. It publishes MySQL on host port `3307` by default so it does not conflict with a local MySQL already using `3306`. Override it with `MYSQL_HOST_PORT=3308 docker compose up -d db` if needed, and set `DB_URL` to the matching port when running the backend. Stop it with `docker compose down`; use `docker compose down -v` to also remove its local database data.

Windows PowerShell equivalents:

```powershell
docker compose up -d db
$env:SPRING_PROFILES_ACTIVE = "db"
.\backend\mvnw.cmd -f .\backend\pom.xml spring-boot:run
```

Stop the development command with `Ctrl+C` and rerun it after making backend changes.

Default local URL:

```text
http://localhost:8080
```

Optional Google sign-in requires a Google OAuth client. Add these values to the server-only `data/backend/application.yaml` file or provide the matching Spring environment variables:

```yaml
spring:
  security:
    oauth2:
      client:
        registration:
          google:
            client-id: your-google-client-id
            client-secret: your-google-client-secret
            redirect-uri: http://localhost:5173/login/oauth2/code/google
            scope: openid,email,profile
```

For local Vite testing, add this authorized redirect URI in Google Cloud Console:

```text
http://localhost:5173/login/oauth2/code/google
```

For production, add the same path on your public domain:

```text
https://your-domain.example/login/oauth2/code/google
```

Set `GOOGLE_REDIRECT_URI` to the matching value for the environment if supplying OAuth settings as environment variables.

Health check:

```bash
curl http://localhost:8080/actuator/health
```

## Frontend

Install dependencies:

```bash
cd frontend
nvm use
npm ci
```

Run locally:

```bash
npm run dev
```

Build:

```bash
npm run build
```

See the [frontend guide](frontend/README.md) for architecture, tests and CI checks.

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
- [Custom subscription tier proposal and calculator (deferred)](docs/custom-tier-pricing-proposal.md)
- [Database setup](docs/database.md)
- [Production deployment](docs/production-deployment.md)
- [Changelog](CHANGELOG.md)
- [Backend FPL API notes](backend/docs/fpl-draft-api-notes.md)

## Security

Never commit API keys, FPL cookies, FPL access tokens, refresh tokens, Cloudflare tokens, database passwords, or model-provider secrets.

## Server configuration

The backend optionally imports an external configuration file from `./data/backend/application.yaml`, relative to the process that starts it. Start the local backend from the repository root to use `data/backend/application.yaml`; copy `data/backend/application.yaml.example` as a starting point. Set `BROADCAST_CONFIG_DIRECTORY` when that file is mounted elsewhere (for example, inside a future container).

Keep this server-only file out of Git. Email delivery is enabled only when SMTP settings, `broadcast.email.from`, and `broadcast.email.public-base-url` are configured. Local testing defaults live in `backend/src/main/resources/application-local.yml`; keep the app password in `SMTP_PASSWORD`.

```yaml
spring:
  mail:
    host: smtp.gmail.com
    port: 587
    username: fantasybroadcastapp@gmail.com
    password: ${SMTP_PASSWORD}
    properties:
      mail:
        smtp:
          auth: true
          starttls:
            enable: true

broadcast:
  email:
    enabled: true
    from: fantasybroadcastapp@gmail.com
    public-base-url: http://localhost:5173
```

The same settings can be supplied as environment variables:

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=fantasybroadcastapp@gmail.com
SMTP_PASSWORD=your-gmail-app-password
BROADCAST_EMAIL_FROM=fantasybroadcastapp@gmail.com
BROADCAST_PUBLIC_BASE_URL=http://localhost:5173
```

After signing in as an admin, verify SMTP delivery with:

```bash
curl -X POST http://localhost:5173/api/customer/admin/email/test \
  -H 'Content-Type: application/json' \
  -b 'fantasy_broadcast_session=your-session-cookie-value' \
  -d '{"to":"your-address@example.com"}'
```
