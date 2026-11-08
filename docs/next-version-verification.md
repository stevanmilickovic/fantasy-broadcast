# Next-version testing handoff

The requested changes are implemented. Following user acceptance, the coordinated
version is **1.4.1**, including the preview/live-outline hotfix. No release tag or production deployment was made. The implementation
and acceptance checks below ran before the version-only update. The local rebuilt application is available at
<http://localhost:5173>.

The 1.4.1 hotfix keeps a balanced mix of live/completed preview players and disables the
circling effect on the homepage. Broadcast outlines follow the name/points panel and
expanded updates, with reduced-motion support. Frontend checks pass with 99 unit tests;
the final 48 affected browser checks pass across six viewports, following 84 passing
outline-expansion/presentation checks. Physical-phone appearance remains unverified.

## Acceptance-test follow-up

The user's first testing pass is addressed without a version bump:

- Removed Selected plan labels and the checkout step list. Bottom notices animate in
  and out while preserving checkbox clearance, keyboard positioning and reduced motion.
- Split player details into current gameweek, upcoming fixtures and history tabs.
  Each current result sits immediately above its point breakdown, with scheduled
  dashes/status and home/away ordering. Removed schedule explanations and fixture times.
- Live form includes the provisional current result and follows score corrections;
  ordinary FPL form continues to show completed results.
- League views reuse active broadcast calculations through a separate membership-only
  SSE feed. No broadcast is opened and no paid viewer slot is used. Stopping the
  broadcast, losing the connection or receiving an incomplete projection restores
  cached polling. Hidden/unmounted views stop their transports.
- Opening a saved league and returning to My leagues preserves the document and app
  navigation; modified clicks still support opening links in another tab.

Checks: 171 backend tests (also passed during Docker packaging), frontend formatting,
lint, 98 unit tests and production build. The isolated integrated stack verified real
FPL gameweek-10 updates for 14 managers, equality with broadcast scores, REST snapshot
reuse, a subsequent poll update, stream shutdown and cached fallback after schedule
removal. It sent no external mail and made no payments. The final full responsive browser
suite passed **685 checks, with 41 intentional skips and no failures** across six
viewports. The earlier run exposed animation timing sensitivity under concurrent Docker
build load; the immediate cleanup assertion now waits for asynchronous cleanup, and the
complete repeat passed. Phone and desktop screenshots were inspected. Physical-phone
and production-provider checks below remain acceptance checks. The normal rebuilt stack
is healthy at localhost:5173; the disposable verification stack and volume were removed.

The final acceptance corrections remove the password-session helper paragraph and give
player details one scrolling tab panel, a taller viewport-bounded dialog and background
scroll locking. Frontend checks pass; 48 affected browser checks pass across six viewports,
including long histories, narrow phones, short landscape and focus/scroll restoration.

## Initial implementation evidence

Verification performed on 2026-11-08 with Node 22.12.0 and MySQL 8.4:

- Backend: 169 tests pass, including the default Docker build's test/package gate.
- Frontend: `npm run check` passes formatting, lint, 93 unit tests and production build.
  Existing formatting violations were normalized to make the full required gate pass.
- Full responsive browser suite: **679 passed, 41 intentional skips, no failures**.
  The suite uses a fresh production build and six projects: phone portrait, short phone
  landscape, tablet, laptop, desktop and TV, with additional narrow-phone cases.
- Rebuilt the existing local testing stack without replacing its database volume.
  All three migration-019 changes applied successfully and services became healthy.
- Started a separate fresh database and integrated stack. Registration verification
  and password mail were captured by a local SMTP sink, with no external delivery.
  Verified generic recovery responses, trusted-Origin rejection, current-password
  validation, change/reset, consumed and revoked reset links, old-password rejection,
  cookie clearing and invalidation of multiple existing sessions.
- Verified real authenticated private-league request/approval, concealed access before
  approval and after removal, requesting access again, account-deletion requests, and
  absence of the customer's email from other-account/chat/league DTOs.
- Read the official FPL source through the integrated backend: Draft league 4,
  gameweek 10, 14 managers, `PROVISIONAL` status, with scores and standings available.
  Player details returned the current fixture and five upcoming gameweek groups.
  This checks real source mapping and response contracts; it does not establish
  correctness during an actively changing match.
- Restored the pre-upgrade local database dump into a separate disposable database.
  Account identity count and digest matched the upgraded database; the restored copy
  lacked migration 019 while the fresh and upgraded active databases had all three
  changes. No existing account names were changed.

Transient logs and sanitized integration summaries are under ignored `backend/target/`;
the pre-upgrade local dump is `backend/target/curation/fantasy-broadcast-before-next.sql`.
It contains private data and must remain outside source control. The disposable stack
and SMTP sink are removed after verification; the normal testing stack remains running.

## Checks to complete before release

1. On physical Android Chrome and Samsung Internet, check ordinary taps versus
   long-press selection in My leagues, league views and inputs. The reported selection
   problem was not reproduced; touch emulation alone cannot prove native behavior.
   Check notifications and the highlighted consent checkbox with the keyboard open,
   browser chrome visible and the phone rotated.
2. On those browsers, dismiss Paddle checkout with its X, reopen it, use browser Back
   and return from internal checkout steps. Real Paddle sandbox SDK X-close/reopen
   passed twice on both phone touch emulation and desktop during step 8; its unpaid
   transaction was canceled. Complete a sandbox payment and delayed-webhook smoke test
   against the configured deployment before release. No live charge was made here.
3. Verify registration, recovery and change notifications with the deployed SMTP
   provider, including spam-folder/delivery behavior. Local SMTP capture proves the
   application flow, not external delivery. Exercise a configured Google-only account;
   provider-aware behavior is covered by automated tests, not a real OAuth sign-in here.
4. During an active FPL match, compare player points, calculated manager totals,
   current matchups and optional live standings with the source, then check final
   reconciliation. Deterministic tests cover late updates, corrections, Classic/Draft,
   captaincy/chips, substitutions, transfer hits, custom starts, doubles, blanks and
   incomplete baselines. Live values remain provisional until FPL settles the week.
5. Follow the [coordinated rollout and recovery procedure](production-deployment.md#coordinating-the-next-username-migration)
   against a recent production backup. The user has authorized the coordinated 1.4.0
   version update; tagging, publishing and deployment remain separate release actions.

## Suggested user walkthrough

Start signed out with Get started, sign in or register, and continue to registration.
Check My leagues, discovery with a long result name, clear its search and refresh,
request a private league and approve it from its owner account. Save a username and
check the notification; send chat messages and inspect the response for email fields.
Open a league, confirm/cancel removal, switch official/live standings and open player
fixtures. Check upcoming/live/completed players in a broadcast, including injury colors
and reduced motion. Finish with account settings, password change, sign-in recovery and
the account-deletion request screen. Use sandbox billing for checkout checks.
