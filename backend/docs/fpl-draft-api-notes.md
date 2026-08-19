# FPL Draft API Notes

These notes capture current findings about the undocumented FPL Draft API. Keep DTOs tolerant and verify payloads against real 2026/27 Gameweek data before making production assumptions rigid.

## Core Endpoints

```text
GET https://draft.premierleague.com/api/bootstrap-static
```

Player metadata. Use `element` / `id` as the shared player key for names, clubs, and positions.

```text
GET https://draft.premierleague.com/api/league/{leagueId}/element-status
```

Draft ownership. Maps player `element` IDs to the league entry that owns them.

```text
GET https://draft.premierleague.com/api/entry/{entryId}/event/{gameweek}
```

Manager Gameweek picks. Each pick includes:

```json
{
  "element": 123,
  "position": 4
}
```

Use:

```text
position <= 11 -> starter
position > 11  -> bench
```

Ownership alone is not enough to know whether a player is contributing to the current Gameweek score.

```text
GET https://draft.premierleague.com/api/event/{gameweek}/live
```

Live Gameweek player stats and point totals. Each `elements[]` item represents one player.

Important fields:

```json
{
  "id": 123,
  "stats": {
    "minutes": 90,
    "goals_scored": 1,
    "assists": 0,
    "clean_sheets": 0,
    "goals_conceded": 1,
    "own_goals": 0,
    "penalties_saved": 0,
    "penalties_missed": 0,
    "yellow_cards": 0,
    "red_cards": 0,
    "saves": 0,
    "bonus": 3,
    "bps": 34,
    "total_points": 9
  },
  "explain": [
    {
      "fixture": 123,
      "stats": [
        {
          "identifier": "goals_scored",
          "points": 5,
          "value": 1
        }
      ]
    }
  ]
}
```

Use `stats.total_points` as the current official player Gameweek score. Do not recreate the FPL scoring system just to get live player totals.

```text
GET https://draft.premierleague.com/api/league/{leagueId}/details
```

League details and H2H matchup totals. Prefer this as the authoritative source for total fantasy matchup score if it updates quickly enough.

## Score Model

Join data by player `element` / `id`:

```text
bootstrap-static
  -> player identity

league/{leagueId}/element-status
  -> player owner

entry/{entryId}/event/{gameweek}
  -> starter or bench

event/{gameweek}/live
  -> live stats and player points

league/{leagueId}/details
  -> official matchup totals
```

Recommended hierarchy:

```text
Official matchup total:
  league details

Individual player explanation:
  entry picks + live player stats
```

This lets the backend say both:

```text
Stevan 43 - 39 Luka
```

and:

```text
Salah scored, moving from 2 to 7 points for Stevan.
```

## Event Detection

Detect events by comparing previous and current live player stats, not just `total_points`.

Example:

```text
Previous poll:
goals_scored = 0
total_points = 2

Current poll:
goals_scored = 1
total_points = 7
```

Derived event:

```json
{
  "type": "GOAL",
  "playerId": 123,
  "playerName": "Mohamed Salah",
  "managerName": "Stevan",
  "starter": true,
  "pointsBefore": 2,
  "pointsAfter": 7,
  "pointsDelta": 5,
  "matchupScore": "43-39"
}
```

The commentary layer should receive derived events like this. It should not infer factual scoring events directly from raw API payloads.

## Bonus Points

`stats.bonus` may be provisional while fixtures are live. `stats.bps` exposes the Bonus Points System score.

Treat bonus changes as normal live-state updates. Avoid presenting them as final until the fixture or Gameweek settles.

## Autosubs

Positions `1-11` are the original starting XI. FPL Draft automatic substitutions can change the final contributing XI when starters do not play.

For MVP:

```text
Use league details for official total score.
Use picks + live player data to explain likely individual causes.
```

This avoids needing to perfectly reproduce every autosub edge case before the broadcast works.

## Watchlist Endpoint

Observed authenticated write endpoint:

```text
POST https://draft.premierleague.com/api/watchlist/{entryId}
```

Observed response:

```json
[
  {
    "element": 411,
    "priority": 1
  }
]
```

Likely request body:

```json
{
  "element": 411,
  "priority": 1
}
```

This endpoint requires authenticated Premier League/Draft session headers and cookies. Do not store copied browser cookies, `access_token`, `refresh_token`, Cloudflare tokens, or `x-api-authorization` values in the repo.

Product recommendation: keep app-specific watchlists in our own database unless there is a strong requirement to mutate the user's real Draft FPL watchlist.

## Remaining Verification

Verify during a real current-season live Gameweek:

```text
1. Exact 2026/27 payload shape for each endpoint.
2. Whether league details matchup scores update fast enough for live broadcast.
3. Autosub fields and final contributing-player behavior.
4. Double Gameweek behavior in event live `explain[]`.
5. Postponed, unstarted, finished, and abandoned fixture states.
6. Bench ordering for positions 12-15.
7. Practical polling limits and Cloudflare/session behavior.
```
