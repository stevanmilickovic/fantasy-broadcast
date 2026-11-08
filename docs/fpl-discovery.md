# FPL Discovery

## Current Findings

FPL and FPL Draft APIs are undocumented, so every endpoint should stay behind `FplDraftClient` and be normalized for the shared broadcast pipeline.

Known public endpoints to start with:

- `https://draft.premierleague.com/api/bootstrap-static`
- `https://draft.premierleague.com/api/league/{leagueId}/details`
- `https://draft.premierleague.com/api/league/{leagueId}/element-status`
- `https://draft.premierleague.com/api/draft/league/{leagueId}/transactions`
- `https://draft.premierleague.com/api/draft/{draftId}/choices`
- `https://draft.premierleague.com/api/entry/{entryId}/event/{eventId}`
- `https://draft.premierleague.com/api/event/{eventId}/live`
- `https://fantasy.premierleague.com/api/event/{eventId}/live/`
- `https://fantasy.premierleague.com/api/fixtures/?event={eventId}`
- `https://fantasy.premierleague.com/api/event-status/`

`league/{leagueId}/details` is the key Draft endpoint for private league structure. Public examples show it containing:

- `league_entries`
- `matches`
- `standings`

The regular FPL live endpoint provides player points and stat categories. Draft ownership and H2H context come from Draft endpoints.

## Classic FPL Head-to-Head Recording

Regular FPL head-to-head leagues use the Fantasy API rather than the Draft API:

- `GET https://fantasy.premierleague.com/api/leagues-h2h/{leagueId}/standings/?page_new_entries=1&page_standings=1`
- `GET https://fantasy.premierleague.com/api/leagues-h2h-matches/league/{leagueId}/?event={eventId}`

The match endpoint's `results` entries contain `entry_1_entry`, `entry_2_entry`, and FPL's recorded totals
`entry_1_points` and `entry_2_points`. It also supplies match metadata such as `id`, `event`, `winner`, and
`is_knockout`; it does not supply a `finished` field. The broadcast calculates live scores from entry picks and the
event-live endpoint because the recorded matchup totals can lag behind ongoing matches.
- `GET https://fantasy.premierleague.com/api/entry/{entryId}/event/{eventId}/picks/`

Administrators can start a head-to-head recording through `POST /api/live-broadcast/start?leagueId={leagueId}&leagueType=CLASSIC`. In normal product use, an authenticated customer opens a registered league during an active broadcast schedule through `POST /api/customer/leagues/{leagueId}/broadcast/open`.
Both flows emit the same `LiveStateResponse` and player-point notifications as a Draft recording; league-specific API data is normalized before it reaches the live pipeline. Classic overall-scoring broadcasts use the same general broadcast service, with a standings-focused presentation when there are no head-to-head fixtures.

## Unknowns To Validate With Our League

- Whether our private Draft league details endpoint is readable without cookies.
- Which endpoint exposes current Draft squads after the draft has completed.
- Whether lineup/bench selection is present in Draft-specific endpoints or must be inferred from entry event picks.
- Whether transactions/waivers need authentication.
- Whether `draft/{draftId}/choices` is still active in the current 2026/27 Draft app.
- Whether live Draft H2H points in `league/{leagueId}/details` update fast enough during matches.

## Auth Rule

Do not add credentials until a specific endpoint proves it requires them.

If auth is needed, use an environment variable or excluded local config for the session cookie. Never commit FPL cookies, passwords, or tokens.

## Current Backend Shape

- `FplDraftClient` performs raw HTTP calls.
- `FplDraftMapper` converts raw JSON into internal records.
- `src/test/resources/fpl/*.sample.json` contains minimal sample responses for mapper tests.
- `/api/fpl/discovery/*` exposes temporary read-only endpoints for manual endpoint validation. These endpoints are available only outside the `production` Spring profile and are not part of the customer-facing API.

The live engine should consume mapped records, not endpoint-specific JSON.

## Shared caching and broadcast polling

Successful FPL responses are cached by URL for one hour by default
(`FPL_CACHE_TTL_SECONDS=3600`), including individual player summaries and closed historical
matchups. Current points use ten seconds; current fixtures, bootstrap metadata, league
composition, lineups and entry history use thirty seconds. Static bootstrap accessors
retain their hourly cache policy. Reading a league or opening another player dialog
reuses those responses until they expire; cache expiry itself does not start a request.
Concurrent readers of the same URL share one upstream request and receive independent
JSON copies. Failed requests share a ten-second retry window so concurrent callers
cannot overwhelm FPL or leave a temporary failure cached for an hour.

Active customer broadcasts use one shared polling task. Each cycle maps one player
snapshot per league source and gameweek and applies it to every eligible league of
that type, regardless of H2H or total-points scoring. The broadcast-specific Draft and
Classic live reads permit refreshes every ten seconds in the same HTTP cache used by
ordinary pages. Pages can therefore reuse broadcast-fresh values without triggering
another request. The admin broadcast path also uses this shared cache. Polling waits
ten seconds between completed cycles and stops when the customer sessions are stopped;
new viewers join existing sessions rather than creating new upstream pollers.

League composition is refreshed every thirty seconds during a long-running broadcast. A change of
gameweek resets the point-change baseline, preventing the new week's totals from being
interpreted as negative corrections to the old week. Narration retains its independent
per-league publication gate.

Draft live responses include fixture status. Classic fixtures share the thirty-second
fixture cache. Initial loading still requires each league's
own metadata and lineups; only the recurring player feeds are shared across leagues.

Caches and broadcast sessions belong to the running backend process and reset on restart.

League views can subscribe to `/api/customer/leagues/{id}/live/stream`. Active broadcasts
publish their already-calculated league scores and standings through this separate,
membership-protected feed; subscribers do not open broadcasts or consume viewer slots.
The ordinary `/live` endpoint also reuses a complete active snapshot. Unsupported or
incomplete broadcast snapshots fall back to the independent cached league calculation.
Without a broadcast, the browser retains its visible-page ten-second polling interval.

## Manual Checks

With the backend running:

```bash
curl http://localhost:8080/api/fpl/discovery/players?limit=5
curl http://localhost:8080/api/fpl/discovery/event/1/live?limit=5
curl http://localhost:8080/api/fpl/discovery/league/YOUR_LEAGUE_ID
curl http://localhost:8080/api/fpl/discovery/league/YOUR_LEAGUE_ID/raw
curl http://localhost:8080/api/fpl/discovery/league/YOUR_LEAGUE_ID/element-status/raw
curl http://localhost:8080/api/fpl/discovery/league/YOUR_LEAGUE_ID/transactions/raw
curl http://localhost:8080/api/fpl/discovery/entry/YOUR_ENTRY_ID/event/1/raw
curl http://localhost:8080/api/fpl/discovery/draft/YOUR_DRAFT_ID/choices/raw
curl http://localhost:8080/api/fpl/discovery/event/1/live/raw
curl http://localhost:8080/api/fpl/discovery/draft/event/1/live/raw
```

If the league endpoint returns `401`, `403`, or a login-shaped response, we need to add optional cookie-based auth outside source control.
