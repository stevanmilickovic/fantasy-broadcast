# Fantasy Broadcast Product Brief and Roadmap

## Purpose

Fantasy Broadcast is a live companion app for Fantasy Premier League leagues. It supports both FPL Draft and Classic leagues.

Users register or follow FPL leagues and open a live website during active Premier League matchday broadcasts. The service reads the relevant FPL or FPL Draft data, shows live fantasy matchups, detects important point swings, and can generate broadcaster-style text and voice commentary.

The released app is multi-league rather than tied to one private league. The later roadmap sections describe potential extensions, not current product behaviour.

## Product Experience

On matchdays, users can open a website and watch their FPL league as a live sports broadcast dashboard.

The live page shows:

- current Gameweek;
- league matchups;
- live head-to-head scores;
- players currently affecting each matchup;
- goals, assists, cards, clean-sheet swings, bonus changes, and other point events;
- recent fantasy events;
- generated text commentary;
- optional generated voice narration;
- event notifications and commentary for the displayed matchup.

The intended feel is a fantasy football broadcast, not a raw stats table.

Example commentary:

```text
Salah has scored, giving Stevan another five points and moving him ahead of Luka.
That one goal has completely changed the shape of this matchup.
```

## Service Scope

The app supports registered FPL leagues, regardless of whether they use the Draft or Classic format.

Each registered league has:

- FPL league ID;
- league source type (`DRAFT` or `CLASSIC`);
- league display name;
- list of league entries/managers from the relevant FPL source;
- app users who register or follow the league;
- service, AI narration, and voice narration settings.

Each user can:

- register a profile;
- join or follow a registered league;
- open a live broadcast for a registered league while an administrator-scheduled broadcast is active;
- view league, matchup, player, event, and commentary information in the broadcast.

The app does not mutate users' real FPL accounts.

## Core Architecture

```text
FPL APIs
    |
    v
Spring Boot Backend
    |
    +--> FPL and FPL Draft integration
    +--> league registry
    +--> live state engine
    +--> event detector
    +--> broadcast event and narration pipeline
    +--> commentary director
    +--> LLM provider adapter
    +--> REST/SSE API
    |
    v
React Frontend
    |
    +--> live dashboard
    +--> commentary feed
    +--> protected generated-audio playback
```

The backend owns factual truth. The frontend presents state and plays protected generated audio when voice narration is enabled.

## Accuracy Rule

AI must not calculate scores, infer ownership, decide whether a goal happened, or maintain league state.

Normal backend code must:

- read FPL data;
- join player, ownership, lineup, and live-score data;
- detect factual events;
- calculate or accept official matchup totals;
- produce structured commentary facts.

The AI only turns structured facts into natural language.

## FPL Data Model

The FPL and FPL Draft APIs are undocumented. Keep all endpoint access behind an integration layer and normalize both formats before they reach the live-state pipeline.

Known useful endpoints:

```text
GET https://draft.premierleague.com/api/league/{leagueId}/details
GET https://draft.premierleague.com/api/league/{leagueId}/element-status
GET https://draft.premierleague.com/api/entry/{entryId}/event/{gameweek}
GET https://draft.premierleague.com/api/event/{gameweek}/live
GET https://fantasy.premierleague.com/api/leagues-h2h/{leagueId}/standings/
GET https://fantasy.premierleague.com/api/leagues-h2h-matches/league/{leagueId}/?event={gameweek}
GET https://fantasy.premierleague.com/api/entry/{entryId}/event/{gameweek}/picks/
GET https://fantasy.premierleague.com/api/event/{gameweek}/live/
```

Data relationship:

```text
FPL bootstrap/static
  -> player identity

Draft league/{leagueId}/element-status
  -> player ownership

  -> Draft starting XI / bench

FPL entry/{entryId}/event/{gameweek}/picks
  -> Classic starting XI / bench and captaincy

FPL event/{gameweek}/live
  -> live player stats and total_points

Draft league details or Classic H2H matches
  -> league entries, fixtures, standings, and recorded matchup scores
```

Use player `element` / `id` as the joining key across FPL data sources.

## Live Scoring Approach

For Draft total matchup score, prefer the official values exposed by:

```text
/api/league/{leagueId}/details
```

if they update quickly enough during live play. For Classic H2H leagues, use the H2H matches endpoint for fixtures and recorded totals; calculate live scores from each entry's picks and live player data when those totals lag.

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

The implemented voice layer uses optional server-side cloud TTS. Audio is generated once for a league broadcast event and is served only to users allowed to access that league.

Do not generate separate paid TTS audio for every viewer unless personalization becomes a paid feature.

## Future Push Notifications

The live broadcast already displays normalized event notifications. Device push notifications, watchlists, and per-player notification preferences are future capabilities.

Examples:

- owned player scored;
- opponent's player scored;
- matchup lead changed;
- final result;
- major bonus swing;
- selected watchlist player returned points.

If added, use app-level notification preferences, not the user's real FPL watchlist, unless direct FPL account mutation becomes a deliberate feature.

Firebase Cloud Messaging or a similar push service should be sufficient for early scale.

## Multi-Tenant Requirements

All persisted and live state must be scoped by registered league.

Important identifiers:

- internal app league ID;
- FPL league ID;
- FPL league source type;
- FPL league entry ID;
- FPL entry ID;
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

Unlike the original single-league concept, the service uses a real database.

Currently persisted data includes:

- app users;
- registered leagues;
- league membership/follows;
- broadcast schedules;
- per-league AI and voice narration settings;
- generated narration and audio lifecycle data;
- password-reset and account-deletion request records.

Live FPL state can mostly remain in memory and be reconstructed from FPL APIs after restart.

Do not persist copied browser cookies, FPL passwords, refresh tokens, Cloudflare tokens, or private authorization headers.

## Frontend

The frontend combines public information, account management, league management, checkout, and the live broadcast.

Current screens include:

- league registration/join flow;
- live broadcast dashboard;
- league dashboard and follow flow;
- checkout, pricing, privacy, terms, and refund pages;
- administrator user, league, and broadcast-schedule management;
- generated-audio playback when voice narration is enabled.

Live updates should use Server-Sent Events or WebSockets rather than independent browser polling of many endpoints.

## Deployment And Cost Direction

For early multi-league scale, the basic service should stay modest:

- Spring Boot backend;
- database;
- frontend hosting;
- external LLM API for commentary text;
- optional server-side TTS.

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

## Development Phases and Roadmap

The following is the implementation history and forward roadmap. Core live broadcast, account, league, payment, narration, and deployment work is implemented; push notifications, team selection, watchlists, and richer social features remain future work.

1. FPL data discovery
   - verify current endpoint payloads;
   - capture safe sample JSON;
   - document fields;
   - keep DTOs tolerant.

2. Multi-league registry
   - register leagues;
   - list managers/entries;
   - register and follow leagues.

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
   - shared professional TTS for enabled leagues.

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
- voice quality and provider cost across target devices;
- cheapest acceptable LLM provider/model for commentary.

## Summary

This is a deterministic FPL live-data service for Draft and Classic leagues, with AI used as a presentation layer.

Correct mental model:

```text
FPL data
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
