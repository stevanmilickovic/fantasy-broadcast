# Shared FPL data

`FplDraftClient` coalesces concurrent requests per exact upstream URL and returns
defensive JSON copies. Live player points use a ten-second TTL for league pages,
player details and broadcasts. Fixtures, lineups, league composition and current
gameweek metadata refresh on demand after thirty seconds. Static bootstrap readers,
player history, draft choices and transactions retain the configured hourly cache;
the current-metadata readers refresh the same bootstrap entry for rollover and
availability. Failed requests share a ten-second retry window and never present
expired points as freshly fetched data.

`FplGameweekData` is an on-demand normalized source boundary. It returns source,
gameweek, points/fixture fetch times and completeness. Fetch time is when the server
received a successful source response, not a claim about FPL's internal update time.
Empty/malformed player feeds remain incomplete, distinct from received zero points.
Nothing starts an upstream poll, broadcast, narration job or viewer allocation.
Frontend visibility-controlled demand is responsible for stopping refreshes.

Fixtures preserve nullable scores, kickoff and side-specific difficulty (1–5).
Unassigned gameweeks retain the existing event `0` representation and must be
displayed as TBD. Double fixtures keep distinct fixture IDs. Draft player IDs remain
Draft IDs, player season metadata maps by verified player code, and normalized club
IDs map Draft-to-Classic by club code. Unknown mappings use club ID `0` and must not
be treated as a numeric-ID match. Broadcast source fixtures retain their own source
identities until normalized for presentation.

The sanitized `current-fixtures-mapping.sample.json` records official public football
metadata, source URLs and capture time. It demonstrates different Draft/Classic IDs
for the same player code. Cache tests use a controlled clock and local HTTP server;
projection tests must use recorded/synthetic gameweeks for corrections and DGWs.
The FPL API is undocumented; fixtures and scoring remain provisional until reconciled.

## Shared scoring and standings

`LiveScoring` owns manager points, resolved lineups and standings arithmetic for real
broadcasts and league overviews. Classic includes captain/vice, Triple Captain, Bench
Boost and transfer deductions; Draft ignores Classic captain multipliers and chips.
Missing picked players/points fail explicitly. Additional substitutions and captain
fallback wait until all current-week fixtures are complete, including every DGW match.
Recorded substitutions are not applied twice. Cards count as an appearance even with
zero recorded minutes. Keeper/formation constraints and bench priority remain enforced.

`FplStandingsBaseline` reconstructs a baseline through exactly the previous gameweek.
It uses received manager-history totals and closed H2H schedules, never guesses whether
an official live table has already counted this week. Current points are added once to
that baseline; corrections replace values instead of accumulating deltas. History
refreshes every thirty seconds; historical H2H schedules share the hourly cache. Custom
league start rounds use phase history and the Classic phase-start transfer exemption.
Classic points ties use transfer counts when available, excluding Wildcard/Free Hit;
otherwise equal totals share rank. H2H ties use cumulative fantasy points.

Missing start rounds, unsettled prior weeks, partial histories/schedules and knockout
tables leave live standings unavailable with a reason. Broadcasts preserve the official
table in that case. Average/bye opponents require a received schedule and known score;
no opponent or population average is invented.

Rules checked against the official [FPL rules](https://www.premierleague.com/en/news/4661029)
and [league scoring overview](https://www.premierleague.com/en/news/2174934/fpl-basics-leagues-and-cups).
API field contracts are supported by sanitized source fixtures; a live gameweek and
official reconciliation remain integration checks in addition to deterministic tests.
