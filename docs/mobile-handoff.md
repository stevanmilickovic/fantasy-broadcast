# Mobile client handoff (current implementation)

This is the starting point for a native mobile client. It describes the implemented service at version 1.5.1. See the [testing handoff](next-version-verification.md). The source of truth is the backend controllers in `backend/src/main/java/com/fantasybroadcast/backend/api/`; the web client's request and response types are in `frontend/src/features/*/api.ts`, feature `types.ts` files and `frontend/src/shared/fpl/types.ts`. Update this guide when changing those contracts. The product architecture and FPL ingestion are described in [Fantasy Broadcast Service](../Fantasy%20Broadcast%20Service.md), [FPL discovery](fpl-discovery.md), and [narration](narration.md).

## What runs where

The Spring Boot backend owns accounts, registered leagues, billing provisioning, FPL polling, score/event calculation, narration, schedules, and live state. Clients call **our** `/api` routes; they need not call FPL directly. The React web app is one client of this service. MySQL stores users, leagues/follows, schedules, narration metadata, and a deduplicated record of broadcast events. Live broadcast sessions and login sessions are held in backend memory; a backend restart requires users to sign in again and broadcasts to be opened again. The Paddle webhook provisions paid leagues. See [database](database.md) and [deployment](production-deployment.md).

There are three different IDs: `RegisteredLeague.id` is our internal league ID and is used in `/api/customer/leagues/{leagueId}`, `/api/live-state?leagueId=`, and stream URLs; `fplLeagueId` identifies the league at FPL; an FPL entry ID identifies a manager's team. `DRAFT` and `CLASSIC` are league source types; Classic scoring can be `H2H` or `TOTAL_POINTS`. Player IDs in the player-details route are numeric FPL element IDs for that league's source, whereas `PlayerView.id` in live state is a string. Do not assume they are interchangeable without checking the mapping.

## Authentication and transport

- Broadcast streams allow 50 simultaneous viewers per registered league on either plan.
  Each open tab/device uses one slot; the administrator's global stream has its own
  50-slot pool. Admission is atomic, and completion, timeout and network errors release
  slots. When full, the SSE endpoint sends a terminal `broadcast-full` event whose data
  is a plain-text message, then closes without sending `live-state`. Clients should
  close EventSource, discard the initial snapshot and offer an explicit retry. Slots
  are held per backend process; a shared registry is required before horizontal scaling.
- Customer, live, and audio routes require our app session unless marked public below. Admin routes also require `ADMIN`. A followed/owned league is required for league-scoped reads; this is checked in the controller/service, not by Spring's global URL matcher.
- Email/password login and registration verification set an HTTP-only `fantasy_broadcast_session` cookie. It has `Path=/api`, `SameSite=Strict`, a seven-day maximum age, and `Secure` in production. Send the cookie on subsequent REST, SSE, and audio requests. The token is not returned in JSON. Sessions are stored in backend memory, so app restart or backend restart can invalidate them. `GET /api/auth/me` is the session check; `401` means sign-in is required. See [AuthController](../backend/src/main/java/com/fantasybroadcast/backend/api/AuthController.java), [SessionService](../backend/src/main/java/com/fantasybroadcast/backend/customer/SessionService.java), and [WebSecurityConfig](../backend/src/main/java/com/fantasybroadcast/backend/security/WebSecurityConfig.java).
- Google sign-in, when configured, uses the backend OAuth browser redirect flow and then sets the same cookie. `GET /api/auth/options` reports whether it is available. A native deep-link/auth flow has **not** been designed; do not assume a native Google token can be exchanged with this API.
- JSON requests use `Content-Type: application/json`. Timestamps are ISO-8601 UTC strings. The API has no published OpenAPI schema yet. `ResponseStatusException` errors are generally `{ "message": "..." }`; FPL upstream failures are `502` with `{ "message", "upstreamStatusCode", "upstreamUrl", "bodyPreview" }`. Framework validation errors may have a different body; use the HTTP status as the primary signal.
- The web frontend calls same-origin `/api` paths. A native client needs the deployed HTTPS base URL and a cookie-capable HTTP client. The backend's browser CORS setting is not a native-client authentication mechanism.

## Client journey

1. Call `GET /api/auth/options`, then sign in with `POST /api/auth/login`, or register with `POST /api/auth/register` and complete the emailed code with `POST /api/auth/register/verify`. Keep the cookie; confirm the session with `GET /api/auth/me` on app launch.
2. Call `GET /api/customer/leagues` for followed/owned leagues and `GET /api/customer/broadcast-schedules/active` for the current broadcast window. A league must be accessible to this user. `GET /api/customer/league-registration` reports whether this account may register another league. Searching and following an already registered league use `/leagues/search` and `/leagues/{leagueId}/follow`.
3. League views use `GET /api/customer/leagues/{leagueId}/overview` for Classic or `/draft-overview` for Draft. These are discovery/overview responses, distinct from the normalized live broadcast state. `GET /api/customer/fpl/shirts` supplies shirt codes. Player detail uses `/players/{playerId}?gameweek={gameweek}`.
4. During an active schedule, `POST /api/customer/leagues/{leagueId}/broadcast/open` starts or joins the in-memory broadcast session and returns the first `LiveStateResponse`. It can return `403` outside a broadcast window. Use the **internal** league ID here.
5. Read `GET /api/live-state?leagueId={leagueId}` for a snapshot and connect to `GET /api/live-state/stream?leagueId={leagueId}` for updates. The stream is `text/event-stream`; each named `live-state` event contains a complete JSON `LiveStateResponse`, not a delta. The server sends an initial state on connection. Reconnect after network loss, refresh the snapshot as needed, and close the stream when leaving the broadcast. A mobile client should handle authentication failure on reconnect. There is no documented event replay cursor or missed-event API; fetching current state restores the latest state, not every transient event.
6. When `commentary[].audioUrl` is present, fetch it using the same session cookie. Audio is temporary and league-protected; `404`, `410`, or `204` can mean it is unavailable. See [narration](narration.md).

## Production API map

`Public` means no app session. `User` means a signed-in customer; league-scoped routes additionally check access. `Admin` means the app administrator. Paths and return types below come from the controllers and the matching [web client API](../frontend/src/features/leagues/api.ts).

### Account

| Method/path | Access | Request → result |
| --- | --- | --- |
| `GET /api/auth/options` | Public | `{ googleSignInEnabled: boolean }` |
| `POST /api/auth/register` | Public | `{ email, password }` → `{ email, message }`; begins email verification |
| `POST /api/auth/register/verify` | Public | `{ email, code }` → `{ user }` and session cookie |
| `POST /api/auth/login` | Public | `{ email, password }` → `{ user }` and session cookie |
| `POST /api/auth/password/forgot` | Public | `{ email }` → `{ message }` |
| `POST /api/auth/password/reset` | Public | `{ token, password }` → empty response |
| `GET /api/auth/password/capability` | User | `{ hasPassword }`, read from the current database account |
| `POST /api/auth/password/change` | User | `{ currentPassword, password }` → empty response; clears cookie and all account sessions |
| `GET /api/auth/me` | User | `{ id, email, displayName, role }`; `role` is `USER` or `ADMIN` |
| `POST /api/auth/logout` | Public (idempotent) | Empty response; clears the cookie and current in-memory session if present |
| `POST /api/auth/account-deletion-request` | User | `{ message }`; requests deletion, not immediate deletion |

New passwords are 12–200 characters. Existing accounts may still log in with shorter previously configured passwords. Forgot/reset/change requests require a trusted browser `Origin`; a future native client must explicitly design its transport with this policy rather than omit the header. Changes require the current password. Change/reset revoke all account sessions and outstanding reset links; reset links expire and are single-use. Forgot responses remain generic, including Google-only accounts, which manage passwords at Google and cannot set a local password through recovery. Attempt limits and recovery queue limits are described in [password security](password-security.md). Google OAuth is a browser redirect flow rather than one of the JSON routes above. Account deletion is a separate request/review flow, reached from web account settings.

Display names are unique under the backend's canonical Unicode/case normalization. New default names receive available suffixes; manual conflicts return `409`. Only own-account authentication responses contain the user's email. Chat and membership DTOs identify accounts by user ID and display name; clients must not expect email fields for other users. Upstream-shaped league data is allowlisted before reaching customer responses.

### Leagues, discovery, and billing

| Method/path | Access | Request → result |
| --- | --- | --- |
| `GET /api/customer/leagues` | User | `RegisteredLeague[]` accessible to the user |
| `GET /api/customer/league-registration` | User | `{ canRegisterLeague }` |
| `GET /api/customer/leagues/search?query=&page=&size=` | User | Page `{ items, page, size, totalItems }` matching already registered leagues |
| `POST /api/customer/leagues/{leagueId}/follow` | User | `{ league, status }`; status `APPROVED` or private-league `PENDING` |
| `DELETE /api/customer/leagues/{leagueId}/follow` | User | Removes own follow/chat access; private access requires a fresh approved request |
| `DELETE /api/customer/leagues/{leagueId}` | Owner | Deletes an owned registration; empty response |
| `GET /api/customer/league-payment/preview?fplLeagueId=&leagueType=` | User | `{ displayName, managerCount, registrationEligible, validationMessage, checkoutReady }` |
| `POST /api/customer/league-payment/checkout` | User | `{ fplLeagueId, leagueType, plan }` → Paddle checkout configuration; `plan` is `STANDARD` or `AI_BROADCASTER` |
| `POST /api/customer/leagues` | Eligible user | `{ fplLeagueId, leagueType }` → `RegisteredLeague`; `leagueType` defaults to `DRAFT` if omitted |
| `GET /api/customer/leagues/{leagueId}/overview` | League user | Classic overview: league name/scoring/gameweek, entries, players, entry-event picks, live players, matches |
| `GET /api/customer/leagues/{leagueId}/draft-overview` | League user | Draft overview: gameweek, raw Draft league details and element status, players, entry events, live players |
| `GET /api/customer/leagues/{leagueId}/live` | League user | Fresh manager scores, current matchups and provisional standings; no broadcast opening or paid viewer slot required |
| `GET /api/customer/fpl/shirts` | User | `FplClubShirt[]` |
| `GET /api/customer/leagues/{leagueId}/players/{playerId}?gameweek=` | League user | Player identity, `photoCode`, current-week points/point changes, and previous-week history; `gameweek` is required, 1–38 |

`RegisteredLeague` fields: `id`, `fplLeagueId`, `displayName`, `leagueType`, `scoringType`, `serviceEnabled`, `aiNarrationEnabled`, `voiceNarrationEnabled`, `ownerUserId`. Do not infer ownership from an FPL manager name. Classic overview is only for Classic; Draft overview is only for Draft. See [customer response types](../frontend/src/features/leagues/types.ts), [FPL response types](../frontend/src/shared/fpl/types.ts), and [CustomerLeagueController](../backend/src/main/java/com/fantasybroadcast/backend/api/CustomerLeagueController.java). The Draft overview deliberately includes upstream-shaped JSON, so use the backend response as the contract rather than assuming the Classic shape.

The player-details response is `{ id, name, shortName, club, position, photoCode, gameweek, points, changes, history, fixtureSchedule }`; `points` can be null when unavailable. Each `changes` item is `{ stat, value, points, fixture }` and each `history` item is `{ gameweek, points }`. `photoCode` is an image identifier, not image bytes or a backend image URL. `fixtureSchedule` contains `current`, five upcoming gameweek groups (`gameweek`, `fixtures`), `unscheduled`, `unavailableReason` and `fetchedAt`. Fixtures contain `id`, `gameweek`, `opponent`, `home`, nullable `kickoffTime`, nullable `teamScore`/`opponentScore`, `status` (`SCHEDULED`, `LIVE`, `FINAL`, `TBD`) and nullable `difficulty` (1–5). Preserve doubles and empty blank-week groups; unknown kickoff/difficulty must not be invented. The web display code is in [PlayerDetailsModal](../frontend/src/features/players/PlayerDetailsModal.tsx).

The league `/live` response contains `source`, `gameweek`, `pointsFetchedAt`, `fixturesFetchedAt`, `status` (`UPCOMING`, `LIVE`, `PROVISIONAL`, `FINAL`), `baselineGameweek`, `managerScores` keyed by manager ID, `matchups`, `standings`, `scoresUnavailableReason` and `standingsUnavailableReason`. Matchups identify `firstManagerId`/`secondManagerId` and nullable scores. Draft manager IDs are league-entry IDs; Classic uses entry IDs. Standings derive from a closed historical baseline, not an assumed stale/current official total. Keep the official table as the default and make provisional standings optional. Missing/incomplete source data carries a reason; do not replace it with zero or treat scores as final. The web view polls every ten seconds while visible and retains clearly stale prior data on transient failure; discard data after access denial. Shared source caches use ten-second points and thirty-second fixtures/current metadata. See [FPL discovery](fpl-discovery.md) for scoring and mapping limits.

Private leagues require approval before league-scoped reads. Owners use `PATCH /leagues/{leagueId}/privacy` with `{ privateLeague }`, `GET /leagues/{leagueId}/follow-requests` and `POST /leagues/{leagueId}/follow-requests/{userId}` with `{ approve }` under `/api/customer`. Inaccessible league reads can return `404`. Chat uses `GET`/`POST /api/customer/leagues/{leagueId}/chat`; sending requires `{ body, sendId }`. Reuse a send ID when retrying to avoid duplicate messages. Owned paid-league removal follows the existing billing checks; confirmation in a client does not bypass server-side restrictions.

### Broadcast and audio

For league-only updates, `GET /api/customer/leagues/{leagueId}/live/stream` returns SSE
events `league-live` (the same projection schema as `/live`), `broadcast-stopped` and
`broadcast-error`. It requires ordinary league membership, rechecks access on every
event and never opens a broadcast or consumes its viewer slots. Pause REST polling
while complete broadcast projections arrive; resume the existing cached interval when
the broadcast stops, its projection is incomplete or the connection fails. Keep the
last received data visibly stale on upstream errors. Close the stream when hidden or
leaving and discard data after access denial. Streams have a sixty-second lifetime and
support reconnection. The server caps concurrent league-only streams at 100 per league;
a busy stream can fall back to `/live` without affecting broadcast capacity.

| Method/path | Access | Request → result |
| --- | --- | --- |
| `GET /api/customer/broadcast-schedules/active` | User | `[{ id, startsAt, endsAt }]` for currently active schedules |
| `POST /api/customer/leagues/{leagueId}/broadcast/open` | League user in active schedule | Starts/joins the league session → `LiveStateResponse` |
| `GET /api/live-state?leagueId={leagueId}` | League user | Complete current `LiveStateResponse` |
| `GET /api/live-state/stream?leagueId={leagueId}` | League user | SSE `live-state` events containing complete `LiveStateResponse` JSON |
| `GET /api/broadcast-narrations/{id}/audio` | League user | Temporary `audio/mpeg` file, when available |

Omitting `leagueId` on the live-state routes accesses the global/admin broadcast, **not** the user's selected league; it requires administrator access. Live state fields are `status`, `sequence`, `gameweek`, `matchups`, `teams`, `standings`, `events`, `commentary`, and `voiceNarrationEnabled`. `matchups` contains H2H pairs; `teams` and `standings` also support total-points presentation. `events` and `commentary` are arrays in the current snapshot. Full nested field definitions are in [live response types](../frontend/src/features/broadcast/types.ts) and [backend live records](../backend/src/main/java/com/fantasybroadcast/backend/live/LiveStateResponse.java). Render backend scores and event facts as supplied; do not recalculate league scoring in a client.

The backend polls FPL while a league session is open, detects changes, stages selected events for narration, then publishes the state by SSE. A persisted `broadcast_notification` row records a published event once per league/gameweek/source event. **This is not a device push queue or user inbox.** See [MockLiveStateService](../backend/src/main/java/com/fantasybroadcast/backend/live/MockLiveStateService.java), [BroadcastNotificationRepository](../backend/src/main/java/com/fantasybroadcast/backend/live/BroadcastNotificationRepository.java), and [narration](narration.md).

Each broadcast player now includes `fixtureProgress`: `UPCOMING`, `LIVE`, `BETWEEN`, `COMPLETE`, `BLANK`, `TBD` or `UNKNOWN`. It reflects all club fixtures in that gameweek, independently of points, minutes or injury probability. `BETWEEN` means a completed fixture with another still to play. Keep this metadata with the displayed queued snapshot; do not advance its live marker ahead of displayed scoring. The web implementation fades upcoming shirt artwork while keeping text readable, shows a live marker, and uses a static marker under reduced motion.

### Administrator and provider routes

These are documented for completeness; a normal customer app should not call them.

| Method/path | Purpose |
| --- | --- |
| `GET /api/customer/admin/leagues?page=&size=&search=` | Page of all registered leagues (`items`, `page`, `size`, `totalItems`) |
| `PATCH /api/customer/admin/leagues/{leagueId}` | `{ serviceEnabled, aiNarrationEnabled, voiceNarrationEnabled }` → updated league |
| `GET /api/customer/admin/users?page=&size=&search=` | Page of users; `size` maximum 100 |
| `PATCH /api/customer/admin/users/{userId}/admin` | Promote a user |
| `DELETE /api/customer/admin/users/{userId}` | Delete a user (`204`) |
| `GET /api/customer/admin/broadcast-schedules` | All schedules |
| `POST /api/customer/admin/broadcast-schedules` | `{ startsAt, endsAt }` → schedule |
| `PUT /api/customer/admin/broadcast-schedules/{scheduleId}` | Update schedule with the same body |
| `DELETE /api/customer/admin/broadcast-schedules/{scheduleId}` | Delete schedule |
| `POST /api/customer/admin/broadcast-schedules/generate-today` | Generate today's schedules |
| `POST /api/customer/admin/email/test` | Send a test email using `{ to }` |
| `POST /api/live-broadcast/start?leagueId=&leagueType=` | Admin start of a broadcast; `leagueType` defaults to `DRAFT` |
| `POST /api/paddle/webhook` | Paddle-signed provider webhook; not a client route |

The admin schedule/user routes are defined in [BroadcastScheduleController](../backend/src/main/java/com/fantasybroadcast/backend/api/BroadcastScheduleController.java) and [AdminUserController](../backend/src/main/java/com/fantasybroadcast/backend/api/AdminUserController.java). Development-only admin mock controls (`POST /api/mock-live/start`, `/comprehensive/start`, `/total-points/start`, `/advance`, `/reset`) are additionally gated by a development-endpoint setting. `/api/fpl/discovery/*` and `/api/fpl/mock/*` are exploration tools and are disabled in the production Spring profile; see [FPL discovery](fpl-discovery.md). Do not build a mobile release against any of these tools.

## Not implemented yet for mobile

There is no device registration/token API, APNs/FCM sender, push subscription/preferences API, background notification worker, or mobile-specific auth exchange. The existing broadcast events are **in-app live updates over SSE**. Push trigger rules, targeting, and delivery are future design work; this handoff does not define them. There is also no versioned API schema or guaranteed replay of events missed while offline. Treat those as backend work before promising push or offline notification history in the mobile product.
