# Next version: identity, navigation and live league information

Status: implementation resumed at the user's request; steps 1–18 are implemented.
One step remains (19): integrated verification and testing handoff, without a version bump.
The user confirms 1.4 is intended but explicitly defers its version-update commit until
after their testing. Keep version 1.3.5 throughout the remaining work.
Current version: 1.3.5. This document changes no application behavior.

Each numbered step below represents one implementation commit, including its relevant
tests and documentation. Commit messages are suggested titles. Apply Ponytail in full
mode and the guidelines for each stack. Reuse the existing React/Vite, Spring, query,
mutation, dialog and FPL cache infrastructure; no new UI or state library is needed.

Use the plain imperative commit titles documented in `skills/ponytail/SKILL.md`,
following the existing history, instead of the suggested prefixed titles below.
The user confirms existing usernames have no duplicates: retain existing names,
validate uniqueness when migrating and fail clearly on an unexpected collision;
do not build an automatic duplicate-renaming migration. Future defaults still
receive unique suffixes, and manual names still require uniqueness.

## Implementation progress

- Preparation: committed plan and the existing plain imperative commit-title convention.
- Step 1: removed cross-account emails from chat/membership/admin/billing responses,
  replaced admin labels with usernames and IDs, allowlisted customer FPL payloads and
  removed raw upstream error bodies. Own-account authentication emails remain available.
- Verification for step 1: 136 backend tests pass; frontend lint, 75 unit tests and
  production build pass. Affected phone/desktop browser workflows: 25 pass, 3 expected
  desktop-only exclusions on phone. Playwright Chromium was installed for these checks.
- The full frontend check stops at existing formatting violations across untouched
  files. Changed frontend files are formatted; no unrelated formatting sweep was made.
- Step 2: database-enforced Unicode/case-normalized usernames, preserved existing names,
  generated suffixes across account creation paths, manual 409 conflicts and field feedback.
  Verification: 140 backend tests, four migration/concurrency cases on disposable MySQL
  8.4, two account component tests, build/lint and 12 browser cases across six viewports.
- Step 3: shared accessible bottom notifications for saved usernames and backend-confirmed
  registration, retained across navigation and reset across accounts. Messages are bounded,
  deduplicated, dismissible and keyboard/safe-area aware; repeated completion links are consumed.
  Verification: lint/build and 78 unit tests pass; 24 account/checkout browser checks pass
  across six viewports, plus six keyboard-position cases. Phone/desktop screenshots reviewed.
- Step 4: separate discovery and registration URLs, explicit navigation actions, legacy
  search-link redirects and immediate URL reset on clear without losing input focus.
  Verification: lint/build and 79 unit tests; 24 discovery/privacy browser cases across
  six viewports, with existing pagination/login/checkout workflows also checked on
  phone, short landscape and desktop. Clearing an in-flight search is covered.
- Step 5: Get started enters registration, with validated registration/plan intent through
  login, email verification and per-tab Google redirect/retry. Intent expires after 30
  minutes and is consumed once; ordinary sign-in keeps role-based defaults. The leagues
  list now stays accessible with zero/one/many leagues. Pricing selections reach checkout.
  Verification: lint/build, 86 unit tests, 49 browser checks on phone, short landscape and
  desktop, with two expected desktop-only skips. Provider redirects use mocked browser
  responses here; configured real Google sign-in remains an integration release check.
- Step 6: result rows keep wrapped identity text beside a stable right-hand action,
  with labeled/icon variants for following, requests, opening and pending approval.
  Pending text retains full contrast. Verification: lint/build, 12 layout/approval
  browser cases across six viewports plus six final style checks; phone tests include
  320/360/390px widths. Phone and desktop screenshots reviewed.
- Step 7: available plan buttons respond before consent, guide to the highlighted checkbox
  and explain missing league/billing prerequisites. The notification does not cover the
  checkbox or label; accepting consent does not submit payment automatically. Unavailable
  AI and pending submissions remain disabled. Verification: lint/build, 88 frontend unit
  tests, five backend checkout/consent tests, 60 checkout browser cases and six existing
  registration-entry cases across six viewport projects. Final consent geometry rechecked
  after copy polish, and phone portrait/landscape screenshots reviewed.
- Step 8: purchase checkout remains pending until Paddle closes, completes or errors.
  X dismissal preserves league/type/plan/consent, restores focus after controls re-enable
  and permits reopening. Aborts, route exits and browser Back close the overlay and
  unsubscribe; late events cannot complete an abandoned checkout. Completion still
  waits for backend confirmation, and automatic payment-link flows remain independent.
  The existing backend reuses a valid pending transaction for the same plan and consent.
  Verification: lint/build and 91 frontend unit tests; 60 checkout/payment-link browser
  checks across six viewports. Real sandbox SDK X-close/reopen passed twice each on
  phone touch emulation and desktop, using one unpaid transaction canceled afterward.
  The reported physical-phone failure was not reproduced; actual device testing and
  paid sandbox/internal-step checks remain release checks. No live payment was made.
- Step 9: native removal confirmation names the league and explains chat/private-access
  consequences, starts on Cancel, supports Escape/focus recovery and keeps retryable
  failures in the dialog. Owner/admin management remains available. Destination labels
  consistently use My leagues. Verification: lint/build, 91 unit tests and 54 browser
  removal/approval/registration checks across six viewports pass.
- Step 10: password capability is read from the database at `/api/auth/password/capability`.
  Changes require the current password and 12–200-character replacement; change/reset
  consume outstanding links, invalidate sessions and notify without exposing credentials.
  Google-only accounts cannot acquire local passwords through legacy reset tokens.
  Password writes require a trusted browser Origin. Bounded per-user/email/IP attempt
  limits and a bounded recovery queue keep forgot responses generic despite mail failures.
  Verification: 147 backend tests pass, including seven new endpoint/transaction/security
  tests for origin/session checks, races, expiry, mail failure, provider policy and limits.
  Recovery is queued in-process: restarts can drop undelivered requests; users can retry.
- Step 11: account settings groups username, sign-in/password security and deletion.
  Local-password users have current/new/confirmation fields and password-manager/show
  controls; Google-only users receive provider guidance. Change/reset returns to sign-in
  with a bottom notification. Recovery retains registration intent and login says Email.
  Deletion moved out of the footer; authenticated deep links use the account area without
  querying leagues. Verification: lint/build, 92 unit tests and 54 account/navigation
  browser checks across six viewports pass. SMTP delivery remains an integration check.
- Step 12: inspection found no programmatic selection or broad touch/selection handler.
  Native page/input selection remains enabled. Button/summary labels are non-selectable;
  coarse-pointer links and controls suppress the browser tap overlay, retaining existing
  pressed/focus styling. A real touch-emulation regression passes across My leagues,
  discovery, league detail and account, including search activation and editable inputs.
  Build passes. User identifies Android Chrome or Samsung Internet; exact device/version
  and native long-press handles/Copy behavior remain unverified without a physical phone.
  The original single-tap selection was not reproduced; this is not proof of its cause.
- Step 13: shared ten-second points and thirty-second fixtures/current metadata/lineups,
  real source fetch timestamps, normalized nullable fixture difficulty/time/scores and
  an on-demand gameweek data boundary independent of broadcast/viewer/narration state.
  Broadcast composition now refreshes around rollover instead of staying hourly.
  Draft clubs map by verified code; a sanitized official distinct-player-ID/fixture
  sample is recorded. Clock/coalescing/failure/rollover/partial-data tests cover freshness.
- Step 14: extracted deterministic manager/standings scoring from the broadcast owner.
  Classic captain/chips/transfers and Draft rules are separate; missing data is not zero.
  Substitutions/captain fallback wait for the full gameweek, respect formation/bench
  order and preserve recorded substitutions. Closed-history baselines replace unsafe
  official-current-week subtraction/addition, including restart and phase-start handling.
  Unknown baselines/schedules retain official standings with a reason. Rules checked
  against official FPL guidance. Verification: 163 backend tests pass, including all
  four source/scoring formats, chips, DGW/blank, cards, corrections, ties and restarts.
- Step 15: authenticated membership-only live projection API shares the scorer and
  baseline with broadcasts without payment/viewer/narration requirements. Current
  matchups overlay known scores; standings default to FPL with a URL-persistent Live
  choice. Timestamps/status/reasons distinguish provisional, unavailable and stale data.
  Visibility/focus refresh aborts on hide/unmount, retains values on network failures,
  clears denied data and refreshes the official overview at rollover. Verification:
  frontend lint/build and 93 unit tests; 18 browser live/form checks across six viewports.
  Backend membership and score-projection checks are included in the full suite.
- Step 16: shared player details shows all selected-week club fixtures with local
  timezone, home/away, score/status and FPL difficulty, plus the next five gameweeks
  with doubles/blanks and a separate unscheduled list. Mapping/source failures are
  explicit; missing points stay unknown. DGW point changes receive fixture labels.
  Open dialogs refresh while visible, retain stale details on failure and offer retry.
  Verification: 167 backend tests, frontend lint/build and 93 unit tests; 24 player
  fixture/dialog browser checks across six viewports including Tokyo day rollover,
  long opponents, missing data, reduced motion and focus recovery pass.
- Step 17: fixture progress is independent of availability and derives from club/fixture
  identity in the displayed snapshot. Upcoming players have quieter shirts/surfaces;
  warning hues and readable text remain. Team-live players have a labeled marker and
  restrained metadata-edge pattern, static under reduced motion. DGW-between players
  retain earned points; complete players retain their design. Copies, mocks and demo
  data preserve progress. Verification: 169 backend tests, frontend lint/build and 93
  unit tests; 48 six-viewport progress/availability/presentation browser checks pass.
  Phone screenshots reviewed; queued snapshot tests preserve prior fixture state.
- Step 18: visible workspace navigation marks collection/discovery/registration paths;
  compact saved cards, search-first discovery, a narrower registration form, named
  checkout progression and quiet account sections provide distinct landmarks. Restrained
  neutral/blue/lilac surfaces support text and composition while retaining the plum brand
  and status colors. A customer/admin discovery class collision was removed. Verification:
  frontend lint/build and 93 unit tests; six-viewport walkthrough screenshots plus consent
  and removal regressions pass. Broadcast geometry remains unchanged.
- Steps 1–18 have separate commits. One step remains: 19. Existing-name repair is
  omitted per the user's confirmation. All completed changes have separate commits.

## Product decisions

- Use unique, case-insensitive usernames. Keep `display_name` as the displayed username
  and immutable user IDs as identity. Generate a suffix for conflicting default names;
  reject conflicting names chosen manually with a useful field error.
- Treat email privacy as a backend response contract. A browser may receive its own
  account email, but must not receive another account's email through application DTOs.
  Include owner approval screens and administrative user/league/billing lists in this
  rule; replace their cross-user email labels with username and immutable ID. Internal
  authentication, mail and Paddle processing still need server-side email access.
- Separate **Find leagues** from **Register a league**. Keep `/leagues/new` for
  registration and introduce `/leagues/find` for discovery. Registration links to
  checkout; discovery links to following/requesting/opening an existing league.
- **Get started** starts league registration, including after authentication. Ordinary
  Sign in keeps its existing landing behavior. Explicit **My leagues** navigation
  always reaches the list, even with zero or one league.
- The reusable bottom popup is a non-blocking notification, often called a toast or
  snackbar. Confirmation of a destructive action uses a modal instead.
- Plan buttons remain actionable before consent so they can explain what is missing.
  Consent remains required on both client and server before creating checkout.
  Submitting, unavailable plans and unavailable billing retain their real restrictions.
- Password settings depend on whether a local password exists, not the last sign-in
  method. Google-only accounts manage their Google password with Google; this release
  does not add a separate local credential to those accounts.
- Matchups automatically use valid current manager scores for the current gameweek.
  Standings have an explicit **FPL / Live** toggle, initially FPL. Live means provisional
  calculation from received FPL player points, not prediction of future performance.
- Keep the existing broadcast appearance for completed players. Give upcoming players
  quieter surfaces and live-team players a restrained status treatment. Availability
  warning colors remain independent of match progress.
- Do visual navigation differentiation last, preserving the established plum brand,
  responsive broadcast composition and actual-node reveal animation.

These decisions supersede the duplicate-name/email-disclosure requirements in
`league-privacy-chat-plan.md` and the combined registration/discovery composition in
`frontend-league-design-plan.md`. Update those documents when the corresponding code
lands so their implemented status does not contradict the current product.

## Findings that affect the implementation

- `LeagueChatService.Message` includes `email`; `ChatAuthor` renders it. Removing the
  rendered span alone would leave the disclosure in the network response.
- `LeagueMembershipService.FollowRequest` also includes email, displayed to owners in
  `LeagueMembershipSettings`. Separate admin DTOs expose user and owner emails too.
- Account settings explicitly describe usernames as non-unique. Account creation
  happens through verified email registration, Google sign-in and admin bootstrap.
- `LeagueRegistrationForm` keeps a local search draft, while the page reads the
  submitted term from the URL. Clearing only the draft explains why refreshing can
  restore the previous term.
- Both discovery and registration currently live at `/leagues/new`, with registration
  first. `CustomerDashboard` redirects `/leagues` away from the list with zero or one
  league, so changing only the Back label would leave misleading navigation.
- Get started links to `/register`, and authenticated `/register` falls through to the
  usual landing route. Password login also uses a fixed landing route; Google's
  success handler redirects to `/`. Registration intent needs to survive both paths.
- `LeagueCheckoutPage` disables plan buttons until consent. `openPaddleCheckout`
  handles completion and closure globally, but the purchase page has no explicit
  overlay lifecycle/focus recovery contract. The reported close failure needs a real
  sandbox reproduction before choosing a fix.
- Password recovery, reset tokens, password hashing, session invalidation and account
  deletion requests already exist. Recovery currently finds accounts by email without
  excluding null password hashes, so it can establish a password for a Google-only user.
- League overview reads use the default hourly FPL cache. Only broadcast-specific live
  reads request ten-second freshness. Classic fixtures also use the hourly cache,
  affecting both match status and substitution timing.
- `MockLiveStateService`, despite its name, owns real broadcast scoring and projected
  standings. Reuse its useful calculations through a focused shared owner. Its current
  H2H calculation adds the current result to the supplied total; that requires checking
  whether FPL has already included that result before sharing it more widely.
- `PlayerDetailsModal` already requests player history; the backend already maps Draft
  players to Classic player summaries by player code. Fixtures are not in its DTO, and
  `FplFixture` currently omits difficulty.
- Real broadcast `PlayerView.status` is currently populated as `AVAILABLE`, so it does
  not yet describe whether a football match is upcoming, live or complete.
- Source inspection found no general tap-to-select implementation or `user-select`
  rule explaining the mobile selection report. Browser/device reproduction is needed.

## Commit sequence

### 1. `fix(privacy): remove cross-account emails from browser responses`

Requirements: 1.

- Remove email from chat queries/mappers/DTOs, history and send responses, frontend
  contracts, chat author rendering and fixtures. Both league chat and broadcast chat
  use the same corrected contract.
- Remove requester email from membership DTOs and owner approval UI. Identify requests
  by user ID and username, including users who still have duplicate names until step 2.
- Inventory every outward user-bearing DTO. Replace cross-user email fields in admin
  user lists, league ownership/membership summaries and billing/refund lists with IDs
  and usernames, preserving administration and refund targeting by immutable IDs.
  Do not return a database entity or raw provider customer object as a substitute.
- Keep own-account email in authentication/settings and required internal provider
  operations. Ensure error messages and notification copy do not disclose a different
  account email. Allowlist customer-facing upstream league fields instead of depending
  on entire raw JSON responses remaining email-free, preserving the fields the client
  needs. Update privacy/settings copy and the historical chat plan.
- Add actual JSON serialization/controller tests asserting other accounts' email
  values and fields are absent. Exercise nonmember, member, owner and administrator
  routes, history, polling and send responses; verify ordinary users cannot access
  administrative endpoints. Update affected browser workflows and TypeScript types.

Acceptance: knowing another user's ID or inspecting the network yields no application-
managed account email belonging to that user. This does not promise redaction of email
addresses people voluntarily type into chat, or recall of data already delivered before
this release.

### 2. `feat(accounts): enforce unique usernames across all account creation paths`

Requirements: 1. Depends on 1.

- Define one canonical comparison rule: trim, Unicode NFKC normalization and
  locale-independent lowercase. Preserve readable display casing, and consistently
  validate 1–40 Unicode characters and reject control-only/invalid names.
- Add a database-enforced unique canonical username key with explicit comparison
  semantics matching the application. A preliminary availability query is insufficient
  for simultaneous registrations or edits.
- Add an upgrade migration that repairs existing duplicates deterministically. Keep
  the earliest account's name for each canonical collision; assign `_2`, `_3`, etc. to
  the remaining accounts. Reserve existing distinct names before suffix allocation,
  shorten the base to respect the limit and use a neutral fallback for unusable defaults.
  Do not use a full email as a generated username. Keep user IDs and relations intact.
- Apply the same allocator to final email verification, new Google users and new admin
  bootstrap accounts. Pending registration does not reserve a name indefinitely.
  Handle database uniqueness races with bounded allocation retries and a safe failure.
- Manual edits return 409 for a taken username, keep the entered text and permit saving
  one's unchanged name. Session refresh and subsequent Google login preserve the name.
- Test canonical collisions, suffixes already in use, length/Unicode boundaries,
  concurrent edits/creation, pending registrations, bootstrap and Google re-login.
  Verify migration on fresh and populated MySQL databases as well as ordinary tests.

Acceptance: no two persisted accounts have the same canonical username. Default-name
collisions succeed with a unique generated name; manual collisions explain the conflict.

### 3. `feat(ui): add reusable bottom notifications for confirmed actions`

Requirements: 1 and 8. Depends on 1–2.

- Add a small shared notification provider/host above route screens in `App`, with
  success, information and error variants, dismissal, bounded queuing/deduplication
  and timer cleanup. Keep notifications through normal SPA navigation and clear
  account-specific notifications on sign-out/account change.
- Use polite status announcements for routine success, suitable alert announcements
  for errors, keyboard-operable dismissal and reduced motion. Success can expire;
  actionable errors remain available inline or until dismissed. Do not move focus
  merely to announce success or duplicate the same screen-reader announcement.
- Account settings emits **Username saved** only after a successful response.
  Registration emits **League registered successfully** from the existing
  server-confirmed success callback, before opening the league. Deduplicate effect
  replay/history/reload of completion markers; no success based only on a Paddle
  client event or `payment=completed` query parameter.
- Preserve the existing wait/retry flow for delayed webhooks. Public follow and private
  request outcomes use accurate distinct wording, not a registration-success message.
- Position above safe areas and mobile keyboards. Provide a shared way to reserve
  visible space for the host; checkout must scroll its consent control into that clear
  area so a notification cannot cover the checkbox, label or active control.
- Test successful/failed save, registration confirmation delay and retry, navigation,
  dismissal, duplicate callbacks, long messages, account changes and keyboard-open layout.

Acceptance: success is visible at the bottom after saving a username or completing
registration, survives the relevant navigation and never blocks the next required action.

### 4. `feat(leagues): separate discovery from registration and fix cleared search state`

Requirements: 2 and 4.

- Add `/leagues/find` and a discovery page using the existing search/follow logic.
  Keep `/leagues/new` as the register-by-ID page, with a simple Find leagues link.
  Discovery offers Register a league as a secondary link when permitted.
- Split the current combined form at the actual workflow boundary. Discovery should
  not wait on registration eligibility before displaying search results. Registration
  restrictions keep a useful discovery alternative.
- Point **Find leagues** directly to discovery in all menus. Replace **Add or find a
  league** with explicit Find/Register actions where the two intents are currently
  merged. Preserve old `/leagues/new?search=…&page=…` discovery links with a replace redirect.
- Keep submitted searches URL-addressable and Search/Enter behavior. When the input is
  emptied, including the native search clear affordance, immediately remove the search
  parameter, reset page to zero and reload the unfiltered list. Clearing must work
  during an in-flight request; ignore stale results. Use replace for this reset so
  clearing does not create a trail of empty search entries.
- Keep typing distinct from submission for nonempty drafts. Back/forward synchronizes
  the draft and results with the URL; pagination preserves the submitted term. Remove
  direct `window.location` ownership where route props already provide it.
- Test search → clear without submit → refresh, clear while loading, Enter/Search,
  history, paging, empty results, retries, direct/legacy links and registration closed.

Acceptance: Find leagues opens a search-first page on a phone. A cleared search remains
empty after refresh, and registration/checkout still have direct links.

### 5. `fix(navigation): preserve registration intent through sign-in`

Requirements: 3 and the navigation consistency part of 9. Depends on 4.

- Make Get started on the public header/pricing pages enter `/leagues/new` for signed-in
  users and an authentication flow carrying that destination for guests. Preserve the
  intended plan where a pricing CTA selects one, while still collecting a valid league ID.
- Carry only allowlisted internal destinations through login, email verification,
  switching login/register mode, refresh and Google OAuth round trips. Prefer existing
  navigation/platform storage mechanisms over a general redirect framework. Clear
  consumed intent; reject external/protocol-relative URLs and invalid/stale targets.
- Keep ordinary Sign in and administration landing behavior. Explicit registration
  intent is honored for already-authenticated users, including administrators.
- Remove the zero/one-league redirects from explicit `/leagues` visits. Show a useful
  empty list with Find/Register actions, or a one-card list. This makes **My leagues**
  a reliable destination and prevents Back from returning to the same league.
- Test guests/new users/existing users, zero/one/many leagues, ordinary login,
  verification, Google success/failure, plan intent and malicious return destinations.

Acceptance: Get started reaches registration rather than the user's existing leagues;
My leagues always reaches the league list.

### 6. `fix(discovery): keep mobile league actions aligned and distinguish follow states`

Requirements: 5. Depends on 4.

- Use a two-column result row with a flexible `minmax(0, 1fr)` identity column and
  nonshrinking action column. Wrap long league names within their column; keep the
  action on the right. Let a long action label wrap inside its own bounded button
  when necessary without moving the entire action below the name.
- Style **Follow** as a primary action, **Request to follow / Request again** as an
  outlined request action, **Open league** as a quieter navigation action with an
  arrow, and **Pending approval** as an explicitly labeled inactive state. Use words
  and icons as well as color; retain private/owner information and touch target sizes.
- Keep duplicate-submission protection and existing approval/cancellation semantics.
  New styling must not treat a pending request as an accessible league.
- Check long/unbroken names and every action state at 320/360/390px widths, phone
  landscape, tablet and desktop, including zoom and loading/error states.

Acceptance: names wrap, buttons stay on the right and the next action is evident.

### 7. `fix(checkout): guide actionable plan buttons to missing consent`

Requirements: 6. Depends on 3.

- Remove consent from the condition disabling an otherwise available plan button.
  Clicking without consent highlights the checkbox/label region, scrolls and focuses
  the checkbox, adds a persistent associated validation message and shows a short
  bottom notification. No automatic consent or automatic payment submission follows.
- On acceptance, remove the invalid/highlight state. The user presses the plan button
  again to proceed. Validate the league, service readiness and plan availability on
  attempted action too, explaining a missing prerequisite without issuing checkout.
- Preserve server-verified policy version/consent, plan availability, payment readiness
  and duplicate-submit protection. A genuinely unavailable AI plan stays unavailable;
  errors must not imply that ticking consent enables an unavailable plan.
- Test both plans before/after consent, keyboard operation, invalid league, unavailable
  billing/AI, duplicate clicks and backend rejection of absent/outdated consent.
  Browser-test actual notification/checkbox rectangles in short and narrow viewports.

Acceptance: available plan buttons explain missing consent when pressed; Paddle never
opens or creates a transaction before valid consent and league validation.

### 8. `fix(billing): make Paddle dismissal and reopening reliable`

Requirements: 7. Depends on 7.

- First reproduce the reported X/back issue in real Paddle sandbox on phone and desktop.
  Distinguish the modal X, its internal previous step and browser/device Back; inspect
  whether our page overlays or listeners are interfering. Do not assume which fails.
- Give purchase checkout an explicit loading/open/closed/completed/error lifecycle,
  reusing `initializePaddle` and `onPaddleEvent`. Unsubscribe and close the relevant
  overlay on route exit, abort and unmount without affecting a newer checkout.
- Dismissal restores a usable payment page, its league/type/plan/consent state and focus
  on the initiating button. Reopening must not duplicate listeners or transactions;
  reuse a valid pending transaction where supported by the existing backend contract.
- Handle `checkout.closed` as dismissal and `checkout.completed` as completion, including
  a close event following completion. Keep server webhook confirmation authoritative.
  Leave provider-owned internal navigation to Paddle and use documented SDK methods.
- Preserve `/pay?_ptxn=…` automatic payment-link/payment-update flows. Test their closure,
  reload and completion separately; do not introduce a second automatic `Checkout.open`.
- Add SDK lifecycle/route tests and perform real sandbox close/reopen/internal-back,
  browser-back, canceled and successful payment smoke checks. Do not use real money.

Acceptance: the actual reported failing control works; users can dismiss and safely
reopen checkout, and closing never grants entitlement or shows registration success.

### 9. `fix(leagues): confirm removal and use My leagues consistently`

Requirements: 9. Depends on 3 and 5.

- Use a focused native confirmation dialog with the existing `useDialogMotion` helper.
  Name the league, explain removal of following/chat access, and distinguish it from
  league deletion or subscription cancellation. For a private league explain that
  following again requires approval.
- Provide Cancel and Remove actions, initial focus on Cancel, Escape handling and
  focus restoration. Only confirmation sends the unfollow request; errors retain a
  useful retry and membership is not removed optimistically on failure.
- On success refresh memberships, navigate to My leagues and optionally notify.
  Preserve the owner management path instead of offering an inappropriate owner unfollow.
- Rename the picker heading, league Back link, navigation and related confirmation
  copy to **My leagues** wherever they refer to this same destination.
- Test cancel/Escape, double confirm, server failure, successful removal, private
  re-request behavior, zero/one/many memberships and owner/admin actions.

Acceptance: accidental taps cannot remove a league and the Back destination is consistent.

### 10. `feat(auth): add secure password changes and provider-aware recovery`

Requirements: 11, backend.

- Expose a minimal authenticated capability such as `hasPassword` from database-backed
  account state. It is not a public account lookup, provider-token field or indication
  of which method was used most recently. Refresh session identity contracts as needed.
- Add an authenticated password-change operation requiring the current local password
  and a validated new password. Reuse `PasswordHasher` and the existing password policy;
  enforce request bounds, same-origin/CSRF protection and bounded attempt throttling.
- Update the password and consume outstanding reset tokens transactionally. Reuse
  `removeForUser` to invalidate all sessions, clear the current cookie and require normal
  sign-in again. Notify the account email without logging/exposing passwords or tokens.
- Google-only accounts cannot use this endpoint or password reset to silently create
  a local credential. Check current database capability when issuing and consuming reset
  tokens, including tokens issued before upgrade. Existing accounts that already have
  a local hash retain password functionality regardless of how they originated.
- Preserve the generic forgot-password response for existing, nonexistent and Google-only
  accounts. Add rate limits, preserve single-use/expiry guarantees and avoid turning
  errors/timing into an account/provider enumeration endpoint. Explain Google sign-in
  generally on the recovery page rather than disclosing an entered account's provider.
- Test wrong current password, policy limits, missing session/origin protection,
  concurrency/replay, token expiry, throttling, mail failures and session invalidation.
  Test password-only, Google-only and password-capable accounts also using Google.

Acceptance: password-capable users can safely change/reset credentials; Google-only
users remain provider-authenticated and recovery does not create a new credential.

### 11. `feat(account): centralize password settings and account deletion`

Requirements: 11, frontend. Depends on 3 and 10.

- Organize the existing account settings into username, sign-in/security and account
  deletion sections. Reuse existing form/password controls where that avoids duplication.
- With a local password, show Current password, New password and Confirm new password;
  support password managers, paste, show/hide, validation and pending/error states.
  A successful change shows the notification on sign-in after the required session reset.
- Without a local password, show **You sign in with Google** and a link to Google account
  security. Do not ask for an inapp current password or offer an unexplained reset.
- Keep **Forgot password?** on login and reuse the existing recovery/reset screens.
  Preserve navigation intent across recovery where appropriate; never auto-login on reset.
  Correct the current **Email or username** label to **Email** while authentication
  remains email-based; unique chat usernames do not imply a new login method.
- Move the deletion entry point out of `LegalFooter` into account settings. Reuse the
  existing deletion-request flow and its subscription/review requirements; this is
  not a change to immediate hard deletion. Keep `/account-deletion` working as an
  authenticated deep link within the account area rather than fetching league data.
- Test all credential capabilities, successful/failed change, reset-link states,
  sign-out/re-login, deletion request and keyboard/mobile form use.

Acceptance: users find account/security actions together, login recovery remains usable,
and Delete account no longer appears on every page.

### 12. `fix(mobile): restore native long-press text selection`

Requirements: 12.

- Reproduce the difference on a physical phone with browser/version recorded. Inspect
  whether the reported effect is actual text selection, a tap highlight, focus styling,
  native link preview, or browser text-recognition behavior; fix the observed mechanism.
- Remove any offending selection invocation or overbroad style. Use `user-select: none`
  only for button/control labels when appropriate, and normal native text selection for
  readable text. Keep chat, data, inputs and textareas copyable.
- Do not add a global touch `preventDefault`, custom long-press timer or blanket
  `user-select: none`; those interfere with scrolling, accessibility and native selection.
- Cover My leagues, discovery, league tabs, account, checkout, chat and player details.
  Check tap activation, swipe scrolling, long-press selection, form caret/paste and
  keyboard focus. Use emulation for regressions and real Android/iOS checks for the
  native gesture; report any unavailable device check explicitly.

Acceptance: a normal tap does not select page text, while a long press still selects
ordinary content using the phone's native interaction.

### 13. `feat(fpl): share fresh gameweek points and fixture metadata`

Requirements: foundation for 13–15.

- Extend normalized fixtures with home/away difficulty and sufficient status/time
  fields. Keep fixture IDs and explicit nullable kickoff/score/difficulty values;
  distinguish unknown data from zero, a blank gameweek and an unstarted match.
- Reuse `FplDraftClient`'s per-URL coalescing/cache and real broadcast feeds. Add an
  active-demand freshness policy usable by league pages and player details without
  starting a paid broadcast, allocating a viewer slot or triggering narration.
- Proposed defaults: points refresh at most once per ten seconds per source/gameweek;
  live fixture status/scores at most once per thirty seconds; gameweek/deadline metadata
  refreshes promptly around rollover. Keep long-lived static metadata on the existing
  hourly policy. Expose actual data timestamps/source/completeness, not just response time.
- Share refreshed results across viewers and broadcasts. Refresh current-week lineups
  appropriately when FPL publishes substitutions and new-week picks; invalidate all
  previous-week combinations at rollover. Never combine points from one week with picks
  from another or perform a per-player upstream request each poll.
- Map Draft/Classic player and club identities through verified IDs/codes, not coincident
  numeric IDs or display names. Normalize postponed/blank/double-gameweek fixtures.
- Test cache coalescing and TTLs with a clock, no-viewer/hidden-page demand cessation,
  upstream failures, partial responses, source mapping and gameweek transitions.
  Record representative current upstream payloads as sanitized test fixtures.

Acceptance: current league information can refresh independently of an active broadcast,
with bounded shared upstream traffic and honest freshness/availability metadata.

### 14. `feat(scoring): share correct live manager and standings calculations`

Requirements: 13, backend. Depends on 13.

- Extract only scoring/projection responsibilities needed by both real broadcasts and
  league overviews from `MockLiveStateService` into a focused deterministic owner.
  Keep event detection, polling, narration and presentation orchestration with their
  current owners; this is not a broad broadcast rewrite.
- Establish source-specific contracts using recorded upstream data and current official
  rules before changing formulas: raw versus net gameweek points, what standings already
  include, league start rounds, fixture completion, ranking ties and H2H average/byes.
- Calculate manager totals from valid picks/player points with Classic captain/vice,
  Triple Captain, Bench Boost and transfer deductions, plus Draft's actual rules.
  Reuse recorded automatic substitutions without applying them twice. Project additional
  legal substitutions/captain fallback only when all relevant gameweek fixtures establish
  eligibility; one completed match in a double gameweek is insufficient.
- Calculate total-points standings as a validated closed-week baseline plus the current
  net contribution. Calculate H2H league points from the corresponding closed-week
  baseline plus this week's W/D/L result, with fantasy points/tiebreakers kept separate.
  Do not blindly add current scores or subtract a value whose inclusion is unknown.
- Reconstruct a trustworthy baseline after a midweek deployment/restart using upstream
  history/recorded rounds. Track its gameweek and what official results it includes.
  If it cannot be established, return live standings as unavailable with a reason,
  preserving official data rather than fabricating a projection.
- Pair managers using FPL's actual schedule. Replace stale scores for known current
  pairings; never invent opponents if the schedule itself is unavailable. Handle
  supported average opponents/byes and identify unsupported/incomplete source states.
- Keep incomplete player data distinct from a known zero. Mark projections provisional
  until reconciled; use FPL-provided point categories/bonus rather than predicting BPS.
  Accept negative corrections and late official updates without cumulative drift.
- Add small deterministic tests covering all four Draft/Classic × H2H/points combinations,
  captain/chips/transfer cost, keeper and formation constraints, bench ordering, DGW/blank
  weeks, ties/byes, no data, negative corrections, already-counted official results,
  restarts and convergence after official reconciliation. Run existing broadcast scoring
  and event tests to guard shared behavior.

Acceptance: league pages and broadcasts agree for the same source snapshot; FPL catching
up never adds the same gameweek twice or causes premature DGW substitutions.

### 15. `feat(leagues): show live matchups and switchable provisional standings`

Requirements: 13, frontend and customer API. Depends on 13–14.

- Expose normalized current-gameweek projections through the authenticated league
  overview boundary, including official/live values, source time, provisional state
  and unavailable/stale reason. Retain existing membership checks and historical data.
- Automatically overlay current matchup scores when a complete valid projection exists.
  Mark **Live** during active fixtures and **Provisional** while awaiting FPL settlement;
  distinguish upcoming and final fixtures. Historical/future matchups keep their proper
  recorded/scheduled behavior, and missing schedules get an explicit empty state.
- Add an accessible **FPL / Live** standings control. Default to FPL, keep selection in
  the league URL across tab changes/history and use shared backend results, not another
  JavaScript scoring implementation. Show league points and fantasy points distinctly.
- Refresh while a relevant league view is visible, returning to fresh state on focus;
  abort/stop on hide, account/league change and unmount. Preserve usable official/last
  valid values on failures with an honest stale label, timestamp and retry.
- Test stale official scores versus fresh player points, matching browser/broadcast
  totals, toggle/history persistence, partial data, no active broadcast entitlement,
  rejected membership, correction/reordering, rollover and reconciliation.

Acceptance: current matchups update ahead of FPL's recorded matchup totals when player
data permits, and users can compare official with clearly labeled live standings.

### 16. `feat(players): show current fixtures and upcoming FPL difficulty`

Requirements: 14. Depends on 13.

- Extend the existing player-details DTO with the selected gameweek's fixtures and
  upcoming fixtures. Reuse existing summary/fixture caches and Draft-to-Classic player
  code mapping; avoid an additional upstream request per rendered player card.
- Display every fixture in the selected gameweek with opponent, home/away, local date
  and kickoff time/timezone, current score where known and scheduled/live/final status.
  Group point breakdowns by fixture when a double gameweek makes that useful.
- Show a compact upcoming schedule for the next five gameweeks, preserving multiple
  fixtures and blanks rather than silently skipping them. Put unscheduled/rescheduled
  fixtures in a clearly labeled TBD state. Use FPL's side-specific 1–5 difficulty,
  with a numeric/text label and color; never invent missing ratings.
- Keep existing availability, current points and historical points. Fixtures describe
  the player's club schedule, not a guarantee the player starts or appears.
- Apply through the one shared modal used by teams and broadcasts. Verify long names,
  live score changes, no fixtures, missing mapping/difficulty/time, network failure,
  DGWs, local timezone/day boundaries, dialog scrolling and focus recovery.

Acceptance: the player dialog answers who the club plays this week, when, the score/status
and the difficulty of its upcoming schedule without leaving the application.

### 17. `feat(broadcast): distinguish upcoming live and completed player fixtures`

Requirements: 15. Depends on 13.

- Add fixture progress separate from `availability` to `PlayerView` and all constructors,
  auto-substitution copies, transport contracts, mocks and homepage demo fixtures.
  Derive it from fixture IDs/club identity and the displayed snapshot, not from points,
  minutes played or injury probability.
- Use states that cover upcoming, team live, between DGW fixtures, complete, blank/TBD
  and unknown. A fixture in progress takes precedence even for a player with zero
  minutes; accessible wording says **Team playing now**, without claiming he is on field.
- Upcoming: keep the dash and use a quieter shirt/surface/border treatment. Preserve
  readable text and the recognizable yellow/orange/red availability hue. Do not lower
  the opacity of the whole interactive button, focus ring or event notification.
- Team live: add a small live marker and restrained moving border segment/pattern
  confined to the existing player metadata box. Use a static marker for reduced motion.
  Finished: retain current design. Between fixtures: preserve earned points at normal
  readability and indicate another fixture remains; do not reset the player to unplayed.
- Keep geometry fixed, let scoring-event emphasis remain legible, and use the existing
  queued/displayed snapshot so a newer fixture state does not leak into an older scene.
- Verify all availability colors × progress states, DGW transitions, bench/substituted
  players, event glow overlap, reduced motion, keyboard focus and the public demo.
  Run existing node-identity, reveal, squad-fit and event-queue browser checks.

Acceptance: viewers distinguish not-yet-started, team-live and finished players without
losing warning colors, points, accessibility or the established broadcast animation.

### 18. `style(navigation): give customer workflows distinct visual landmarks`

Requirements: 10. Last feature commit; depends on the functional page changes above.

- Review the completed routes together at phone and desktop sizes. Use page purpose,
  title, active navigation and composition as the primary orientation cues, with
  restrained accent/surface differences as supporting cues.
- Proposed direction: My leagues is a compact collection of saved league cards;
  Find leagues leads with search and result rows; Register uses a focused ID form;
  Checkout uses a clear league → plan → consent progression; league detail leads with
  league identity and tabs; Account settings uses quiet form sections. These should
  feel related while being recognizable at a glance.
- Keep the plum canvas, typography, logo and status-color meanings. Do not use success,
  danger or player-availability colors as arbitrary page identities. Preserve the
  current cinematic broadcast and administrator usability.
- Check a full navigation sequence, long/empty/error states, focus/selected states,
  text contrast and reduced motion. Review screenshots side by side across phone,
  short landscape, tablet, laptop, desktop and TV sizes; test that color is not the
  only way to identify a page or state.
- Update the existing league/architecture design notes to record the final choices.

Acceptance: users can identify where they are and the next relevant action from the
heading, navigation and composition, with color providing additional help.

### 19. `chore(release): verify next-version workflows and document compatibility`

Requirements: release verification across 1–15. Depends on 1–18.

- Every earlier commit includes targeted tests. At this gate run the backend Maven
  suite, frontend `npm run check`, then `npm run test:browser` against a fresh production
  build using the repository's Node version. Include the six configured viewport
  projects and the additional narrow-phone/short-landscape stress cases.
- Rebuild the local integrated stack and verify authenticated DTOs, migration upgrades,
  session changes, private approvals/chat and paid registration with delayed webhooks.
  Complete real Paddle sandbox and configured-mail recovery/change smoke tests.
- Document the normal database backup/restore rehearsal and a coordinated application/
  migration rollout. Old application writers must not bypass or leave stale canonical
  username keys; plan deployment compatibility and recovery before touching production.
- Exercise a real in-progress FPL gameweek when available and compare source points,
  computed manager totals and official reconciliation. Use recorded deterministic
  data for late updates, DGWs and other cases unavailable live; state that distinction.
- Verify native selection on real phone browsers and inspect popup/checkbox placement
  with an open keyboard and safe areas. Emulated taps alone do not prove native behavior.
- Update architecture/API/mobile handoff notes, privacy copy, FPL freshness/scoring
  notes and changelog. Bump the agreed release version consistently only here; 1.4.0
  is a reasonable minor-version target, subject to the project's release decision.
- Record exact checks and any pre-existing/environment failures. Prior plan documents'
  historic test failures are context, not evidence that today's checks fail or pass.
  Do not deploy, tag or publish as part of this planning task.

Acceptance: all requested flows have linked verification evidence; unresolved provider,
device or data limitations are explicit before release.

## Coverage and ordering

| Request                                                    | Commits |
| ---------------------------------------------------------- | ------- |
| 1. Unique usernames, private emails, saved notification    | 1–3     |
| 2. Cleared discovery search survives refresh               | 4       |
| 3. Get started opens registration/payment flow             | 5       |
| 4. Discovery first on phone, separate registration         | 4       |
| 5. Stable mobile result action and distinct states         | 6       |
| 6. Actionable plan buttons and visible consent guidance    | 7       |
| 7. Paddle close/back control                               | 8       |
| 8. Successful registration notification                    | 3       |
| 9. Confirm removal, My leagues consistency                 | 5, 9    |
| 10. Improve visual navigation last                         | 18      |
| 11. Password change/recovery and account deletion location | 10–11   |
| 12. Native long-press selection                            | 12      |
| 13. Live matchup scores and optional live standings        | 13–15   |
| 14. Player fixtures, times, scores and difficulty          | 13, 16  |
| 15. Upcoming/live/completed broadcast players              | 13, 17  |
| Final integrated verification/release notes                | 19      |

Commits 1–3 address identity/privacy first. Commits 4–12 repair user journeys.
Commits 13–17 share the live-data foundation rather than adding separate calculators.
Commit 18 is deliberately the last design change. Commit 19 is the release gate.

## Guidance checked for the plan

- [OWASP authentication guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#change-password-feature)
  supports requiring an authenticated session and current password for password changes.
- [OWASP password recovery guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
  supports generic responses, throttling, expiring single-use tokens, notifications and
  session invalidation. Reuse the existing recovery flow and close the identified gaps.
- [Auth0 provider/password distinction](https://auth0.com/docs/authenticate/database-connections/password-change)
  illustrates the established convention that social-provider passwords are changed
  with that provider. The Google-only policy above is a product recommendation for
  this application; adopting Auth0 or another identity platform is not proposed.
- [Paddle checkout closure event](https://developer.paddle.com/paddle-js/events/checkout-closed/)
  distinguishes closing the overlay from successful completion.
  [Paddle's close method](https://developer.paddle.com/paddle-js/methods/paddle-checkout-close/)
  supplies the supported programmatic lifecycle operation.
- [FPL's difficulty display](https://fantasy.premierleague.com/fixtures/fdr) defines the
  1–5 easy-to-hard scale. Verify actual source fields and current scoring rules against
  [FPL help](https://fantasy.premierleague.com/help/faqs) and captured official API payloads
  during implementation; the API is undocumented and upstream behavior can change.

## Planning limits

This session inspected source and documentation and checked the guidance above; it did
not run the application, reproduce the reported phone/Paddle behavior, run tests or
execute a migration. Those checks are explicit implementation work, not assumed results.

Main risks: existing duplicate accounts need visible username changes; historical email
disclosure cannot be undone; live information remains dependent on upstream points and
is provisional until FPL settles the gameweek. Baseline reconciliation, double-gameweek
eligibility and shared cache freshness are the most substantial implementation work.
