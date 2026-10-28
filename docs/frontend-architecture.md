# Frontend architecture

The frontend uses React, TypeScript and Vite with same-origin, cookie-authenticated
HTTP and SSE. The seven-step refactor is recorded in [frontend-refactor.md](frontend-refactor.md).
Appearance, route URLs, backend contracts and the supported workflows remain compatible.

## Routes and session ownership

`src/app/App.tsx` loads the authentication session, resolves a route, and mounts the
screen for that route. `routes.ts` is a pure access/route resolver; `useBrowserNavigation`
owns push/replace history and back/forward updates. The URL owns page selection.
Public/pricing/legal pages are available to signed-in users as well as guests.

`features/auth/useAuthSession` owns the signed-in user and sign-out. `useAuthForm`
models login, registration, email verification, recovery and password reset explicitly.
Protected pages redirect guests to login. Administration requires the ADMIN role.
Broadcast league IDs must be positive safe integers; a global broadcast requires ADMIN.
Backend authorization remains authoritative.

`CustomerDashboard` queries the user's leagues and composes the picker, registration,
detail, checkout or account-deletion page. A successful league-list response redirects
only list/detail routes; it must not displace checkout or account-deletion deep links.
A detail page remounts when its league changes. A broadcast remounts when either its
user or league changes, isolating event IDs, queued snapshots, timers, audio and SSE.

## Feature boundaries

| Owner                     | Responsibilities                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| `app`                     | Route access, navigation, session-aware screen composition and style import order           |
| `features/public`         | Welcome/demo, pricing and legal pages; deterministic demo fixtures                          |
| `features/auth`           | Session and authentication workflows, account deletion request                              |
| `features/leagues`        | Registration/search/follow, league switching, owner deletion, standings, teams and matchups |
| `features/billing`        | Abortable league preview, policy consent, explicit plan selection and Paddle checkout       |
| `features/administration` | Independent league/user registries, scheduling, discovery and broadcast controls            |
| `features/broadcast`      | Live transport, event queue, focus rotation, playback snapshots and scenes                  |
| `features/players`        | Player-details dialog, current points/history and its API contract                          |
| `shared/api`              | HTTP errors, query lifetimes, duplicate mutation protection and cancellation                |
| `shared/fpl`              | Shared FPL contracts, shirt loading and club matching                                       |
| `shared/ui`               | Public header, legal footer, shared layout/branding/player styles                           |

API functions and response types live beside their feature. Shared FPL types remain
in `shared/fpl/types.ts`. Customer league presentation uses `leagueData.ts` to normalize
Classic data and derive league views. Administrative discovery retains its own operator
view; customer pages do not depend on administration rendering. Administration invokes
broadcast API actions, while broadcast scenes never own administration state.

## Requests and asynchronous state

`shared/api/http.ts` provides the same-origin request boundary and `HttpError` with
status and backend detail/message. Feature APIs own paths and response contracts.
Queries supply a stable loader and a resource key to `useQuery`. Key/revision changes
abort the previous request and hide data from the previous resource. Loading, success
and error are explicit states. `refresh` starts a new revision.

`useMutation` permits one active submission per hook, passes its abort signal to the
operation, and suppresses results after cancellation. Unmounting cancels the request;
reset cancels it and clears its state. Independent forms use independent mutations.
Checkout calls the selected STANDARD or AI_BROADCASTER plan handler only after valid
league data, checkout readiness and policy consent. The payment SDK belongs to billing.

## Broadcast data and playback

The live pipeline has separate owners:

1. `useLiveState` loads the initial snapshot and subscribes to named `live-state` SSE
   events. Every event contains a complete snapshot. Once SSE has supplied a state,
   a late HTTP response cannot replace it. It normalizes optional collections, reports
   interrupted/malformed updates, and aborts/closes both transports on unmount.
2. `useBroadcastEventQueue` deduplicates event IDs for the mounted session, groups them
   by matchup (H2H) or manager (total-points), ranks pending groups by absolute point
   change, and retains at most three pending groups. An active group keeps its own
   immutable live-state snapshot for ten seconds. Scene transitions defer the next
   group's start. Voice narration suppresses groups containing only AUTO_SUB events.
3. `useBroadcastFocus` resolves manual selection or event-driven focus. In Multi mode,
   inactivity rotates least-recently-shown scenes and periodically shows the leaderboard.
   Normal rotation waits 60 seconds and four idle transitions; comprehensive mocks use
   four seconds and one transition. Manual selection suspends automatic rotation.
4. `broadcastPlayback.ts` owns pure presentation transitions and total-points snapshot
   staging. `useBroadcastPresentation` schedules the wipe/reveal and freezes updates
   until the corresponding notification can be shown. A scene swaps at the 800 ms
   midpoint of a 1600 ms wipe; its reveal finishes 1900 ms after the swap. The initial
   scene reveals without a wipe. Manual H2H focus changes synchronize immediately.
5. `useBroadcastMeasurement` owns DOM refs and reveal geometry for the displayed scene.
   It measures headings/scores and observes viewport/element resizing. It does not choose
   scenes, queue events or schedule playback. Reveal-copy components own their typography
   and text bounds; those measurements stay separate from the playback reducer.
6. `BroadcastMatchday` selects `HeadToHeadScene` or `TotalPointsScene` and owns player-dialog
   selection. Scenes compose selectors, pitch/squad views, standings, commentary and
   reveal overlays using contracts from `sceneTypes.ts`. The welcome demo reuses the
   scene renderer with its own deterministic playback and scaled reveal measurement.

`usePlayerNotification` supplies the same notification/counting state machine to pitch
and bench players. Pending deltas keep player points frozen until reveal; active events
count their combined delta, then retain labels for the exit animation. Shared sound
helpers serialize narration and release audio/object URLs on completion or cancellation.
The broadcast session owns narration cancellation. Wake lock is optional and reacquired
when the tab becomes visible; it is released when the session unmounts.

Keep backend score/event facts intact. Browser scene state may delay their presentation;
it must not invent scoring rules or let a newer unrelated snapshot leak through a
queued notification's frozen score.

## Styles and responsive behavior

`index.css` owns global tokens and reset. `app/styles.css` imports shared primitives,
feature styles, then shared branding breakpoints/footer rules in an explicit cascade.
This order is intentional: moving an import can change shared-class overrides.
Feature CSS uses the existing scoped class names and includes its own breakpoints.
Shared player metadata/shirt styles serve both league squads and broadcast scenes.
Checkout copy lives in JSX; CSS controls presentation rather than replacing product text.

Client experiences are checked at phone portrait, short phone landscape, tablet, laptop,
desktop and TV sizes. Compact H2H broadcasts keep both full squads below the score.
The welcome demo is hidden on narrow portrait layouts where it cannot remain legible.
Administration targets desktop operators. Preserve reduced-motion treatment and keep
essential controls, current scores and commentary readable at every supported size.

## Verification and intentional limits

Run the commands in [frontend/README.md](../frontend/README.md). Unit tests live beside
code; browser workflows and deterministic API fixtures live in `tests/browser`.
Type checking covers application code, configurations and browser tests. CI runs the
same checks on pull requests and gates container publication through the reusable
frontend workflow. Browser tests exercise the built production bundle using a preview
server, not a development-only entry point.

Mocked browser coverage verifies client orchestration, rendering and interaction. It
cannot verify backend authorization, mail delivery, a Paddle transaction, actual audio
output or OS wake lock permission. Exercise those integrations against a configured
backend when changing their contracts or releasing them. No backend API or npm dependency
versions were changed by this refactor.
