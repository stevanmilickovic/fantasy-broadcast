# Changelog

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
