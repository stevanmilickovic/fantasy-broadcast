# FPL Draft Broadcast Service

Live companion and broadcast service for Fantasy Premier League Draft leagues.

The app reads FPL Draft data, builds live league state, detects fantasy events, displays live matchups in a web UI, sends notification-worthy updates, and can generate broadcaster-style commentary for optional text-to-speech narration.

## Repository Layout

```text
backend/   Spring Boot API, FPL integration, live-state logic
frontend/  React/Vite web application
docs/      shared project notes and FPL discovery notes
```

Main product brief:

```text
FPL Draft Broadcast Service.md
```

## Requirements

- Java 21
- Node.js and npm
- Maven wrapper is included in `backend/`

## Backend

Build and test:

```bash
cd backend
./mvnw clean package
```

Run:

```bash
java -jar target/backend-0.0.1-SNAPSHOT.jar
```

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

The service should be built for many registered Draft leagues, not one hardcoded private league.

Core principle:

```text
FPL Draft data
  -> deterministic backend state
  -> deterministic event detection
  -> commentary decision logic
  -> external LLM writes commentary text
  -> frontend displays/narrates it
```

AI should not calculate scores or infer facts. It should only turn verified backend facts into natural-language commentary.

## Documentation

- [Product brief](FPL%20Draft%20Broadcast%20Service.md)
- [FPL discovery notes](docs/fpl-discovery.md)
- [FPL JSON structures](docs/fpl-json-structures.md)
- [Backend FPL API notes](backend/docs/fpl-draft-api-notes.md)

## Security

Never commit API keys, FPL cookies, FPL access tokens, refresh tokens, Cloudflare tokens, database passwords, or model-provider secrets.
