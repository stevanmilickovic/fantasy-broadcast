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
detail, league management or checkout page. A successful league-list response
redirects inaccessible detail/management routes; it must not displace explicit list,
checkout visits. The list has useful zero-, one- and many-league states.
Account settings and the authenticated `/account-deletion` deep link are owned by
the account feature and do not query leagues. The shared legal footer has no deletion action.

Discovery lives at `/leagues/find`; `/leagues/new` is a focused registration-by-ID form.
Old registration URLs carrying search/page parameters redirect to discovery. The submitted
search and pagination belong to the URL; clearing the draft immediately replaces the URL
with an unfiltered first page. History changes synchronize the draft without remounting
its input. Discovery remains usable when registration eligibility cannot be loaded.
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

`shared/ui/NotificationProvider` owns bottom success/information/error messages above
route content. `App` keys it by account ID, retaining notices across routes while clearing
them on account changes. `useNotifications` emits bounded, deduplicated messages; success
expires unless hovered/focused, errors require dismissal. The host uses `visualViewport`
and exposes `--notification-space` for controls that need unobscured scrolling space.
Registration notices follow server confirmation and consume a session-scoped completion
marker so refreshing or revisiting the confirmation URL does not announce it again.

`features/auth/AccountSettings` edits the existing account display name through `/api/auth/me`.
The client refreshes its identity and the backend refreshes active session copies.
Usernames are unique under Unicode NFKC normalization and locale-independent lowercase;
the database enforces a binary canonical key. Generated defaults get a suffix on conflict;
manual conflicts return 409. User IDs remain the identity used by chat and memberships.
`PasswordSettings` loads the authenticated database-backed password capability and uses
the shared password input for current/new/confirmation fields. Google-only accounts
receive provider security guidance. Change/reset clears client identity and returns to
sign-in with a one-time bottom notice, preserving the server's session invalidation.
The recovery screen explains Google recovery generally without identifying the provider
for an entered email. See [password security](password-security.md) for server limits.

Chat and membership DTOs expose usernames and IDs without account emails. Administrative
user lists omit emails too; league/billing ownership labels use usernames and IDs.
Customer Draft overviews allowlist upstream display fields. FPL errors do not forward
upstream response bodies to browsers.

League owners manage privacy and follow requests through `LeagueMembershipSettings` on
`LeagueManagementPage`, alongside `LeagueSubscriptionSettings` for billing. Pending/rejected
requests live separately from approved `league_registration` rows. Request lists appear only
in league management; registration search retains the pending status for each league. An
owner/admin badge beside the league action menu shows the number of pending requests and
refreshes while visible and on focus. Existing followers retain
access when a league becomes private. Switching back to public approves pending requests.

`features/chat/LeagueChat` and `useLeagueChat` own plain-text messaging, bounded history,
send retries and expiry. The Chat tab works without an FPL overview. The backend checks
access on every chat request, resolves current author identities, rate-limits sends and
excludes messages at the 24-hour boundary. Clients use server time for expiry and poll
while chat is open and visible, with backoff. Sends retain a retry ID until successful.

`BroadcastChat` mounts beside broadcast presentation, preserving an open chat through
scene changes. Its native dialog handles focus and Escape; `visualViewport` keeps the
composer above mobile keyboards. Scrolling into history removes the fade. The floating
button has reserved space beside the commentary rail.

`shared/api/http.ts` provides the same-origin request boundary and `HttpError` with
status and backend detail/message. Feature APIs own paths and response contracts.
Queries supply a stable loader and a resource key to `useQuery`. Key/revision changes
abort the previous request and hide data from the previous resource. Loading, success
and error are explicit states. `refresh` starts a new revision.

`useMutation` permits one active submission per hook, passes its abort signal to the
operation, and suppresses results after cancellation. Unmounting cancels the request;
reset cancels it and clears its state. Independent forms use independent mutations.
Checkout creates the selected STANDARD or AI_BROADCASTER payment only after valid
league data, checkout readiness and policy consent. Plan buttons remain actionable
before consent and guide to missing prerequisites. Consent guidance highlights/focuses
the checkbox and reserves clear space above the bottom notification. Accepting consent
does not automatically create a payment. The payment SDK belongs to billing.
Purchase submission remains pending until the SDK reports closure, completion or an
opening error. Closing preserves the form and restores focus after controls re-enable;
route exit, browser Back and abort close the overlay and remove event subscriptions.
Transaction event filtering and one-shot settlement prevent abandoned or close-after-
completion events from overriding the current purchase. Existing backend reservations
reuse valid pending transactions. Automatic `/pay?_ptxn=…` links retain their separate
provider-driven opening flow.
Successful registration checkout returns to a confirmation view with the purchased FPL
league ID and type. It polls the authenticated league list for up to a minute, then
opens that league once server-side payment confirmation enables it. Delayed confirmation
and request failures offer a retry without starting another payment.

## Broadcast data and playback

League owners manage per-team PNG emblems in `LeagueEmblemSettings` on the league
management page. `TeamEmblemProvider` loads one metadata list per mounted league;
`TeamEmblem` reuses each versioned image URL in league tabs and broadcasts, including
the existing team-name reveal animation. Draft entry IDs and broadcast manager IDs
are mapped separately because FPL uses different identities for those views.
Matchup emblems remain inside their team links but are positioned at the outer edges,
centered against the full club box. Broadcast emblems have independent reveal slots:
large at the outer ends on wide screens, stacked around names and scores in portrait,
then landing beside the full club identity. Names may overlap the emblem slightly
during wide reveals; the same image nodes and cached URLs are reused throughout.
On phone matchup cards and compact broadcasts, resting emblems are enlarged and
half-cropped at the outer edges, behind the club text. Broadcast introductions still
show the full emblem before landing in that cropped position.

The backend validates actual PNG content, a 5 MB upload limit and decoded dimensions
before processing. It preserves transparency, fits images within a 512-pixel square,
strips metadata and reduces dimensions further if needed to fit 200 KB. One image
per team is stored in MySQL and replaced in place; league deletion cascades. Images
require league access and use private browser caching with a versioned URL and ETag.
No image bytes are embedded in overview JSON or live SSE updates.

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
count their combined delta, then retain labels for the exit animation. Grouped point
changes list their event names separated by commas, with ellipsis before the unshrinking
points total. Broadcast squads and league teams share `shirtUrlFor`: goalkeeper kits use
the `_1` image variant of the same cached club code. Existing FPL data-cache lifetimes
remain unchanged; regular and goalkeeper images share the preload path and normal HTTP caching.
`FplPlayer.availability` carries status, current/next-round playing chance and news from
the already-cached Classic/Draft bootstrap responses. Broadcast `PlayerView` keeps this
separate from its match status and preserves it during automatic substitutions. The same
metadata reaches league teams and the existing player-details endpoint, without extra
upstream requests or a change to cache lifetimes.

`shared/fpl/availability.ts` supplies the common warning rules: yellow for a 75% playing
chance, orange for 50%/25%, red for unavailable/injured/suspended players or 0%. The next
round takes precedence, falling back to this round when absent; the modal labels the
round explicitly. Available players with blank percentages keep normal styling and show
Available without an invented 100%. Numeric probabilities and FPL news appear only in
player details; cards use warning colors and nonnumeric accessible status labels.
Broadcast name/status/points labels form a continuous warning strip; league teams color
only the name, keeping their separate points badge neutral.

Named point changes expand beneath the real player name/points metadata; compact labels are centered
at rest and animate upward as notifications expand, returning as they collapse without
changing row height. Event glow belongs to the metadata
and jersey shape, not the whole player button. A squad ResizeObserver fits desktop
jersey height to a four-row formation; denser formations extend beyond the pitch instead
of shrinking every jersey. Compact jerseys extend beyond their image
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
The matchup/club strip scrolls slowly back and forth with a pause at each end. Hover,
keyboard focus and touch interaction pause it; reduced motion disables automatic scrolling.
Its scrollbar appears on desktop hover/focus and stays hidden on compact/touch layouts.
The homepage opts out of Chromium auto-darkening while painting its own dark palette.
Samsung Internet's forced dark mode can ignore website color declarations; the browser's
"Use website dark mode" setting is outside the app's control.
Administration targets desktop operators. Preserve reduced-motion treatment and keep
essential controls, current scores and commentary readable at every supported size.

## Verification and intentional limits

Run the commands in [frontend/README.md](../frontend/README.md). Unit tests live beside
code; browser workflows and deterministic API fixtures live in `tests/browser`.
Type checking covers application code, configurations and browser tests. Version-tag
releases run formatting, lint, unit tests and the production build once, then package
the checked outputs into container images. Browser and responsive screen tests run
only on demand through the manual browser workflow or the local test command. They
exercise the built production bundle using a preview server, not a development-only
entry point.

Mocked browser coverage verifies client orchestration, rendering and interaction. It
cannot verify backend authorization, mail delivery, a Paddle transaction, actual audio
output or OS wake lock permission. Exercise those integrations against a configured
backend when changing their contracts or releasing them. No backend API or npm dependency
versions were changed by this refactor.

## League workspace design

The customer workspace uses the public site's plum palette with league-scoped styles.
`LeagueDetailPage` owns identity, broadcast availability and owner actions. Its owner menu
opens `/league/manage?leagueId=…`; existing `/league/subscription` links redirect there.
Followers can remove their own registration.
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
Classic matchups include the current gameweek and the five latest finished gameweeks;
their final status comes from the bootstrap event's finished flag. H2H standings show
up to five completed results in a separate Form column, oldest to newest, excluding unfinished
matchups and unavailable scores. Player dialogs remain shared with
broadcasts; league-specific visual changes are scoped beneath the customer shell.
