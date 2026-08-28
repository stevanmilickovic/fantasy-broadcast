# FPL JSON Structures

This file records observed FPL/FPL Draft response shapes so future logic can be based on evidence instead of guesses.

Do not store private cookies, auth headers, passwords, or tokens here. Prefer anonymized or public examples where possible.

## Draft League Details - Mapped Structure

Observed from backend discovery endpoint:

```text
GET /api/fpl/discovery/league/{leagueId}
```

This is the mapped internal response produced from:

```text
GET https://draft.premierleague.com/api/league/{leagueId}/details
```

### Situation

- Draft league has entries.
- H2H fixtures have been generated for all 38 events/gameweeks.
- No points have been scored yet.
- Standings exist but all ranks/points are zero.
- Team rosters/player ownership are not present in this mapped structure.

### Top-Level Shape

```json
{
  "entries": [],
  "matches": [],
  "standings": []
}
```

### `entries[]`

Represents Draft league teams/managers.

Observed fields:

```json
{
  "leagueEntryId": 1,
  "entryId": 1,
  "entryName": "Tizzy FC",
  "playerName": "Jake Thomas"
}
```

Field notes:

| Field | Meaning | Notes |
| --- | --- | --- |
| `leagueEntryId` | Draft league-specific team id | Used by matches and standings. |
| `entryId` | FPL/Draft entry id | Often same as `leagueEntryId`, but not always. |
| `entryName` | Fantasy club/team name | Display name for frontend. |
| `playerName` | Manager/player real name | May need manual override/nickname later. |

Observed example:

```json
[
  {
    "leagueEntryId": 1,
    "entryId": 1,
    "entryName": "Tizzy FC",
    "playerName": "Jake Thomas"
  },
  {
    "leagueEntryId": 1964,
    "entryId": 1963,
    "entryName": "AC FC",
    "playerName": "Archie Clarke"
  }
]
```

Important observation:

`leagueEntryId` and `entryId` can differ, so matchup/standings logic should key Draft league membership by `leagueEntryId`, not `entryId`.

### `matches[]`

Represents H2H fixtures by event/gameweek.

Observed fields:

```json
{
  "id": 0,
  "event": 1,
  "firstLeagueEntryId": 280,
  "secondLeagueEntryId": 1,
  "firstPoints": 0,
  "secondPoints": 0,
  "finished": false
}
```

Field notes:

| Field | Meaning | Notes |
| --- | --- | --- |
| `id` | Match id | Observed as `0` before fixtures are played. Do not rely on it yet. |
| `event` | FPL gameweek/event number | Use this to select current matchup. |
| `firstLeagueEntryId` | First Draft team in fixture | References `entries[].leagueEntryId`. |
| `secondLeagueEntryId` | Second Draft team in fixture | References `entries[].leagueEntryId`. |
| `firstPoints` | Current/final points for first team | Observed `0` pre-season. |
| `secondPoints` | Current/final points for second team | Observed `0` pre-season. |
| `finished` | Whether matchup is finished | Observed `false` pre-season. |

Observed example:

```json
[
  {
    "id": 0,
    "event": 1,
    "firstLeagueEntryId": 280,
    "secondLeagueEntryId": 1,
    "firstPoints": 0,
    "secondPoints": 0,
    "finished": false
  },
  {
    "id": 0,
    "event": 2,
    "firstLeagueEntryId": 1,
    "secondLeagueEntryId": 25,
    "firstPoints": 0,
    "secondPoints": 0,
    "finished": false
  }
]
```

Important observations:

- Fixtures for all 38 events can be available before the season starts.
- A 14-team league has 7 matches per event.
- Match ids may not be meaningful before scoring starts.
- Matchup display can be built from `matches[]` plus `entries[]`.

### `standings[]`

Represents Draft H2H league table rows.

Observed fields:

```json
{
  "leagueEntryId": 1,
  "rank": 0,
  "headToHeadPoints": 0,
  "pointsFor": 0
}
```

Field notes:

| Field | Meaning | Notes |
| --- | --- | --- |
| `leagueEntryId` | Draft team id | References `entries[].leagueEntryId`. |
| `rank` | League-table rank | Observed `0` before scoring. |
| `headToHeadPoints` | H2H table points | Likely 3 win, 1 draw, 0 loss. |
| `pointsFor` | Total fantasy points scored | Observed `0` before scoring. |

Observed example:

```json
[
  {
    "leagueEntryId": 1,
    "rank": 0,
    "headToHeadPoints": 0,
    "pointsFor": 0
  },
  {
    "leagueEntryId": 25,
    "rank": 0,
    "headToHeadPoints": 0,
    "pointsFor": 0
  }
]
```

Important observations:

- Standings exist before scoring, but ranks may be `0`.
- We should not assume `rank` is meaningful until after the first completed or live gameweek.
- League table display should tolerate all-zero standings.

### Logic Implications

From this structure alone, we can build:

- manager/team list;
- scheduled H2H matchups by gameweek;
- empty/pre-season league table;
- matchup shells before player ownership is known.

From this structure alone, we cannot build:

- player ownership;
- active XI;
- bench;
- player-level points;
- waiver history;
- transfer history;
- captaincy-like data, if Draft exposes any equivalent.

### Next Structures To Capture

- Raw `league/{leagueId}/details` response, not only mapped response.
- Draft choices/ownership response after draft completes.
- Gameweek lineup response, including active players and bench.
- Live player points response with `explain` point breakdown.
- Transactions/waivers response.
- League details during a live gameweek, to verify whether `firstPoints` and `secondPoints` update live.

## Draft League Details - Raw Structure

Observed from backend discovery endpoint:

```text
GET /api/fpl/discovery/league/49824/raw
```

Source endpoint:

```text
GET https://draft.premierleague.com/api/league/49824/details
```

### Situation

- Current Fantasy Broadcast league.
- Draft has not started.
- Draft is scheduled for `2026-08-19T18:00:00Z`.
- League has 4 joined entries at capture time.
- No matches or standings yet.

### Top-Level Shape

```json
{
  "league": {},
  "league_entries": [],
  "matches": [],
  "standings": []
}
```

### `league`

Observed fields:

```json
{
  "admin_entry": 261672,
  "closed": false,
  "draft_dt": "2026-08-19T18:00:00Z",
  "draft_pick_time_limit": 60,
  "draft_status": "pre",
  "draft_tz_show": "Europe/Podgorica",
  "id": 49824,
  "ko_rounds": 0,
  "make_code_public": false,
  "max_entries": 16,
  "min_entries": 8,
  "name": "Fantasy Broadcast",
  "scoring": "h",
  "start_event": 1,
  "stop_event": 38,
  "trades": "y",
  "transaction_mode": "not-drafted",
  "variety": "x",
  "drafts": [
    {
      "id": 53000,
      "draft_started": false,
      "draft_completed": null,
      "draft_dt": "2026-08-19T18:00:00Z",
      "event": 1,
      "league": 49824,
      "order_method": "random"
    }
  ],
  "is_renewed": false
}
```

Important observations:

- `league.id` is the league id: `49824`.
- `league.drafts[0].id` is the draft id: `53000`.
- Draft choices should be tested with `/api/fpl/discovery/draft/53000/choices/raw`, not only league id.
- `draft_status: "pre"` means the draft has not started.
- `transaction_mode: "not-drafted"` explains the empty transactions response.
- `scoring: "h"` appears to mean head-to-head scoring.
- `trades: "y"` means trades are enabled.

### `league_entries[]`

Raw fields:

```json
{
  "entry_id": 261672,
  "entry_name": "FK Kurac Savnik",
  "id": 263937,
  "joined_time": "2026-08-17T15:33:00.708768Z",
  "player_first_name": "Stevan",
  "player_last_name": "Milickovic",
  "short_name": "SM",
  "waiver_pick": null
}
```

Important observations:

- Raw `id` maps to our `leagueEntryId`.
- Raw `entry_id` maps to our `entryId`.
- `waiver_pick` is `null` before draft/waiver order is established.

## Element Status - Raw Structure

Observed from backend discovery endpoint:

```text
GET /api/fpl/discovery/league/49824/element-status/raw
```

Source endpoint:

```text
GET https://draft.premierleague.com/api/league/49824/element-status
```

### Situation

- Current Fantasy Broadcast league before draft.
- Players are not owned yet.

### Top-Level Shape

```json
{
  "element_status": []
}
```

### `element_status[]`

Observed fields:

```json
{
  "element": 229,
  "in_accepted_trade": false,
  "owner": null,
  "status": "a"
}
```

Field notes:

| Field | Meaning | Notes |
| --- | --- | --- |
| `element` | FPL player id | Joins to `bootstrap-static.elements[].id`. |
| `in_accepted_trade` | Trade marker | Observed `false` pre-draft. |
| `owner` | Owning Draft entry/team id | Observed `null` before draft. |
| `status` | Draft availability/status | Observed `"a"` before draft. Likely available. |

Important observations:

- This endpoint is currently the best candidate for ownership after the draft.
- After the draft, expect `owner` to become non-null for drafted players.
- We still need to confirm whether `owner` maps to raw `entry_id` or raw league entry `id`.

## Draft League Transactions - Raw Structure

Observed from backend discovery endpoint:

```text
GET /api/fpl/discovery/league/49824/transactions/raw
```

Source endpoint:

```text
GET https://draft.premierleague.com/api/draft/league/49824/transactions
```

### Situation

- Current Fantasy Broadcast league before draft.

### Top-Level Shape

```json
{
  "transactions": []
}
```

Important observations:

- Empty response is expected before draft and before waivers/free agency.
- This endpoint exists and does not appear to require auth for this league.

## Draft Choices - Raw Structure Before Draft

Observed from backend discovery endpoint:

```text
GET /api/fpl/discovery/draft/49824/choices/raw
```

Source endpoint:

```text
GET https://draft.premierleague.com/api/draft/49824/choices
```

### Situation

- Tested with league id as a guessed draft id.
- Current Fantasy Broadcast league before draft.

### Top-Level Shape

```json
{
  "choices": [],
  "idle": [],
  "element_status": []
}
```

Important observations:

- The endpoint exists.
- `choices` is empty before draft.
- `idle` is empty before draft.
- `element_status` appears here too.
- Since raw league details shows actual draft id `53000`, retest with:

```text
GET /api/fpl/discovery/draft/53000/choices/raw
```

After draft starts/completes, this endpoint may expose draft selections, order, and ownership history.

## Entry Event - Raw Structure

Observed from backend discovery endpoint:

```text
GET /api/fpl/discovery/entry/261672/event/1/raw
```

Current result:

```text
500 from local backend wrapper
```

Important observations:

- The backend currently hides the upstream FPL status behind a generic 500 error page.
- We need to improve discovery error responses so they report upstream status codes such as `404`, `403`, or auth failures.
- This endpoint may not exist before the gameweek starts, may require a different id, or may require auth.

## Fantasy Event Live - Raw Structure Before Kickoff

Observed from backend discovery endpoint:

```text
GET /api/fpl/discovery/event/1/live/raw
```

Source endpoint:

```text
GET https://fantasy.premierleague.com/api/event/1/live/
```

### Situation

- Event/gameweek 1 has not started.

### Top-Level Shape

```json
{
  "elements": []
}
```

Important observations:

- The regular Fantasy endpoint exists but returns no player live elements before event 1 starts.
- During/after matches, this endpoint is still expected to become useful for player point totals and point breakdowns.

## Draft Event Live - Raw Structure Before Kickoff

Observed from backend discovery endpoint:

```text
GET /api/fpl/discovery/draft/event/1/live/raw
```

Source endpoint:

```text
GET https://draft.premierleague.com/api/event/1/live
```

### Situation

- Event/gameweek 1 has not started.
- Premier League fixtures for the gameweek are already available.
- Player live elements are empty pre-match.

### Top-Level Shape

```json
{
  "elements": {},
  "fixtures": []
}
```

### `fixtures[]`

Observed fields:

```json
{
  "id": 1,
  "started": false,
  "stats": [],
  "code": 2645195,
  "finished": false,
  "finished_provisional": false,
  "kickoff_time": "2026-08-21T19:00:00Z",
  "minutes": 0,
  "provisional_start_time": false,
  "team_a_score": null,
  "team_h_score": null,
  "pulse_id": 0,
  "event": 1,
  "team_a": 7,
  "team_h": 1
}
```

Field notes:

| Field | Meaning | Notes |
| --- | --- | --- |
| `id` | Fixture id | FPL fixture id. |
| `started` | Whether PL fixture has started | `false` pre-kickoff. |
| `stats` | Fixture stats/events | Empty pre-kickoff. May contain goals/cards/assists later. |
| `code` | External fixture code | Stable PL fixture code. |
| `finished` | Final fixture completion | `false` pre-kickoff. |
| `finished_provisional` | Provisional completion | `false` pre-kickoff. |
| `kickoff_time` | Fixture kickoff time | UTC timestamp. |
| `minutes` | Match minute | `0` pre-kickoff. |
| `team_a_score` | Away team goals | `null` pre-kickoff. |
| `team_h_score` | Home team goals | `null` pre-kickoff. |
| `event` | Gameweek/event id | `1` in observed sample. |
| `team_a` | Away PL team id | Joins to bootstrap teams. |
| `team_h` | Home PL team id | Joins to bootstrap teams. |

Important observations:

- Draft live endpoint is useful for matchday scheduling/fixture display before the gameweek starts.
- `elements` is an object here, not an array as in the regular Fantasy endpoint.
- Need to capture this endpoint again during live play to see player element and fixture stat shapes.
