# Frontend refactor

Implement in seven independently validated commits. Preserve existing appearance,
backend contracts and supported workflows. Document intentional bug fixes.

1. Establish formatting, regression tests and a behavior baseline.
2. Separate routing, session and feature orchestration.
3. Consolidate HTTP contracts, shared FPL data and asynchronous state.
4. Split customer, billing, authentication and administration workflows.
5. Separate broadcast scenes, playback state and animation measurement.
6. Localize styles, remove dead code and finish readability cleanup.
7. Enforce checks in CI and document the final architecture.

## Baseline

- Production build passes. Existing ESLint baseline: 11 errors, 8 warnings.
- Public: welcome/demo, pricing and legal pages.
- Authentication: login, registration, email verification, recovery/reset, sign-out.
- Customer: league list, registration/search/follow, checkout, league detail,
  owner deletion and account deletion request.
- Leagues: Draft/Classic; head-to-head/total-points; standings, teams and matchups.
- Administration: registry, users, broadcast schedules, discovery, mock/live controls.
- Broadcast: deep links, SSE updates, queued notifications, frozen score snapshots,
  manual/automatic focus, leaderboard rotation, narration and wake lock.
- Client viewport checks: phone portrait/landscape, tablet, laptop, desktop and TV.

## Validation

Use targeted behavior tests before refactoring each workflow, followed by formatting,
lint, tests and production build. Existing lint debt is resolved with its owning
feature, without disabling rules. Add browser smoke checks for critical journeys
and viewport coverage. Each implementation commit records its validation here.

## Step 1

Added formatting and unit/browser test tooling. Reformatted existing sources without
intentional behavior changes. Three regression tests pass for navigation, event
deduplication, transition deferral and score snapshots. Production build passes;
the existing 11 lint errors and 8 warnings remain assigned to later feature steps.

## Step 2

Moved screens and hooks into feature folders. App now resolves routes and mounts
independent administration/broadcast controllers. The URL owns page selection;
broadcast sessions remount when the user or league changes. Administration renders
without live data. Fixed the admin Live button, global broadcast reloads, public
pages for signed-in admins, and invalid broadcast IDs. Login redirects no longer
race a second league fetch. Six tests and production build pass; original lint debt
remains in the feature implementations scheduled below.

## Step 3

Split API functions and types by feature, introduced shared HTTP errors and an
abortable query hook, and removed legacy token signatures/props. Consolidated shirt
loading and club matching. Live state now ignores late initial responses after SSE
updates, reports interrupted connections, and cleans up both transports. Eleven
tests and production build pass. New shared modules are lint clean; the original
feature lint findings remain for steps 4 and 5.

## Step 4

CustomerDashboard now composes dedicated registration, detail, checkout and account
pages. League transformations and team/standings views have separate owners.
Authentication uses explicit login/register/verify/recovery/reset states. Checkout
uses explicit plan handlers and abortable previews; removed its unused alternative.
Administration forms use focused hooks with independent queries and mutations.
Mutations reject duplicate submissions and cancel on unmount. Fixed league-list
redirects that displaced checkout/account deep links. Sixteen tests and production
build pass. Remaining lint findings are confined to broadcast code (step 5).

## Step 5

Separated head-to-head and total-points scenes, selectors, standings, player rendering
and reveal overlays. Playback transitions and frozen snapshots now have a pure reducer;
DOM reveal measurement has its own hook with resize observation and cleanup. Grouped
scene animation props and shared the pitch/bench notification state machine. Resolved
all remaining lint findings without disabling rules. Narration cancels active/queued
audio and releases object URLs when the broadcast unmounts.

Intentional fixes: grouped player events count their combined delta (including opposing
signs), exiting notifications retain every label, and total-points notifications update
the club already on screen instead of holding its old score until notification expiry.
Reveal geometry follows viewport resizing. Corrected the event-queue test's stale audio
mock path so it actually isolates sound.

Validation: formatting, lint (zero errors/warnings), type checking, 30 unit tests and
production build pass with Node 22. Twelve Chromium smoke checks pass for both broadcast
modes and manual focus at 390×844, 844×390, 820×1180, 1366×768, 1920×1080 and 3840×2160;
screenshots reviewed. Browser checks use deterministic API/shirt fixtures; they do not
exercise the live backend, actual narration playback or OS wake lock permission.
