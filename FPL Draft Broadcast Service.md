# FPL Draft Broadcast Service

## Purpose

The product is a live companion and broadcast service for any Fantasy Premier League Draft league.

League members register their Draft league, connect or select their fantasy team, and use a live website during Premier League matchdays. The service reads FPL Draft data, shows live fantasy matchups, detects important point swings, sends notifications, and generates broadcaster-style commentary.

The app should work for a specific private league, but it should not be built as if there is only one hardcoded league. The target shape is multi-league from the start.

## Product Experience

On matchdays, users can open a website and watch their Draft league as a live sports broadcast dashboard.

The live page should show:

- current Gameweek;
- league matchups;
- live head-to-head scores;
- players currently affecting each matchup;
- goals, assists, cards, clean-sheet swings, bonus changes, and other point events;
- recent fantasy events;
- generated text commentary;
- optional browser-based text-to-speech narration;
- notification-relevant events for followed teams or players.

The intended feel is a fantasy football broadcast, not a raw stats table.

Example commentary:

```text
Salah has scored, giving Stevan another five points and moving him ahead of Luka.
That one goal has completely changed the shape of this matchup.
```

## Service Scope

The app should support many registered Draft leagues.

Each registered league has:

- FPL Draft league ID;
- league display name;
- season;
- list of league entries/managers from FPL Draft;
- app users who follow one or more league entries;
- optional league-specific commentary context;
- optional notification settings.

Each user can:

- register a profile;
- join or follow a registered Draft league;
- select their own fantasy team/league entry;
- receive notifications for their team or selected players;
- open the live broadcast page on matchdays.

The app should avoid mutating users' real FPL Draft accounts unless there is a strong product reason. App-specific watchlists and notification preferences should live in our database.

## Core Architecture

```text
FPL Draft API
    |
    v
Spring Boot Backend
    |
    +--> FPL Draft integration
    +--> league registry
    +--> live state engine
    +--> event detector
    +--> notification service
    +--> commentary director
    +--> LLM provider adapter
    +--> REST/SSE/WebSocket API
    |
    v
React Frontend
    |
    +--> live dashboard
    +--> commentary feed
    +--> optional browser TTS
```

The backend owns factual truth. The frontend presents state and may narrate generated commentary locally.

## Accuracy Rule

AI must not calculate scores, infer ownership, decide whether a goal happened, or maintain league state.

Normal backend code must:

- read FPL data;
- join player, ownership, lineup, and live-score data;
- detect factual events;
- calculate or accept official matchup totals;
- produce structured commentary facts.

The AI only turns structured facts into natural language.

## FPL Draft Data Model

The FPL Draft API is undocumented. Keep all endpoint access behind an integration layer.

Known useful endpoints:

```text
GET https://draft.premierleague.com/api/bootstrap-static
GET https://draft.premierleague.com/api/league/{leagueId}/details
GET https://draft.premierleague.com/api/league/{leagueId}/element-status
GET https://draft.premierleague.com/api/entry/{entryId}/event/{gameweek}
GET https://draft.premierleague.com/api/event/{gameweek}/live
```

Data relationship:

```text
bootstrap-static
  -> player identity

league/{leagueId}/element-status
  -> player ownership

entry/{entryId}/event/{gameweek}
  -> starting XI / bench

event/{gameweek}/live
  -> live player stats and total_points

league/{leagueId}/details
  -> official H2H matchup scores
```

Use player `element` / `id` as the joining key across FPL data sources.

## Live Scoring Approach

For total matchup score, prefer the official values exposed by:

```text
/api/league/{leagueId}/details
```

if they update quickly enough during live play.

For individual explanations and commentary, combine:

```text
ownership
+ Gameweek picks
+ live player stats
```

The live endpoint exposes:

```text
elements[i].stats.total_points
```

Use this as the player's current Gameweek score. Do not recreate the FPL scoring system just to know current points.

Gameweek picks classify starters and bench:

```text
position <= 11 -> starter
position > 11  -> bench
```

Autosubs can affect final contributing players, so official matchup totals remain the score authority.

## Event Detection

The backend compares previous and current snapshots and emits normalized events.

Example:

```json
{
  "type": "GOAL",
  "leagueId": 12345,
  "gameweek": 3,
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

The commentary layer receives this event. It should not inspect raw FPL JSON or guess why points changed.

Important event types:

- goal;
- assist;
- clean sheet gained or lost;
- yellow card;
- red card;
- own goal;
- penalty miss;
- penalty save;
- save points;
- bonus-point change;
- player appearance;
- player subbed on/off where detectable;
- matchup lead change;
- tie;
- final result;
- league-table implication.

Live bonus can be provisional. Treat bonus changes as live updates until the fixture settles.

## Commentary Generation

The commentary system has two layers:

```text
Commentary Director
  -> deterministic app logic that chooses what deserves commentary

LLM provider
  -> external model that writes the sentence/paragraph
```

The Commentary Director should:

- prioritize major events;
- group related events;
- avoid repetitive topics;
- choose whether the next line is reactive or ambient;
- build a compact prompt;
- provide only authoritative facts.

The LLM can be OpenAI, Gemini, Claude, DeepSeek, Grok, Mistral, or another provider behind an adapter.

Do not hardcode the product to one model provider.

For cost control, the default approach should be:

- small/cheap model;
- compact prompts;
- event-based generation;
- short outputs;
- no full-history conversation replay;
- rolling commentary memory only.

## Voice Strategy

The voice layer does not need to be an AI agent.

Recommended options:

1. Browser/local TTS for MVP
   - very low cost;
   - easy to ship;
   - quality varies by browser/device.

2. Shared professional cloud TTS per league broadcast
   - higher quality;
   - generated once per league stream and shared by viewers;
   - should be a paid/add-on feature because audio generation can become the main cost.

Do not generate separate paid TTS audio for every viewer unless personalization becomes a paid feature.

## Notifications

Push notifications should be based on normalized backend events.

Examples:

- owned player scored;
- opponent's player scored;
- matchup lead changed;
- final result;
- major bonus swing;
- selected watchlist player returned points.

Use app-level notification preferences, not the user's real FPL Draft watchlist, unless direct FPL account mutation becomes a deliberate feature.

Firebase Cloud Messaging or a similar push service should be sufficient for early scale.

## Multi-Tenant Requirements

All persisted and live state must be scoped by registered league.

Important identifiers:

- internal app league ID;
- FPL Draft league ID;
- FPL Draft league entry ID;
- FPL/Draft entry ID;
- app user ID;
- FPL player element ID.

Do not assume one league, one season, or one fixed set of managers.

The backend should be able to poll many leagues efficiently:

- group work by active Gameweek;
- avoid duplicate calls for global data such as bootstrap/static player metadata;
- share live player data per Gameweek where possible;
- poll league-specific endpoints only as needed;
- use backoff when no fixtures are live.

## Persistence

Unlike the original single-league concept, the service should use a real database.

Minimum persisted data:

- app users;
- registered leagues;
- league membership/follows;
- selected fantasy team per user;
- notification preferences;
- commentary settings;
- optional league facts/history;
- event history useful for replay/debugging;
- generated commentary history if needed.

Live FPL state can mostly remain in memory and be reconstructed from FPL APIs after restart.

Do not persist copied browser cookies, FPL passwords, refresh tokens, Cloudflare tokens, or private authorization headers.

## Frontend

The frontend should be an application, not a landing page.

Core screens:

- league registration/join flow;
- team selection;
- notification settings;
- live broadcast dashboard;
- matchup detail view;
- event feed;
- commentary feed;
- audio/TTS controls.

Live updates should use Server-Sent Events or WebSockets rather than independent browser polling of many endpoints.

## Deployment And Cost Direction

For early multi-league scale, the basic service should stay modest:

- Spring Boot backend;
- database;
- frontend hosting;
- push notifications;
- external LLM API for commentary text;
- optional browser TTS.

The expensive part is not displaying live data to users. The expensive part is high-frequency AI generation and especially professional cloud TTS.

Design commentary and TTS as configurable features per league so costs can map cleanly to pricing.

## Security

Never commit:

- API keys;
- FPL session cookies;
- FPL access tokens;
- FPL refresh tokens;
- Cloudflare tokens;
- database passwords;
- push-service credentials;
- model-provider secrets.

Use environment variables or excluded server-side secret storage.

Treat all AI output as display text only. Never execute or trust generated content as code or configuration.

If the service is public, add:

- user authentication;
- authorization by league membership;
- admin-only league settings;
- rate limiting;
- CORS restrictions;
- HTTPS;
- secret rotation;
- input validation for all user-supplied league/context data.

## Development Phases

1. FPL data discovery
   - verify current endpoint payloads;
   - capture safe sample JSON;
   - document fields;
   - keep DTOs tolerant.

2. Multi-league registry
   - register leagues;
   - list managers/entries;
   - let users select teams.

3. Live state engine
   - poll FPL data;
   - build per-league live state;
   - expose scores and player contributions.

4. Event detector
   - compare snapshots;
   - emit normalized fantasy events;
   - handle starter/bench basics.

5. Live frontend
   - dashboard;
   - matchups;
   - event feed;
   - live updates.

6. Notifications
   - user preferences;
   - push registration;
   - event-to-notification rules.

7. Text commentary
   - commentary director;
   - model-provider adapter;
   - compact prompts;
   - generated commentary feed.

8. Voice
   - browser TTS toggle first;
   - optional shared professional TTS later.

9. Rich service features
   - league history;
   - rivalries;
   - manager profiles;
   - weekly recaps;
   - paid commentary tiers.

## Current Unknowns

Verify with real current-season data:

- exact 2026/27 endpoint response shapes;
- whether league details scores update fast enough for live broadcast;
- autosub fields and final contributing-player behavior;
- double Gameweek behavior;
- postponed and abandoned fixture states;
- practical polling limits;
- whether any required data becomes authenticated;
- browser TTS quality across target devices;
- cheapest acceptable LLM provider/model for commentary.

## Summary

This is a deterministic FPL Draft live-data service with AI used as a presentation layer.

Correct mental model:

```text
FPL Draft data
    ->
backend state
    ->
deterministic event detection
    ->
commentary decision logic
    ->
LLM writes the words
    ->
frontend displays text
    ->
optional TTS reads the words
```

Keep factual responsibility in the backend. Keep AI swappable. Keep TTS optional. Build for many leagues, even while testing with one.
