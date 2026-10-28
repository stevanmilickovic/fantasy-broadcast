# Frontend refactor

Status: all seven steps completed and independently validated.

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

## Step 6

Replaced App.css with feature-owned styles and shared layout, branding, footer and
player primitives. App's stylesheet entry records the cascade order; responsive rules
remain beside their features. Removed 166 obsolete selectors, unused animations,
template icons, unused helpers/types and obsolete broadcast route/reset branches.
Scene contracts have a dedicated module. Removed all stylesheet `!important` overrides.
Checkout now renders its existing visible plan copy directly in JSX instead of hiding
different text and replacing it with CSS-generated content; appearance and plan IDs
remain unchanged.

Validation: 69 temporary browser comparisons against the original stylesheet passed
before the checkout markup cleanup; 63 unchanged-markup comparisons passed afterward.
The comparison checked layout, typography, colors, spacing and control styles across
routes and six viewports. Formatting, lint, type checking, all 30 unit tests and the
production build pass. Thirty-three browser workflow checks pass; three mobile/tablet
administration cases are intentionally skipped because administration targets desktop.
Reviewed broadcast, checkout and league-team screenshots. CSS output decreased from
105.66 kB to 91.31 kB. Browser coverage includes public navigation, login/recovery,
league selection/standings/matchups/teams, player dialogs, checkout consent and desktop
administration, with mocked APIs.

## Step 7

Added `npm run check` for formatting, zero-warning lint, unit tests, type checking and
production build. Formatting now includes browser tests, frontend documentation and
workflow YAML; type checking includes browser tests and Vite/Vitest/Playwright configs.
Recorded the Node 22 runtime in `.nvmrc` and the package engine requirement without
changing dependency versions.

Added a reusable frontend CI workflow for pull requests and manual runs. Container
publication calls it and waits for all checks, including Chromium smoke tests, before
building or publishing images. Browser checks now exercise the production preview
bundle with bounded CI workers, failure traces/screenshots and artifact upload. Added
registration/verification/reset, sign-out, loading/error/empty-state and streamed-score
queue/scene/unmount coverage across all six client viewport projects.

Replaced the frontend template README with development/validation instructions, added
`frontend-architecture.md`, and repaired moved source links in the mobile handoff guide.
The architecture documents feature ownership, query/mutation lifetimes, session
boundaries, playback timing, snapshot rules, style ordering and integration limits.

Validation: a clean lockfile install and `npm run check` pass with Node 22. All 30 unit
tests and 51 production-preview browser checks pass; three administration checks are
intentionally skipped on phone/tablet. The final browser run used CI worker/retry
settings with the installed Chrome. Workflow YAML and local documentation links were
validated. Hosted GitHub Actions execution and backend/payment/mail/audio/wake-lock
integrations were not exercised locally; these limits are documented in the guide.
