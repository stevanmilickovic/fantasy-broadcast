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
