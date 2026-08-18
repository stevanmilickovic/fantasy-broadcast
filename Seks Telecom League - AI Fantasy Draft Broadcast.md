# Seks Telecom League — AI Fantasy Draft Broadcast

## 1. Purpose

The goal of this application is to turn a private Fantasy Premier League Draft league into a live, radio-style fantasy football broadcast.

During real Premier League fixtures, the application should automatically enter a live mode, continuously read the current state of the FPL Draft league, detect meaningful fantasy events, generate commentary about those events, convert the commentary into speech, and play it through a live web interface.

The intended experience is that league members can open a website during a Premier League matchday and listen to the fantasy league as though it were an actual football broadcast or podcast.

The commentator should not only announce raw point changes. It should understand the context of the private league: current matchups, scores, players owned by each manager, rivalries, previous results, league history, manager personalities, running jokes, title races, relegation battles, and other supplied background information.

The long-term goal is to make the private fantasy league feel like its own sporting competition.

## 2. Core Product Experience

A user opens the live website during Premier League fixtures.

The page shows live fantasy information such as:

- current head-to-head scores;
- live league standings;
- players currently playing;
- player points;
- goals;
- assists;
- clean sheets;
- cards;
- substitutions;
- bonus-point changes;
- other relevant FPL events;
- recent fantasy events;
- recent commentary.

At the same time, an AI-generated commentator speaks continuously or semi-continuously.

Example:

> "Stevan has moved ahead by three points after Salah's goal. Luka had controlled this matchup for most of the afternoon, but that one event has completely changed the situation."

If there is no major event, the commentator should continue with context-aware observations:

> "Things have gone quiet for the last few minutes, but Marko is still in a dangerous position here. He has two players left this evening while Stevan has only one."

The experience should resemble a live football radio broadcast rather than a notification system.

## 3. Design Principles

### 3.1 Deterministic logic owns the truth

AI must never be responsible for calculating fantasy scores, deciding whether a goal occurred, determining player ownership, or maintaining league state.

All factual state is calculated or obtained by normal application code.

The AI receives structured facts and is responsible only for turning those facts into entertaining natural-language commentary.

This separation is critical.

If the AI hallucinates, crashes, generates slowly, or produces a poor sentence, the fantasy scores and application state must remain correct.

### 3.2 FPL should remain the primary source of truth

Where possible, current squads, ownership, fixtures, player points, and league information should come directly from the FPL Draft endpoints.

The application should avoid duplicating large amounts of FPL data permanently unless there is a clear reason to do so.

### 3.3 Persistent storage should stay minimal

The expected league contains only a small number of managers.

For the initial version, a database is unnecessary.

Persistent application-specific information can be stored as JSON or JSONL files.

Examples:

- manager metadata;
- nicknames;
- rivalries;
- historical league information;
- running jokes;
- commentator settings;
- optional event history;
- optional commentary history.

Most live state should exist only in memory and can be reconstructed from the FPL APIs after application restart.

### 3.4 Optimize for Oracle Cloud Always Free

The first production target is an Oracle Cloud Always Free Ampere A1 VM.

Expected free resource envelope:

- 2 ARM OCPUs total;
- 12 GB RAM total;
- up to 200 GB combined boot/block storage.

CPU is expected to be the primary constraint.

The application should therefore prefer:

- simple architecture;
- small local language models;
- quantized inference;
- lightweight text-to-speech;
- short AI generations;
- buffered commentary;
- minimal background work;
- no unnecessary microservices;
- no server-side video encoding in the first version.

### 3.5 Build progressively

Do not begin by trying to solve the entire final broadcast system.

The preferred implementation order is:

1. read FPL Draft data;
2. reconstruct live league state;
3. detect fantasy events;
4. expose the live state to a frontend;
5. generate text commentary;
6. convert commentary to speech;
7. create continuous radio-style audio;
8. later add external streaming/broadcasting.

Every stage should remain independently testable.

## 4. High-Level Architecture

```text
                   Premier League / FPL schedule
                              |
                              v
                     SPRING BOOT BACKEND
                              |
        +---------------------+----------------------+
        |                     |                      |
        v                     v                      v
   FPL Draft API        Live State Engine       Scheduler
        |                     |                      |
        |               Event Detector               |
        |                     |                      |
        +---------------------+----------------------+
                              |
                              v
                    Commentary Director
                              |
                              v
                        Local LLM
                     text commentary
                              |
                              v
                     Commentary Queue
                              |
                              v
                         TTS Engine
                              |
                              v
                        Audio Queue
                              |
                +-------------+-------------+
                |                           |
                v                           v
          REST/WebSocket               Audio files/
              API                       audio stream
                |                           |
                +-------------+-------------+
                              |
                              v
                            NGINX
                              |
                              v
                       REACT FRONTEND
                  live scores + commentary
                         + audio
```

## 5. Main Components and Responsibilities

### 5.1 Spring Boot Backend

The Spring Boot application is the central coordinator and authoritative application layer.

It should remain running continuously.

It does not need to perform heavy live work 24/7. Instead, it switches between normal mode and matchday mode.

Responsibilities:

- read Premier League/FPL fixture schedules;
- determine when live monitoring should begin;
- communicate with FPL Draft endpoints;
- maintain current fantasy league state in memory;
- compare successive API snapshots;
- detect meaningful fantasy events;
- maintain live head-to-head scores;
- maintain current league-table implications where relevant;
- provide structured context to the commentary system;
- manage commentary generation requests;
- manage commentary and audio queues;
- expose APIs to the frontend;
- send live updates to connected browsers;
- load/save small JSON configuration/history files;
- recover cleanly after restart.

The backend is the single source of truth for the web frontend and commentator.

### 5.2 Matchday Scheduler

The application should stay online continuously but only enter full live-processing mode around real fixtures.

Example lifecycle:

```text
NORMAL MODE
    |
    | periodically check upcoming fixtures
    |
    v
fixture approaching
    |
    v
MATCHDAY PREPARATION
    |
    | refresh squads
    | refresh manager/team mappings
    | initialize current gameweek
    | start AI/TTS workers if stopped
    | optionally generate pre-match discussion
    |
    v
LIVE MODE
    |
    | poll FPL data
    | update state
    | detect events
    | generate commentary
    | produce audio
    |
    v
all relevant fixtures finished
    |
    v
POST-MATCH MODE
    |
    | final score updates
    | optional summary commentary
    | persist useful history
    |
    v
NORMAL MODE
```

The exact activation window can be configurable.

For example:

- prepare 20-30 minutes before the first fixture;
- remain active throughout overlapping fixtures;
- stop live processing after the final relevant fixture has settled.

### 5.3 FPL Draft Integration

This component communicates with the FPL Draft data sources.

Expected responsibilities:

- league details;
- manager/team information;
- draft squads;
- player ownership;
- current gameweek;
- live player points;
- substitutions where available;
- waiver/transaction information where useful;
- head-to-head information where available.

The FPL Draft endpoints are undocumented and therefore must be isolated behind a clear adapter/service layer.

Do not let endpoint-specific response structures leak throughout the application.

Preferred structure:

```text
FplDraftClient
    |
    v
FplDraftMapper
    |
    v
internal domain models
```

If FPL changes an endpoint, ideally only this integration layer needs modification.

Authentication requirements should be investigated during implementation.

If the required league data is publicly accessible through league identifiers, do not introduce login/session handling unnecessarily.

If authentication is required for some endpoints, credentials must never be committed to source control.

### 5.4 Live State Engine

The Live State Engine contains the current factual representation of the fantasy league.

Examples of in-memory state:

- CurrentGameweek
- CurrentFixtures
- Managers
- FantasyTeams
- CurrentStartingXIs
- PlayerOwnership
- PlayerLivePoints
- HeadToHeadScores
- CurrentLeagueTable
- ActivePremierLeagueMatches
- PreviousPollSnapshot

This state should primarily live in RAM.

After restart, the application should reconstruct as much as possible from FPL.

Only information that cannot reliably be reconstructed should be persisted.

### 5.5 Event Detector

Polling an API only tells us that data changed.

The Event Detector explains what happened.

It compares the previous live snapshot with the newest snapshot and emits normalized fantasy events.

Example:

Before:

```text
Salah: 2 points
Stevan: 34
Luka: 37
```

After:

```text
Salah: 7 points
Stevan: 39
Luka: 37
```

Possible emitted events:

```json
{
  "type": "PLAYER_POINT_INCREASE",
  "player": "Mohamed Salah",
  "delta": 5,
  "owner": "Stevan"
}
```

```json
{
  "type": "LEAD_CHANGE",
  "matchup": "Stevan vs Luka",
  "previousLeader": "Luka",
  "newLeader": "Stevan",
  "score": "39-37"
}
```

The Event Detector should emit semantic events, not merely raw JSON diffs.

Possible event categories:

- goal-related point increase;
- assist;
- clean sheet gained;
- clean sheet lost;
- yellow card;
- red card;
- penalty miss;
- penalty save;
- own goal;
- bonus-point swing;
- player appearance;
- player substitution;
- fantasy matchup lead change;
- tie;
- major score swing;
- matchup effectively decided;
- league-table position change;
- title-race implication;
- final result.

The exact event fidelity depends on what FPL exposes.

### 5.6 Commentary Director

The Commentary Director decides when the commentator should speak and what it should talk about.

This is normal application logic, not an AI agent.

Its purpose is to stop the LLM from becoming repetitive, overactive, or directionless.

Responsibilities:

- prioritize live events;
- group related events;
- determine whether an event deserves commentary;
- choose commentary style/intensity;
- trigger filler observations during quiet periods;
- prevent recent topics from being repeated;
- track what has already been discussed;
- provide structured context to the LLM;
- keep the commentary queue at a healthy length.

Example priority concept:

```text
major goal / huge swing       100
matchup lead change            90
red card / penalty event       85
assist / important return      70
clean sheet lost               60
minor point update             40
strategic observation          20
league-history filler          10
random background filler        5
```

Priority values are illustrative and should remain configurable.

### 5.7 Commentary Modes

There should be at least two broad types of commentary.

Reactive commentary

Triggered by an actual fantasy event.

Examples:

- a goal changes a matchup;
- a clean sheet disappears;
- one manager overtakes another;
- a captain-like star player creates a major swing;
- a matchup becomes almost impossible to recover.

Reactive commentary should have the highest priority.

Ambient/filler commentary

Generated when little is happening.

Possible subjects:

- current matchup situation;
- players still remaining;
- projected advantage;
- current league table;
- historical results;
- rivalries;
- manager tendencies;
- previous champions;
- previous meetings;
- waiver/draft decisions;
- interesting team composition;
- running jokes;
- upcoming fixtures;
- who needs what to happen.

The Commentary Director should choose the subject before asking the LLM to write.

The LLM should not randomly decide what factual topic is relevant.

### 5.8 LLM Commentator

The LLM is responsible only for language generation.

It receives structured context such as:

```text
EVENT:
Mohamed Salah gained 5 points.

FANTASY IMPACT:
Stevan owns Salah.
Stevan moves from 34 to 39 points.
Luka has 37 points.
Stevan has taken the lead.

MATCHUP:
Stevan 39 - 37 Luka.

RECENT CONTEXT:
Luka had been leading for 37 minutes.

LEAGUE CONTEXT:
Stevan and Luka finished first and second last season.

RECENT COMMENTARY TOPICS:
- discussed Luka's defenders 2 minutes ago
- discussed last season's final 8 minutes ago

INSTRUCTION:
Produce approximately 15-25 seconds of excited radio-style commentary.
Do not invent facts.
```

Possible output:

> "Salah has completely changed this matchup. Stevan jumps ahead 39 to 37 after spending most of the afternoon behind, and once again these two are turning a normal gameweek into a fight."

The LLM should never receive responsibility for the underlying score calculation.

### 5.9 Local LLM Runtime

Because the target server has only two ARM CPU cores, use a small, quantized local model.

Candidate runtime:

- llama.cpp

Requirements:

- ARM64 support;
- quantized GGUF model;
- small enough to leave substantial RAM for the OS and TTS;
- acceptable CPU generation speed;
- HTTP/local API interface;
- configurable context size.

Likely model size target:

- approximately 1B-4B parameters;
- quantized;
- selected primarily for instruction-following quality and CPU efficiency.

A large model is unnecessary because the problem is narrowly constrained.

The application provides the reasoning/context; the model mainly provides natural language.

### 5.10 Commentary Queue

Generated text commentary should be placed into an ordered queue.

Example:

```text
Comment 143
Comment 144
Comment 145
...
```

Each entry can contain:

```json
{
  "id": 145,
  "priority": 90,
  "createdAt": "...",
  "eventIds": [912, 913],
  "text": "Salah has completely changed this matchup...",
  "status": "WAITING_FOR_TTS"
}
```

The queue separates:

- live event detection;
- LLM generation;
- TTS generation;
- frontend playback.

This prevents one slow stage from blocking everything else.

### 5.11 Text-to-Speech Engine

The speech system is not a second reasoning agent.

Its task is simply:

```text
commentary text -> speech audio
```

A lightweight local TTS engine such as Kokoro is a suitable starting point.

Important requirements:

- CPU execution;
- ARM64 compatibility;
- consistent commentator voice;
- acceptable generation speed;
- natural English speech;
- local/offline operation;
- no per-minute API charges.

Generated clips can initially be stored as temporary audio files.

Example:

```text
audio/
    000143.wav
    000144.wav
    000145.wav
```

Old files can be deleted automatically.

### 5.12 Audio Buffer

Continuous commentary does not require the AI to generate speech at exactly the speed it is consumed.

Maintain a buffer.

Example:

```text
currently playing:
Comment 143

already generated:
Comment 144 — 24 sec
Comment 145 — 31 sec
Comment 146 — 20 sec

buffer remaining:
~75 sec
```

While Comment 143 is playing, the server can generate future commentary.

This is one of the main techniques that makes the system feasible on two CPU cores.

During quiet match periods, the system should aim to generate commentary slightly ahead of playback.

### 5.13 Handling Breaking Events

A live event may occur while filler commentary is already queued.

The system needs priority handling.

Possible strategy:

- never cut speech in the middle of a word;
- optionally allow the currently playing sentence/clip to finish;
- insert major live-event commentary ahead of low-priority queued filler;
- discard stale filler where appropriate.

Example:

```text
QUEUE BEFORE GOAL

[playing] Historical discussion
[next]    Manager profile
[next]    League table observation

GOAL OCCURS

QUEUE AFTER EVENT

[playing] Historical discussion
[next]    GOAL REACTION
[next]    Lead-change analysis
[next]    League table observation
```

For extremely time-sensitive events, deterministic phrases can be played immediately:

> "GOAL! Mohamed Salah!"

The richer AI-generated analysis can follow afterward.

This avoids waiting for the LLM before acknowledging a major event.

### 5.14 React Frontend

The frontend is the audience-facing live broadcast interface.

Initial functionality:

- current gameweek;
- live Premier League fixtures;
- fantasy matchups;
- manager names/team names;
- live scores;
- players and points;
- recent fantasy events;
- current/previous commentary;
- live league table;
- audio playback;
- system status.

Possible future presentation:

```text
====================================================
            SEKS TELECOM LEAGUE — LIVE
====================================================

             STEVAN       52
                       VS
             LUKA         48

----------------------------------------------------

LIVE PLAYERS

Salah       7     GOAL
Palmer      5     ASSIST
Saliba      6     CLEAN SHEET

----------------------------------------------------

LIVE TABLE

1. Stevan
2. Marko
3. Luka
...

----------------------------------------------------

NOW ON AIR

"That Salah goal has completely changed the
afternoon..."

====================================================
```

The visual design can eventually resemble a sports broadcast dashboard.

### 5.15 Frontend Live Updates

The frontend should not constantly poll every backend endpoint independently.

Preferred approach:

- REST for initial state/configuration;
- WebSocket or Server-Sent Events for live updates.

Possible live messages:

- SCORE_UPDATED
- PLAYER_POINTS_UPDATED
- EVENT_CREATED
- COMMENTARY_CREATED
- AUDIO_READY
- LEAGUE_TABLE_UPDATED
- MATCHDAY_STATUS_CHANGED

WebSockets are useful if later interactive features are added.

Server-Sent Events may be simpler if communication is primarily server-to-browser.

Either is acceptable for V1.

### 5.16 Nginx

Nginx sits in front of the application.

Responsibilities:

- public HTTP/HTTPS entry point;
- TLS termination;
- serve React static files;
- reverse proxy backend endpoints;
- proxy WebSocket/SSE connections;
- optionally serve generated audio files;
- compression/caching where appropriate.

Example routing concept:

```text
/                 -> React frontend
/api/*            -> Spring Boot
/ws/*             -> Spring Boot WebSocket
/audio/*          -> generated commentary audio
```

Nginx should remain lightweight.

## 6. Persistent Data

The application should not introduce a database until there is a real need.

Suggested directory:

```text
data/
├── league.json
├── managers.json
├── commentary-config.json
├── league-history.json
├── facts.json
└── events/
    ├── gw01.jsonl
    ├── gw02.jsonl
    └── ...
```

league.json

Application-level league configuration.

Example information:

- FPL Draft league ID;
- display name;
- season;
- timezone;
- polling configuration.

managers.json

Information FPL does not know.

Example:

```json
[
  {
    "fplManagerId": 123,
    "name": "Stevan",
    "nickname": "...",
    "teamName": "...",
    "commentaryFacts": [
      "...",
      "..."
    ],
    "rivals": [456]
  }
]
```

league-history.json

Long-term context.

Possible information:

- previous champions;
- season standings;
- memorable fixtures;
- records;
- historical rivalries.

facts.json

Optional free-form commentary material.

Examples:

- running jokes;
- manager habits;
- famous draft decisions;
- league traditions.

events/gwXX.jsonl

Optional append-only event history.

JSONL is useful because each event can be appended without rewriting the entire file.

Example:

```jsonl
{"time":"2026-08-22T15:23:14Z","type":"GOAL_POINTS","manager":"Stevan","player":"Salah","delta":5}
{"time":"2026-08-22T15:23:14Z","type":"LEAD_CHANGE","from":"Luka","to":"Stevan"}
```

## 7. What Should NOT Be Persisted by Default

Avoid storing copies of everything FPL already provides.

Do not persist every polling response unless debugging requires it.

Examples that normally remain in memory:

- current player points;
- current gameweek state;
- temporary head-to-head scores;
- active fixtures;
- current ownership;
- current FPL snapshots.

If the process restarts, reload them from FPL.

This keeps the application simple and avoids unnecessary disk I/O and data synchronization issues.

## 8. Polling Strategy

The exact frequency depends on the behavior and limits of the FPL endpoints.

A reasonable starting point might be:

- outside matchday: very infrequent schedule checks
- before fixtures: refresh squads/configuration
- during live fixtures: poll live FPL state every 15-30 seconds
- after fixtures: reduce polling after results settle

Do not poll aggressively without need.

The Event Detector should compare snapshots and do nothing if no meaningful change occurred.

## 9. Commentary Context Management

The commentator requires enough context to sound informed without sending an enormous prompt every time.

Maintain several context layers.

Static league context

Rarely changes:

- manager descriptions;
- rivalries;
- league history;
- traditions;
- jokes.

Gameweek context

Changes once per gameweek:

- current fixtures;
- squads;
- starting players;
- relevant table positions;
- matchup stakes.

Live context

Changes continuously:

- scores;
- active players;
- point changes;
- recent events;
- remaining players.

Commentary memory

Short rolling history:

- last several generated comments;
- recently discussed subjects;
- timestamps;
- repetition cooldowns.

The application should construct only the relevant subset for each LLM request.

Do not continuously feed the entire season history to the model.

## 10. Preventing Repetition

Continuous AI commentary can easily become repetitive.

The Commentary Director should explicitly track topics.

Example:

```text
topic: STEVAN_VS_LUKA_RIVALRY
lastDiscussed: 15:32
cooldown: 20 minutes

topic: SALAH_IMPORTANCE
lastDiscussed: 15:38
cooldown: 8 minutes
```

Possible topics:

- manager;
- player;
- rivalry;
- historical fixture;
- league table;
- title race;
- current matchup;
- draft strategy;
- transfer;
- remaining players.

The LLM prompt should include recent commentary or explicit forbidden/recent topics.

## 11. Resource Strategy for Oracle Free Tier

The server target is constrained primarily by CPU.

Approximate conceptual RAM allocation:

```text
OS + services                 ~1-2 GB
Spring Boot                   ~0.5-1 GB
Nginx                         minimal
React static site             minimal
local LLM                     ~2-4+ GB
TTS                           ~0.5-1+ GB
filesystem/cache/headroom     remaining RAM
```

Exact values depend on model/runtime choices.

The application should leave comfortable free memory rather than trying to use all 12 GB.

CPU-saving measures

- only run intensive AI work during matchday mode;
- use small quantized LLMs;
- restrict output length;
- avoid AI for deterministic tasks;
- buffer commentary;
- use deterministic templates for urgent events;
- limit simultaneous LLM and TTS work if contention becomes severe;
- queue jobs instead of spawning unrestricted threads;
- avoid running video encoding on the Oracle VM in V1.

## 12. Concurrency Model

The system should use bounded worker queues.

Conceptually:

```text
FPL polling thread
        |
        v
event queue
        |
        v
commentary director
        |
        v
LLM worker
        |
        v
commentary queue
        |
        v
TTS worker
        |
        v
audio queue
```

There should normally be only one heavy LLM generation at a time.

There should normally be only one heavy TTS generation at a time unless testing proves the VM has enough spare capacity.

Do not create an unbounded async task for every FPL update.

## 13. Failure Handling

The live broadcast should degrade gracefully.

FPL unavailable

- retain last known state;
- show stale-data warning;
- retry with backoff;
- do not invent new events.

LLM unavailable

- scores/frontend continue normally;
- deterministic event text can still be displayed;
- optionally use template commentary.

Example fallback:

> "Salah scores. Stevan gains five points and takes the lead 39-37."

TTS unavailable

- text commentary continues;
- frontend displays commentary;
- retry/restart TTS worker.

Browser disconnects

- server continues maintaining live state;
- reconnecting browser receives current state;
- it should not need every missed transient frontend update.

Server restart

- reload configuration/history from JSON;
- reload current state from FPL;
- resume matchday processing;
- do not depend on stale in-memory state.

## 14. Security

Even though this is a private/fun application, normal basic security rules apply.

Never commit:

- Oracle credentials;
- SSH keys;
- FPL session cookies;
- FPL passwords;
- API secrets;
- YouTube stream keys;
- private tokens.

Use environment variables or server-side secret files excluded from Git.

If the website becomes publicly accessible, consider:

- authentication for admin/configuration routes;
- rate limiting;
- read-only public APIs;
- HTTPS;
- CORS restrictions;
- protection against arbitrary prompt/context submission.

AI-generated text must never be trusted as executable input.

## 15. Initial Deployment Model

The entire V1 can run on one Oracle VM.

Suggested deployment:

```text
Oracle ARM VM
|
+-- nginx
|
+-- Spring Boot application
|
+-- llama.cpp server/process
|
+-- Kokoro TTS process
|
+-- JSON/JSONL data directory
|
+-- generated temporary audio
```

Docker Compose is acceptable if ARM64 images are reliable.

However, Docker is not mandatory.

If native processes make ARM compatibility or resource usage easier, using systemd services directly is also acceptable.

Prefer operational simplicity over containerization for its own sake.

## 16. Broadcasting Beyond the Website

The initial product is a live website with audio.

That is enough to create the core experience.

A later phase can broadcast the same content to YouTube or another streaming platform.

Preferred first streaming approach

Run OBS on a league member's PC:

```text
live website
     |
OBS Browser Source
     |
YouTube/Twitch/etc.
```

This avoids making the Oracle VM encode video.

Possible later fully automated approach

```text
React broadcast page
       |
headless browser/rendering
       |
FFmpeg
       |
YouTube Live ingest
```

This may require substantially more CPU.

Do not make this a V1 requirement.

## 17. Suggested Domain Model

The exact Java model should remain simple.

Possible objects:

- League
- Manager
- FantasyTeam
- FantasyPlayer
- Gameweek
- PremierLeagueFixture
- FantasyMatchup
- LivePlayerState
- LiveLeagueState
- FantasyEvent
- CommentaryRequest
- CommentaryEntry
- AudioEntry
- ManagerFact
- LeagueFact

Avoid over-modeling the system before the actual FPL responses are understood.

## 18. Suggested Service Structure

Example Spring packages:

```text
com.sextelecomleague.broadcast
|
+-- fpl
|   +-- FplDraftClient
|   +-- FplDraftMapper
|   +-- dto
|
+-- schedule
|   +-- MatchdayScheduler
|   +-- MatchdayService
|
+-- live
|   +-- LiveStateService
|   +-- LivePollingService
|   +-- EventDetector
|
+-- commentary
|   +-- CommentaryDirector
|   +-- CommentaryContextBuilder
|   +-- LlmClient
|   +-- CommentaryQueue
|
+-- speech
|   +-- TtsClient
|   +-- AudioQueue
|   +-- AudioCleanupService
|
+-- persistence
|   +-- JsonLeagueRepository
|   +-- JsonManagerRepository
|   +-- JsonHistoryRepository
|   +-- JsonEventLog
|
+-- api
|   +-- LiveController
|   +-- LeagueController
|   +-- LiveStreamController
|
+-- domain
    +-- ...
```

This is illustrative.

Keep the actual implementation simpler if fewer classes are sufficient.

## 19. Suggested Frontend Structure

Possible React structure:

```text
src/
|
+-- api/
|
+-- live/
|   +-- LiveMatchup.tsx
|   +-- LivePlayers.tsx
|   +-- EventFeed.tsx
|
+-- league/
|   +-- LeagueTable.tsx
|
+-- commentary/
|   +-- CommentaryFeed.tsx
|   +-- AudioPlayer.tsx
|
+-- layout/
|   +-- BroadcastHeader.tsx
|   +-- BroadcastPage.tsx
|
+-- state/
|
+-- types/
```

Again, do not create abstraction without a real need.

## 20. V1 Scope

V1 should prove the complete data-to-speech chain.

Minimum successful version:

- configure one FPL Draft league;
- load managers and squads;
- poll live FPL points;
- detect a player point change;
- determine which fantasy manager is affected;
- update a live fantasy matchup;
- generate one structured commentary request;
- produce AI commentary text;
- run text through TTS;
- play the resulting audio through the website.

The key proof-of-concept is:

```text
FPL Draft
    ->
point change
    ->
event
    ->
LLM sentence
    ->
voice
    ->
browser
```

If this works reliably on Oracle Free Tier, the main technical uncertainty has been solved.

## 21. Recommended Development Phases

Phase 1 — FPL discovery

Goal:

Understand exactly which FPL Draft endpoints are available and what authentication is required.

Deliverables:

- league metadata retrieval;
- manager/team retrieval;
- squads;
- live gameweek player points;
- documented internal DTOs;
- sample captured responses for tests.

Phase 2 — Live fantasy engine

Goal:

Create correct in-memory league state.

Deliverables:

- player ownership;
- live points;
- fantasy matchup scores;
- snapshot comparison;
- normalized events.

No AI yet.

Phase 3 — Live website

Goal:

Allow league members to watch the fantasy league update.

Deliverables:

- React broadcast page;
- initial REST state;
- live updates via SSE/WebSocket;
- event feed;
- live scores.

Still no AI required.

Phase 4 — Text commentator

Goal:

Produce relevant commentary.

Deliverables:

- local LLM;
- context builder;
- Commentary Director;
- event commentary;
- filler commentary;
- repetition prevention;
- commentary text feed in frontend.

Phase 5 — Voice

Goal:

Turn commentary into a radio experience.

Deliverables:

- Kokoro/local TTS;
- audio queue;
- frontend playback;
- buffering;
- priority handling.

Phase 6 — Autonomous matchdays

Goal:

Require no manual intervention.

Deliverables:

- schedule monitoring;
- automatic matchday mode;
- automatic worker startup/shutdown;
- post-match wrap-up;
- recovery after restart.

Phase 7 — Rich commentary

Possible additions:

- manager profiles;
- historical statistics;
- rivalry context;
- league records;
- matchup probabilities;
- player remaining analysis;
- transfer/waiver references;
- commentary personalities;
- multiple commentator voices.

Phase 8 — External football data

Only add if FPL data is not detailed/fast enough.

Possible additional information:

- real goal event details;
- minute;
- scorer;
- assister;
- substitutions;
- shots;
- cards;
- match commentary.

This should enrich FPL information, not replace FPL as the fantasy scoring authority.

Phase 9 — Public broadcast

Possible additions:

- OBS integration;
- automated streaming;
- YouTube Live;
- broadcast graphics;
- intro/outro;
- music/stingers;
- voice effects;
- matchday countdown.

## 22. Features Explicitly Deferred

Do not prioritize these during initial implementation:

- microservices;
- Kubernetes;
- distributed databases;
- Redis;
- Kafka;
- paid AI APIs;
- GPU servers;
- complex authentication systems;
- mobile applications;
- native desktop applications;
- automated video encoding;
- multi-region infrastructure;
- predictive ML;
- storing every FPL API response forever.

The target league is small.

Complex infrastructure would solve problems the project does not currently have.

## 23. Important Unknowns to Validate Early

These questions should be investigated before deep implementation:

- Which FPL Draft endpoints provide league/team/squad information?
- Which endpoints require authentication?
- Can the required data be read using only league identifiers?
- How quickly does FPL live data update after real events?
- Does FPL expose enough event detail to distinguish goals, assists, clean-sheet changes, cards, etc., or only point totals?
- How should substitutes/bench players be represented in the private Draft scoring format?
- How are head-to-head fixtures represented?
- What happens during bonus-point recalculations?
- How stable are the undocumented endpoints?
- How well does the chosen LLM perform on 2 Ampere ARM OCPUs?
- Can TTS generate faster than or near the rate at which audio is consumed?
- Can LLM and TTS coexist without unacceptable CPU contention?
- What is the optimal commentary buffer length?
- Does the browser permit the desired automatic/continuous audio playback behavior?
- What fallback experience should users receive if audio cannot autoplay?

These should be answered empirically.

## 24. Commentary Quality Goals

The commentator should feel like someone who follows the league.

It should:

- know who owns each relevant player;
- understand score implications;
- recognize lead changes;
- understand remaining-player advantage;
- know historical rivalries;
- reference previous seasons selectively;
- vary sentence structure;
- vary emotional intensity;
- avoid repeating the same observation;
- distinguish major events from minor ones;
- fill quiet periods without pretending events are occurring;
- never invent a player, score, event, or historical fact.

The desired tone is closer to a football radio commentator/podcast host than a robotic notification voice.

## 25. AI Safety/Accuracy Contract

Every LLM prompt should explicitly state that:

- supplied facts are authoritative;
- it must not alter scores;
- it must not invent events;
- it must not invent ownership;
- it must not invent historical facts;
- uncertainty should be omitted rather than guessed;
- output should contain commentary only;
- output length should respect the requested speaking duration.

Where possible, factual names/numbers should be assembled by backend code rather than entrusted to model recall.

## 26. Performance Philosophy

The server does not need to produce unlimited commentary.

The objective is enjoyable continuous listening.

A good target may be something like:

- major live event: comment immediately
- moderate event: comment if relevant
- quiet period: new observation every ~30-90 seconds
- deep quiet period: history/rivalry/table discussion
- audio buffer: target ~30-120 seconds depending on performance

These values should be tuned experimentally.

If the server struggles, reduce commentary frequency before sacrificing factual reliability.

## 27. Future Possibilities

If the core application succeeds, potential extensions include:

- two AI commentators with different personalities;
- commentator hand-offs;
- pre-game shows;
- halftime/gameweek summaries;
- "Match of the Day" style recap;
- weekly awards;
- manager interviews generated from supplied quotes;
- power rankings;
- historical record database;
- automated social-media graphics;
- live ticker;
- animated broadcast overlays;
- YouTube stream;
- end-of-season documentary/statistics;
- commentary archives;
- selectable commentary tone;
- crowd/stadium ambience;
- intro music and stingers;
- league news bulletins;
- waiver-window shows;
- draft-night broadcast mode.

These are extensions of the same core state/event system.

## 28. Summary for Future Agents

This project is not fundamentally an AI application.

It is a deterministic fantasy-football live-data application with AI used as a presentation layer.

The correct mental model is:

```text
FPL DATA
    |
    v
DETERMINISTIC APPLICATION STATE
    |
    v
DETERMINISTIC EVENT DETECTION
    |
    v
COMMENTARY DECISION LOGIC
    |
    v
LLM WRITES THE WORDS
    |
    v
TTS SPEAKS THE WORDS
    |
    v
WEBSITE/BROADCAST DELIVERS THEM
```

Do not move factual responsibility upward into the AI layers.

Keep the backend authoritative.

Keep the architecture simple.

Optimize for a free 2-OCPU / 12-GB ARM server.

Use FPL as the source of truth wherever possible.

Persist only private league knowledge and useful history.

Make the website work before building video streaming.

Make text commentary work before optimizing voice.

Make event-triggered commentary work before attempting continuous podcast-style commentary.

The project's success criterion is not architectural sophistication.

It is this:

During a real Premier League matchday, a member of the Seks Telecom League can open the website, see the private fantasy league changing live, and hear an AI commentator intelligently and entertainingly describe what is happening as though the fantasy competition itself were a live sporting event.
