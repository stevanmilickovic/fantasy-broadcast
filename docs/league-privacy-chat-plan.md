# League privacy, usernames and chat

Status: implemented in the six planned commits; final verification results are recorded below.

Update for the next version: the historical email-visibility decisions below are
superseded by `next-version-plan.md`. Chat and follow-request responses now identify
users by username and ID and do not include account emails.

## Agreed requirements

- The league owner controls whether a league is private and approves follow requests.
- Following a private league requires approval before league data, broadcasts or chat become accessible.
- Followers share a league chat, available through a league tab and a broadcast overlay.
- Existing account display names are the initial usernames. Users can change their name; duplicates are allowed.
- Sender emails are always visible in muted gray beside their usernames, wrapping when needed on narrow screens.
- Chat messages disappear 24 hours after the server accepts them.

## Proposed behavior and implementation choices

- Existing leagues remain public and existing followers retain access when an owner makes a league private. Privacy governs new follows.
- Private leagues remain searchable by basic identity, with a Private badge and Request to follow action. Results expose no member list, chat or protected league details.
- A request shows Pending until approved or rejected. Users can cancel pending requests and resubmit rejected requests. Public follows remain immediate.
- Returning a league to public accepts its outstanding pending requests, since those users already requested to follow. Approval, cancellation and privacy changes are transactional and safe against concurrent requests.
- Owners retain access independently of follow-request status. Existing site-administrator access remains an administrative override; ordinary followers cannot manage approvals.
- Reuse active `league_registration` rows for approved follows. Store pending/rejected requests separately, uniquely per user and league, so pending requests cannot accidentally grant existing membership-based access.
- Use `app_user.display_name` for the editable username; do not add a second identity field. Allow 1–40 trimmed characters, reject blank/control-only input, and identify authors by immutable user ID. Existing names stay as they are until edited.
- Resolve names from the account when loading messages, so renaming also updates the sender name on earlier messages. Fix session snapshots so a custom name is not overwritten or returned stale after editing or signing in with Google.
- Show email only to authorized chat readers, never in public discovery. Explain this visibility next to chat/profile settings.
- Store plain-text messages with author ID, league ID, server timestamp and a client-generated send ID for safe retries. Limit messages to 1,000 characters, reject whitespace-only messages, and rate-limit sends on the server.
- Fetch the latest 50 unexpired messages initially; load older messages by cursor while scrolling. Order by server time and message ID. Poll for new messages about every three seconds only while chat is open and the page is visible; back off on failures and refresh on return. Each request rechecks session and membership.
- Filter expired messages on every server read, remove them from open clients at expiry, and delete expired database rows periodically. A cleanup delay must never make an expired message visible. This is application retention, not a guarantee of removal from historical backups.
- Chat is available outside broadcast hours to league members. It does not require the broadcast to be active. Leaving a league removes chat access; changing leagues/accounts clears loaded chat state. User/league deletion cleans up related chat records.
- The first release is text-only: no attachments, reactions, threads, typing indicators or read receipts.

## Commit sequence

### 1. Allow users to edit their display name

- Add an authenticated profile update endpoint and a small account settings view accessible from the signed-in navigation.
- Reuse existing account identity and form/query helpers; refresh displayed identity and active session copies after changes.
- Test validation, duplicate names, authorization, persistence across login and existing Google accounts.

### 2. Add private leagues and owner-approved follow requests

- Add Liquibase migrations for league privacy and follow requests, with defaults preserving current access.
- Extend the league registration service with request/cancel/approve/reject operations and owner-only privacy settings.
- Apply the existing shared access checks to approved memberships, including league details, player endpoints, broadcast entry/live transport and narration. Check long-lived broadcast access when membership ends.
- Cover direct API access, cross-league ownership, pending/rejected users, duplicate follows, concurrent decisions, privacy transitions and purchasing-owner access with backend tests.
- Verify migrations on a fresh database and an upgraded database.

### 3. Add league privacy controls and follow approval screens

- Add Public/Private controls and a follow-request list under the league owner's actions, with requester username/email and Approve/Reject.
- Show Private, Request to follow, Pending, Cancel request and rejected-request feedback in discovery and the user's leagues area.
- Keep pending entries separate from accessible leagues so clicking them cannot open protected content.
- Test the two-user request/approval workflow, owner-only controls and public-follow compatibility in the browser.

### 4. Add league chat storage, access checks and message expiry

- Add the message table/indexes, authenticated history/new-message endpoints, send validation/rate limiting and periodic expiry cleanup.
- Authorize every read/send; return author identity only inside the authorized chat response. Use existing cookie/CSRF protections.
- Make history pagination bounded and retries idempotent; handle account and league deletion.
- Test league isolation, rejected/pending/nonmember access, duplicate retries, cursor boundaries, rate limits, plain-text handling and the exact 24-hour expiry boundary with a controllable clock.

### 5. Add the league chat tab

- Add a URL-addressable Chat tab and shared chat component/hook, independent of FPL overview loading or availability.
- Place the composer below chronological messages; show usernames, timestamps and always-visible sender emails.
- Start at the newest messages. Follow new messages only when already near the bottom; otherwise preserve reading position and offer a New messages control.
- Preserve scroll position when prepending older messages; handle loading, empty, offline, expired-session, lost-access and send-failure states without losing the draft.
- Test two-user delivery, duplicate names, safe text rendering, reconnects, scrolling and expiry using the shared browser fixtures.

### 6. Add broadcast chat overlay and finish responsive verification

- Add a bottom-right Chat button to league-scoped broadcasts and mount the overlay at the broadcast page level so scene changes cannot reset it. Public demos/global broadcasts have no league chat.
- Anchor the composer and send button at the bottom, above the mobile keyboard and safe area. Newest messages sit immediately above it.
- Fade the message area and background toward the middle of the screen. Scrolling up switches to readable history with an opaque backdrop and unfaded messages; returning to live messages restores the fade.
- Keep the composer outside the fade. Provide a close button, Escape behavior, focus management and a Back to latest control. Constrain the desktop overlay so it does not obscure the whole pitch; use a bottom sheet on phones.
- Reuse league chat state/requests, keeping chat independent of score snapshots, event queues, scene transitions and audio.
- Verify phone portrait/landscape, tablet, laptop, desktop and TV, including long names, keyboard-open layout, history scrolling, reduced motion and broadcast commentary/player dialogs.
- Update the architecture guide and existing privacy/retention copy. Run backend tests, frontend checks and relevant browser suites against a fresh build; report unrelated existing failures separately.

Each commit includes its own relevant tests and leaves the application runnable.

## Verification

- Profile persistence/session refresh, private follow approval/rejection/cancellation, chat isolation,
  expiry, retries, rate limits, pagination and concurrent approval have backend tests.
- The privacy/chat migrations run in tests against the pre-existing schema with existing data.
- Browser workflows cover approval, duplicate usernames/email disclosure, failed-send retries,
  FPL-independent chat, overlay fading/history, focus recovery and stable squad geometry across
  phone portrait/landscape, tablet, laptop, desktop and TV sizes.
- The normal frontend formatting gate encounters existing formatting failures elsewhere in the
  repository; affected frontend files are formatted and lint/build/unit checks run separately.
- Final checks: 84 backend tests; frontend lint/build and 55 unit tests; all 18 feature browser
  cases across six viewports, including a simulated mobile keyboard and open-chat expiry.
- The local Docker stack rebuilt successfully and upgraded the existing MySQL database. Live API
  checks exercised approval, forbidden access, renaming, retry deduplication and 24-hour expiry.
  Temporary test users/leagues were removed; existing credentials were reused.
- The full browser run also found four existing matchup-scroll failures, reproduced against an
  isolated pre-feature snapshot, and timing/pixel failures in existing animation/home-color tests.
  These unrelated tests were left unchanged. The complete browser suite is not green.
