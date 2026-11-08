# Changelog

## Unreleased

- Enforce unique usernames, assign available defaults, preserve existing names, and remove other accounts' email addresses from chat and customer responses.
- Add reusable bottom notifications for saved usernames, completed registration and errors.
- Separate league discovery from registration, preserve cleared searches, guide Get started through registration, and keep mobile result actions beside wrapping names.
- Guide checkout consent from either plan button and restore checkout state and focus after Paddle dismissal.
- Confirm league removal, use My leagues consistently, and distinguish discovery, registration, checkout and account navigation.
- Add current-password changes and provider-aware recovery with single-use links, attempt limits and session invalidation; centralize account deletion in settings.
- Preserve native long-press text selection while suppressing tap highlights on touch controls.
- Share fresh FPL points and fixtures across league and broadcast views; calculate current matchups and optional provisional standings from closed historical baselines.
- Show player fixtures, kickoff times, scores and FPL difficulty, including double and blank gameweeks; distinguish upcoming, live and completed broadcast players.
- Expand security, scoring and responsive regression coverage and document migration, compatibility and remaining device/provider checks.

The intended release is 1.4. The version remains 1.3.5 until user testing is complete.

## 1.3.5 - 2026-11-07

- Give homepage broadcast preview clubs distinct squads, including substitutes, and keep scoring events, commentary and totals consistent across frames.
- Hide the return-to-leagues button while payment confirmation is processing; show it after a timeout or failed check, and hide it again on retry.
- Add regression coverage for preview squad ownership, scoring consistency and payment-confirmation navigation.

## 1.3.4 - 2026-11-07

- Persist verified Paddle webhook events before acknowledgment, process them in the background with durable retries, and recover unfinished work after restarts.
- Keep saved checkout verification valid across API-key rotation, validate and record current terms acceptance, and reject mismatched sandbox/live billing configuration.
- Display the four homepage preview club logos in matchups and standings using the existing emblem component and transitions, with graceful handling of missing images.
- Add a preview-logo preparation command that reuses the upload image processor, include optimized PNGs in frontend builds, and include the utility source in Docker build tests.
- Add PNG/ICO search favicons and a coherent homepage meta description, and exclude feature-card headings and demo fixtures from search snippets.
- Expand webhook, checkout validation, image preparation and responsive preview regression coverage.

## 1.3.3 - 2026-11-06

- Add server-side pagination to subscriptions and registered league discovery, with fixed ten-item pages and newest-first league ordering.
- Keep registration and league discovery in responsive side-by-side cards, with distinct search and paging controls.
- Show Open league for existing followers while preserving private-league approval states.
- Add pagination and follow workflow coverage and a project skill rule against redundant UI copy.

## 1.3.2 - 2026-11-06

- Automatically open the newly registered league after server-side payment confirmation, including when the subscriber has multiple leagues.
- Wait for delayed payment confirmation and offer a retry without requiring another payment.
- Style and space the confirmation page buttons consistently with existing billing controls.

## 1.3.1 - 2026-11-06

- Corrected the pricing workflow test to match the current simultaneous-viewer text.
- Limited automatic CI and image publishing to version-tag pushes, with a check that the tag matches `VERSION`.
- Moved the full browser and responsive screen suite to a manual workflow, with traces recorded on the first CI retry.
- Removed duplicate release builds and tests by packaging prebuilt frontend assets and the tested backend JAR into Docker release targets.
- Added Maven and Docker layer caching, retained npm caching and image security scans, and excluded browser reports from Docker build contexts.

## 1.3.0 - 2026-11-05

- Updated displayed monthly prices to EUR 6.99 for Standard and EUR 19.99 for AI Broadcaster, and simplified pricing descriptions.
- Disabled new AI Broadcaster purchases and upgrades by default through backend-controlled availability, while preserving existing paid AI access, cancellations, refunds and downgrades.
- Added a separate Form column to Draft and Classic H2H standings with the last five completed results, colored win/loss/draw bubbles and gameweek score details.
- Included recent completed Classic matchups in league overview data and excluded unfinished matchups from standings form.
- Simplified phone H2H standings to show bright league points and dimmer fantasy points without the extra fantasy-points label.
- Enlarged mobile matchup and broadcast club emblems, cropped them at the outer edges and layered club text above them; kept clipping consistent throughout broadcast transitions.
- Expanded standings, emblem and transition browser coverage and corrected the controller test fixture for the current league record.

## 1.2.0 - 2026-11-01

- Added private leagues with owner-controlled privacy, follow requests, approval/rejection and cancellation; existing followers retain access when a league becomes private.
- Enforced approved membership across protected league data and chat, and rechecked access before sending live broadcast updates.
- Added editable usernames in account settings, allowing duplicate names while keeping active sessions and Google sign-in consistent with saved names.
- Added a league Chat tab with plain-text messages, sender emails always visible beside usernames in muted text, history pagination, safe send retries and rate limits; chat remains available when FPL data is unavailable.
- Added a floating broadcast chat button and bottom-anchored overlay with fading recent messages, readable scrolling history, mobile keyboard support and focus recovery.
- Made chat messages disappear after 24 hours, added periodic database cleanup and documented chat identity visibility and retention.
- Renamed league subscription management to League management and moved privacy controls and follow requests into each league's management page, with a pending-request count beside the league action menu.
- Removed follow requests from account-specific registration/follow pages, improved the privacy control design and aligned the account settings back button with other pages while preserving mobile usability.
- Added goalkeeper-specific jerseys in broadcasts and league team views using the existing shared shirt data and caching.
- Added yellow, orange and red player availability indicators to broadcast name/points labels and league team names, with playing probabilities and availability details confined to the player details modal; joined benched broadcast name/points labels without a gap.
- Replaced combined broadcast point-update labels with event descriptions such as bonus and assist, truncating long descriptions before the points total to prevent overlap.
- Added owner-managed PNG team emblem uploads with transparent backgrounds, automatic resizing/compression to at most 512 pixels and 200 KB, validated access and cacheable image delivery.
- Displayed team emblems across league teams, standings, matchups and Insights, plus broadcasts and live standings; added larger opposing emblems to matchup cards and responsive transitions with vertically stacked emblems on phones.
- Documented a deferred Custom subscription proposal and interactive pricing calculator covering larger leagues, viewer capacity, AI allowances, league growth and Paddle integration; no Custom tier or billing changes were implemented.
- Reworked league matchups into opposing scoreboards, refined winner/loser gradients and narrow-screen layouts, and simplified Insights copy.
- Fixed league subscription action-menu styling, dimmed broadcast dashes for players without points and aligned mobile notification widths with highlighted player labels.
- Added database migrations and expanded profile, membership, concurrency, chat expiry and responsive browser coverage; documented implementation and verification results.

## 1.1.0 - 2026-10-29

- Redesigned league selection, standings, teams and matchups with responsive layouts, animated pickers, styled scrolling and clearer winner/loser gradients.
- Kept club selection within the loaded league workspace while preserving direct links and browser history.
- Added the Insights tab with owned-player leaderboards, squad output and comparisons between fantasy scoring and H2H standings; corrected Draft entry matching and player-stat mapping.
- Rebuilt broadcast presentation and transitions around real text elements with measured destinations, cancellation and frozen playback snapshots; fixed idle-score flashes and transition artifacts.
- Improved broadcast jerseys, player notifications and phone portrait/landscape layouts, retaining jersey sizes in dense formations and animating labels as notifications appear and disappear.
- Added automatic scrolling through broadcast matchup/club results with interaction pauses, reduced-motion support and scrollbars hidden on phones and revealed on desktop hover.
- Restored the desktop layout and tilt of the homepage broadcast preview, simplified commentary indicators and removed empty commentary rows.
- Strengthened browser color-scheme declarations and homepage protection against automatic darkening.
- Cached FPL league and player data hourly and shared live polling every 10 seconds across active broadcasts, instead of polling separately for each league.
- Automatically removed completed broadcast schedules and enforced a limit of 50 simultaneous viewers per league, disclosed on pricing and checkout pages.
- Added subscription management with prorated upgrades, downgrades at renewal, cancellation/resumption, payment-detail updates and invoice access through Paddle.
- Added administrator payment history and full/partial refund controls, webhook reconciliation, failed-renewal grace periods and off-season cancellation handling.
- Added direct Paddle payment-link checkout and improved league validation, tooltips, consent alignment and user-facing messages when checkout is unavailable.
- Simplified the registration screen's sign-in action and updated the business address in privacy, terms and refund policies.
- Completed the seven-step frontend refactor, established formatting and regression tests, enforced frontend checks in CI and documented architecture and mobile handoff.
- Added a repeatable local Docker testing stack that rebuilds and restarts the app while preserving the database, with exclusive initial-administrator setup.
- Expanded project agent guidelines and added the shared Ponytail skills and design plans.
- Updated Spring Framework to 7.0.9 and Jackson to 3.1.7 to address reported security vulnerabilities.

## 1.0.1 - 2026-09-14

- Added player details with current-gameweek point changes, photos, and previous-gameweek totals.
- Corrected league team totals to exclude unused bench points and show zero for players who played.
- Reorganized matchups around the current gameweek with collapsible past and future weeks.
- Showed full squads in the phone head-to-head broadcast and refined the player modal layout.
- Removed the welcome page's “See it in action” link.

## 1.0.0-RELEASE - 2026-09-12

- Fixed Paddle checkout completion, redirects, schedule creation, and provisioning flow.
- Fixed administrator routing into registered-league broadcasts and improved broadcast event queue transitions.
- Replaced the default Vite favicon with a Fantasy Broadcast monogram.
- Started the welcome-page broadcast preview sooner.
- Improved the responsive head-to-head broadcast layout, including desktop pitch sizing and mobile scorer and notification presentation.

## 1.0.0-BUILD-5 - 2026-09-11

- Clarified legal policies and monthly league subscription terms.
- Added account-deletion requests and AI-transparency labels.

## 1.0.0-BUILD-4 - 2026-09-10

- Added league registration checkout and Paddle sandbox/production payment integration.
- Added public pricing, privacy, terms, and refund pages.
- Added consistent legal-policy links across account pages, excluding live broadcasts.
- Improved checkout and pricing layouts on phone-sized screens.
- Updated embedded Tomcat to 11.0.25 to address critical security fixes.

## 1.0.0-BUILD-3 - 2026-09-09

- Refined frontend administration, navigation, authentication, and live-broadcast state handling.
- Added responsive head-to-head and total-points broadcasts, including mobile player and notification layouts.
- Improved responsive league, authentication, standings, and team-management views.
- Added email password reset support.
- Added the public welcome page with an embedded live-broadcast preview.
- Improved the welcome page on phone-sized screens by hiding the broadcast preview and top sign-in action.
- Return users to the welcome page after sign-out and make the customer header brand open league selection.

## 1.0.0-BUILD-2 - 2026-09-03

- Established the Fantasy Broadcast service, including the React frontend, Spring Boot API, SSE live updates, and MySQL/Liquibase persistence.
- Added FPL Draft and Classic league discovery, live scoring, head-to-head and total-points broadcast support, league scheduling, search, follow, and owner controls.
- Added broadcast narration, voice narration, event playback, automatic substitutions, and per-league narration controls.
- Added production container deployment, CI image publishing, Cloudflare Tunnel support, dependency scanning, and runtime security updates.
- Hardened production API access, league registration, FPL integration, and customer authentication flows.
- Added email-verified password registration with short-lived verification codes.
- Added Gmail SMTP configuration support and an admin-only email test endpoint.
- Added Google sign-in with frontend/backend OAuth routing.
- Added first-user admin assignment for test setup.
- Added admin user management with search, pagination, promotion, and deletion of users and their created leagues.
- Improved registration password validation, confirmation, reveal controls, and auth error messages.
