# Frontend architecture

The frontend uses React, TypeScript and Vite with same-origin, cookie-authenticated
HTTP and SSE. The seven-step refactor is recorded in [frontend-refactor.md](frontend-refactor.md).
Appearance, route URLs, backend contracts and the supported workflows remain compatible.

## Routes and session ownership

`src/app/App.tsx` loads the authentication session, resolves a route, and mounts the
screen for that route. `routes.ts` is a pure access/route resolver; `useBrowserNavigation`
owns push/replace history and back/forward updates. The URL owns page selection.
Public/pricing/legal pages are available to signed-in users as well as guests.
`/pay?_ptxn=…` is a public Paddle payment-link page and opens independently of the
account session request. The billing feature loads only the browser-safe token, validates
the link and initializes Paddle once per document. Paddle opens the existing transaction;
server webhooks remain authoritative for entitlement changes.

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
| `features/billing`        | Checkout, owner subscription management, price previews and shared billing contracts        |
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
4. `broadcastPlayback.ts` owns an atomic displayed snapshot, pending target and guarded
   transition ID. `useBroadcastPresentation` receives queue/focus requests and keeps
   newer state behind the event gate. Automatic changes enter `covering`, commit at
   `covered(id)`, then enter `preparing`; `settled(id)` opens the gate. Manual requests
   invalidate the previous ID and synchronize immediately. Initial entry prepares under
   a cover. Old completion callbacks cannot replace a newer manually selected scene.
5. `useSceneTransition` owns local DOM refs, measurement and the actual WAAPI lifecycle.
   Empty CSS intro slots establish source rectangles; `broadcastRevealGeometry` calculates
   uniform inverse transforms from the real text elements' final boxes. Those same nodes
   hold centrally, then fly to identity transforms without copies or a typography handoff.
   The fullscreen frame owns the wipe and backdrop, including over its controls and
   commentary; the embedded demo confines them to its own frame. Cover/uncover use
   a 480 ms core plus three pieces moving at different paces (up to 648 ms). The
   wipe travel includes the measured skewed-piece extents, keeping every piece off screen
   during text landing. The wipe title holds for 360 ms, the central names/scores hold
   for 360 ms and their text flight takes 780 ms. A reducer reveal counter alternates product/league
   titles independently of manual selections; the live page reads league identity
   through the existing registered-leagues query. Stacked
   portrait introductions fly directly to their final cells; overlap during travel is allowed.
   Completion follows animations, not parallel timer guesses. Introducing/landing are driver attributes;
   the data reducer stays in preparing until settlement. Resize, font changes, visibility,
   reduced motion and unmount cancel effects and settle or dispose the transaction.
6. `BroadcastMatchday` selects H2H/total-points presentation and owns the shared player
   dialog, including league context and focus recovery. Both scenes use `BroadcastFrame`,
   `BroadcastSquad`, `BroadcastEventRail` and the labeled `LiveStandings` table. Each
   manager/player instance mounts once across responsive modes. The public demo uses the
   same presentation/transition code inside an unscaled responsive container, with its own
   deterministic frame source. Its explicit desktop layout bypasses compact container
   rules, and public-scoped sizing fits the full pitch into the 16:9 preview. The
   decorative tilt is temporarily neutralized for synchronous geometry reads and
   restored before paint, so animation vectors remain in local CSS coordinates.
   Public layout remains owned by the public feature.

`usePlayerNotification` supplies the same notification/counting state machine to pitch
and bench players. Pending deltas keep player points frozen until reveal; active events
count their combined delta, then retain labels for the exit animation. Named point
changes expand beneath the real player name/points metadata; compact labels are centered
at rest and animate upward as notifications expand, returning as they collapse without
changing row height. Event glow belongs to the metadata
and jersey shape, not the whole player button. A squad ResizeObserver fits desktop
jersey height to the available formation rows; compact jerseys extend beyond their image
slots without increasing row height. Idle snapshots omit historical
events, preventing their deltas from being subtracted again during idle rotation. `useBroadcastAudio` sounds each event once when its presentation gate opens and the
event belongs to the displayed focus. Shared sound helpers serialize narration and release
audio/object URLs on completion or cancellation.
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
Shared player metadata/shirt styles serve league squads; broadcast player styles are
scoped to the broadcast feature. Compact broadcast rules no longer live in administration CSS.
Checkout copy lives in JSX; CSS controls presentation rather than replacing product text.

Client experiences are checked at phone portrait, short phone landscape, tablet, laptop,
desktop and TV sizes. Compact H2H broadcasts keep both full squads below the score.
Portrait live broadcasts use two aligned 15-player columns, short landscape uses three
columns of five rows per club with jerseys beside the labels, and wide stages use
opposing formations with bench rails.
Container queries also adapt the embedded demo. Full-fit checks cover 360×640, 375×667,
390×844, 430×932 and short landscape; smaller/zoomed/oversized-squad cases allow a readable
scrolling fallback. Commentary occupies a reserved rail with full text/events in a bounded
dialog; all standings rows are available in their own table scroller. The welcome demo is
hidden on narrow layouts where it cannot remain legible.
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

## League workspace design

The customer workspace uses the public site's plum palette with league-scoped styles.
`LeagueDetailPage` owns identity, broadcast availability and owner actions. Its owner menu
opens `/league/subscription?leagueId=…`; followers can remove their own registration.
Billing mutations and payment previews belong to `features/billing`, and administration
composes `BillingRefunds` for payment review and manually approved refund submissions.
The backend owns entitlements, effective dates and refund balances. See
[subscription management](subscriptions.md) for lifecycle rules and Paddle setup. Availability
request failures stay local so that league data remains usable. The existing broadcast
opening mutation still gates navigation and initializes sound from the user gesture.

`LeagueStandingsOverview` owns accessible tab composition and derives selection from the
URL. Optional `view`, `entryId` and `week` query parameters preserve copied links, refresh
and browser history; unsupported values fall back to a valid view/club/gameweek. League
changes remount the detail page and clear local filters. Club links in standings and
matchups use the existing app navigation for ordinary clicks, preserving the loaded league
data. Their anchor URLs still support copying links and opening another tab. `LeagueStandingsTable`,
`LeagueTeamsView` and `LeagueMatchupsView` own their presentation independently.

`LeagueInsightsView` adds the URL-addressable Insights tab. `leagueInsights.ts` derives
unique owned-player leaderboards, raw squad output after recorded substitutions and
H2H league-rank versus cumulative-fantasy-rank comparisons. Ties share scoring ranks;
missing stats stay unavailable. Squad output deliberately excludes captain multipliers,
chips and transfer costs and is labelled accordingly. Season player stats come from
FPL bootstrap totals; Draft players are matched to Classic stats by shared player code,
never by their different game IDs. Current ownership does not imply historical ownership.
Draft ownership matches `league_entries[].entry_id`; standings reference the separate
`league_entries[].id`. Both Insights and Teams use the entry ID to resolve squads.
There are no predicted win probabilities or claims of expected league points.

Standings keep all supplied ranks in one table, with separate H2H league/fantasy totals.
Teams select the first ranked valid club by default, without implying ownership; narrow
screens use a club picker and player roster instead of compressed shirt grids.
League/club/gameweek pickers share `LeagueSelect`, a native dialog with viewport-bounded height,
internal scrolling and keyboard navigation. Opening and closing animate together with the
backdrop; selection waits for the exit to finish, and reduced-motion mode closes immediately. `shared/ui/useDialogMotion` and
`dialog-motion.css` provide the same behavior for player details in league and broadcast
views, including cancellation when a modal unmounts. This keeps selection panels inside the page
in browser mobile emulation as well as narrow and short screens.
Missing live player data shows unavailable points rather than a confirmed zero. Matchups
navigate only returned gameweeks; final status requires the supplied finished flag.
The Classic adapter does not establish final status. Player dialogs remain shared with
broadcasts; league-specific visual changes are scoped beneath the customer shell.
