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
