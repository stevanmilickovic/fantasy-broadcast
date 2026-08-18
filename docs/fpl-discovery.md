# FPL Discovery

## Current Findings

FPL and FPL Draft APIs are undocumented, so every endpoint should stay behind `FplDraftClient`.

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
- `/api/fpl/discovery/*` exposes temporary read-only endpoints for manual endpoint validation.

The live engine should consume mapped records, not endpoint-specific JSON.

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
