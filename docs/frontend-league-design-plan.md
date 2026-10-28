# League experience redesign

Status: implemented in the league workspace. Broadcast scene redesign is deferred.

Implementation uses the compositions and responsive modes below. The league header omits the
extra decorative eyebrow to keep useful information closer to the top of phone screens.
A subsequent mobile-emulation fix replaces native club/gameweek select popups with
viewport-bounded native dialogs, sharing styled internal scrollbars and keyboard selection.
The existing checkout now shares the workspace shell; its plan content and payment flow remain
owned by billing. Validation: `npm run check` passes (30 unit tests); the browser suite passes 112 checks
with eight intentional skips across the six viewport projects, plus a 320px reduced-motion
stress check. Browser APIs are mocked. Screenshots were reviewed at each layout mode.

## Direction

Make the signed-in experience feel like the working part of the existing Fantasy Broadcast
website: a polished sports publication with an excellent data interface. Keep its dark plum
identity, strong typography, rectangular geometry and electric accents. Introduce disciplined
spacing, quieter surfaces and readable information hierarchy. The result should feel confident,
precise and alive, with motion supporting navigation rather than competing with scores.

The public homepage and pricing page are the visual reference. Preserve them. Do not turn the
league area into a generic dashboard with a sidebar, unrelated charts, glass panels or decorative
statistics. The product has three useful views; make those views exceptional.

## Review findings

Reviewed the current source and rendered the production build at 1366×768 and 390×844 using
the repository's deterministic browser fixtures. Inspected the homepage, pricing, league picker,
all three league views and the player dialog. Four existing browser workflows passed.
Fixture shirts are placeholders and fixture scores are demonstration data; neither is evidence
of a production data problem. Other viewport sizes remain implementation validation work.

| Current issue                                                                                | Required change                                                                     |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Customer canvas is blue-purple `#30266f`, while public pages use deep plum `#18001d`.        | Carry the public palette into the workspace.                                        |
| League names are oversized; action buttons, metadata and scores compete for attention.       | Establish a compact page header, restrained controls and clear numerical hierarchy. |
| Gold/silver/bronze podium blocks dominate standings; names and even numeric values truncate. | Replace the podium with one complete, readable standings table.                     |
| H2H numbers appear without sufficiently explicit labels.                                     | Separate and label league points and fantasy points.                                |
| Three tabs occupy two rows on phones.                                                        | Use one stable navigation row with a clear active indicator.                        |
| Teams shows a tall club list before the squad on phones, then tiny player labels.            | Use a compact club selector and a readable small-screen roster.                     |
| Matchups use bright green/red score blocks, making ordinary results look like alerts.        | Use neutral scores, subtle winner emphasis and explicit result/status text.         |
| Floating owner ellipsis appears after the content.                                           | Put league actions in the league header.                                            |
| Layout tests pass despite locally clipped content.                                           | Review screenshots and actual label/score readability, not just document overflow.  |

## 1. Visual foundations

Define a small set of league-scoped CSS variables. Reuse public palette values; do not globally
replace tokens used by broadcasts, administration or checkout.

| Role                                    | Value / treatment                                                     |
| --------------------------------------- | --------------------------------------------------------------------- |
| Canvas                                  | `#18001d`                                                             |
| Surface                                 | `#25002c`                                                             |
| Raised/hover surface                    | `#31003a`                                                             |
| Primary text                            | `#ffffff`                                                             |
| Secondary text                          | `#d9cbe0`                                                             |
| Quiet text                              | `#b6a4bd`; verify contrast on its actual background                   |
| Primary action / active navigation      | `#20e6ff`, dark plum text on filled buttons                           |
| Positive movement / available broadcast | `#00ff85`; pair with an icon or words                                 |
| Negative movement / destructive action  | `#ff6b85`; use sparingly and with text                                |
| Dividers                                | White at 10–14% opacity; stronger boundaries for controls when needed |

Use an almost flat canvas. At most one faint, static cyan glow near the upper-right edge of the
page, referencing the homepage's circular motif. Keep it away from table text. No moving backdrop.
Use borders and surface contrast for hierarchy; reserve shadow for floating menus and dialogs.

Keep the existing sans-serif stack and wordmark. Do not introduce a font dependency. Use:

- Page title: 36–40px desktop, 28–32px phone, weight 750–800, line-height 1.1–1.2.
- Section/team title: 22–26px, weight 700. Allow long names to wrap naturally.
- Main data/body: 15–16px; secondary metadata: 13–14px. Avoid sub-12px visible labels.
- Score emphasis: 28–32px in a team header; 16–18px in tables. Tabular numerals throughout.
- Labels: sentence case. Uppercase only for occasional small section eyebrows.
- Spacing scale: 4, 8, 12, 16, 24, 32, 48px. Panels use 24px desktop / 16px phone padding.
- Geometry: crisp 4px control corners and 6px panels. Circular shapes only for avatars/status dots.
- Controls: at least 44px high; 48px primary buttons. Lucide icons at 16–20px, consistent stroke.

White and muted plum should dominate. Cyan identifies an action or selection, green communicates
meaning, and neither is a default background for ordinary data. Remove gold owner badges and
yellow squad totals. Do not add unrelated club colors or invented crests.

## 2. Shared workspace and league picker

Use a centered 1200px content container, with 32px gutters on desktop and 16px on phones.
Align navigation, page title, panels and footer to this grid. Keep the content comfortably bounded
on ultrawide screens. Header height is about 72px desktop / 64px phone; no permanent sidebar.

Preserve the Fantasy Broadcast wordmark. At the right, provide a restrained account control with
initials and an accessible name. On a league page, keep the league switcher available; on phones
it can occupy a compact second header row. Show the current league, a chevron, and a selected mark
inside the dropdown. Long names wrap inside the dropdown. Account and league menus close on
Escape, selection and outside click, and return focus appropriately.

Picker composition:

```text
Fantasy Broadcast                                      Account

Welcome back, Alex
Your leagues                                  + Add or find a league
Choose a league to explore its standings, teams and matchups.

┌─────────────────────────────────┐  ┌─────────────────────────────────┐
│ Draft · Head-to-head     Owner  │  │ Classic · Total points          │
│ Sunday League Elite            │  │ Midweek League                  │
│ FPL league #24025              │  │ FPL league #24026                │
│ Open league                  → │  │ Open league                   → │
└─────────────────────────────────┘  └─────────────────────────────────┘
```

Use a two-column grid for normal desktop widths and one column below 640px. Cards are about
190–210px tall with clear internal alignment; content may increase their height. The league name
is 22–24px and wraps. Type/scoring is quiet metadata; ownership is a small neutral outlined badge.
The entire card is one semantic link with a visible focus ring, with no nested action buttons.
Hover slightly raises the surface, strengthens the border and moves the arrow 3px.

The add/find action is secondary to opening an existing league: outlined, in the title row on
desktop and below the introductory text on phones. Add a labeled name filter only when there
are more than six leagues; preserve list order. Distinguish no filter results from no registrations.
Do not fetch every league overview merely to decorate cards with stats.

Preserve the existing zero-league redirect to registration and single-league direct opening.
Restyle the add/find registration page with the same surfaces and form rhythm so that this branch
does not abruptly revert to the old design. Keep its validation, registration and following rules.
Checkout and public pricing retain their existing design.

## 3. League header and navigation

Use one compact identity block above the content:

```text
← Your leagues
Sunday League Elite                    [Open broadcast] [⋯]
Draft · Head-to-head · Gameweek 24 · 4 clubs

Standings          Teams          Matchups
━━━━━━━━━─────────────────────────────────────────────────
[active view]
```

League name is the primary heading, with type, scoring and available gameweek/entry count below.
Use `RegisteredLeague` for registration identity and overview data for gameweek and entries.
Omit unavailable metadata rather than inventing it. The back link and switcher have different
purposes: return to the list versus change the current league.

Move owner actions into the header ellipsis. Keep deletion owner-only and behind its existing
confirmation. Avoid a new settings page for one action.

Use text tabs with a 2px cyan underline and a subtle active text change. All three fit in one row
on a 390px phone; total-points leagues show only Standings and Teams. Content begins 24px below.
Implement proper tab/tabpanel relationships, roving focus and Left/Right/Home/End keyboard support.

Make view selection refresh/back/share friendly using optional query parameters, for example
`/league?leagueId=1&view=teams&entryId=12`. Defaults preserve existing URLs. Validate values against
the selected league; invalid or unsupported views fall back to Standings. Explicit tab and club
selections update browser history; typing a filter does not. League changes clear view-specific
filters/selections. Do not infer a user's fantasy team from league ownership.

Replace the full cyan broadcast banner with a small availability notice and one primary header
button. Preserve the existing active-schedule condition and open-broadcast mutation; navigate
only after success. Use “Broadcast available” rather than asserting a match is currently live.
Show the supplied availability end time. If no active schedule is returned, show quiet text
“No broadcast available now” instead of an enabled button. A schedule failure is “Broadcast
availability unavailable” with Retry; it must not erase otherwise usable standings.

## 4. Standings: one authoritative table

Remove the podium entirely, including its reserved vertical space and separate remaining list.
Keep every club in one rank-ordered table; preserve ties and supplied ranks. A small medal-colored
rank glyph may distinguish the top three, but its row stays the same size and layout as the others.
No duplicate leader cards above the table.

Desktop H2H columns: **Rank | Club / manager | Movement | Fantasy points | League points**.
Total-points columns: **Rank | Club / manager | Movement | Total points**.
The primary score is rightmost, bold white. Secondary fantasy totals are muted. Include concise
help text explaining the two H2H measures; never relabel `points_for` as current-gameweek points.
Use existing `standingPoints`, `standingGamePoints` and `standingLastRank` normalization and
verify labels against Draft and Classic payloads before implementation is accepted.

Use semantic table markup, scoped column headers, 64–72px rows and quiet separators. Club names
link to their Teams view; manager names sit beneath in muted text. Support a full second line
for long club names. Numbers must never ellipsize. Rank movement uses an arrow and number, with
accessible text such as “Up 2 places”; absent prior rank is unavailable, not unchanged.

On phones, retain rank, club and primary points as the three visual columns. Put movement beside
rank and the secondary H2H fantasy total in a labeled second line within the points cell. Preserve
programmatic labels when the presentation compacts. Keep 14px minimum data text, all values and
full club names reachable without hover. Do not force a horizontally scrolling desktop table.

Provide search when more than ten entries are present; filtering never renumbers ranks. Preserve
the table header in loading and empty states. Avoid implying that the returned list includes
entries the API has not supplied.

## 5. Teams: club selection plus a readable squad

At widths of 960px and above, use a 260px club panel and a flexible squad panel, separated by
24px. The club panel has a permanently visible, labeled search, compact 64px rows, club name and
manager. Selected rows have a subtle cyan tint and 2px left edge. Its bounded scroll region is
keyboard usable; do not let it create a second page-length block.

Below 960px, replace that panel with one full-width “Club” selector above the squad. A native
select is sufficient; do not add a combobox library. The squad immediately follows the selection.
Remove automatic scrolling to a distant squad after each choice. Honor an entry from the URL;
otherwise select the first ranked valid entry, then the first available entry. This intentional
change replaces the current large empty “Select a club” panel. Never label the default “Your club”.

The squad header shows club name, manager, gameweek and a clearly labeled current starter total.
Keep existing scoring derivation; do not quietly change totals to match a visual expectation.
Do not present a fallback zero as confirmed data when live-player data is missing: show a dash
and a short availability message. Verified zero and negative scores must remain valid numbers.

Desktop squad: retain football position groups and shirts, using CSS grid rather than absolute
pixel-width tokens. Use calm plum row surfaces, generous separation, readable player names and
neutral point labels. Mark the bench as a separate muted section. Do not add a decorative full
pitch behind a roster; that visual belongs to the broadcast.

Below 640px, present each position as compact roster rows: small shirt, player name and club,
right-aligned points. Each row is a 48–56px player-details button. This deliberately prioritizes
readability over squeezing five shirts across a phone. Between 640px and 959px, use the shirt grid
only while labels and targets fit comfortably, otherwise retain roster rows. Preserve lineup,
substitution and bench membership logic. Missing shirt assets get a consistent neutral fallback.

Keep the existing player-details dialog and current/history content. Bring its surface, header,
tabs and spacing into the same visual language for league usage. Desktop maximum width ~560px;
phone width uses 16px gutters and a scrollable body within dynamic viewport height. Keep native
dialog behavior, visible close control, Escape handling and focus return. Scope visual changes
to league usage if necessary because the dialog also serves broadcasts.

## 6. Matchups: readable scorecards

Make the current gameweek the initial focus. Above its cards, show a labeled gameweek selector
containing only weeks returned by the API, with previous/next controls for that list. This replaces
long previous/future accordion dumps; every supplied historical/future week remains reachable.
Optionally persist the chosen week in the URL alongside `view=matchups`; invalid values fall back
to the current available week. Classic payloads may contain only the current week.

Each card uses two rows, one per club, with the score aligned at the right. This same composition
works on phones and makes long names legible. Desktop uses two cards per row when space permits;
phone uses one. Add manager beneath the club when available. Use a small neutral gameweek/status
line at the top. Make club names links to their team view; the card itself is not a competing link.

Scores are white, 24–28px with tabular numerals. Finished matches can show a subtle green winner
marker and textual result; draws use a neutral label. Upcoming scores are dashes. Never paint
the losing score red solely because it is lower. Do not infer “Live” from a nonzero score or from
an active broadcast schedule. Use “Final” only where `finished` is trustworthy; otherwise use
neutral gameweek context. The Classic normalization currently supplies `finished: false`, so
do not manufacture final/live status from that adapter. Preserve confirmed 0–0 results.

## 7. Motion and interaction states

Use CSS transitions and keyframes; no new animation dependency.

| Interaction          | Specification                                                                                  |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| Initial page content | 220ms opacity + translateY(6px); title then panels, at most 40ms stagger, first six cards only |
| Card hover/focus     | 140ms surface/border transition; at most 2px lift on hover-capable devices                     |
| Tab change           | 160ms opacity + translateY(4px) on incoming content; header stays still                        |
| Club change          | 140ms incoming squad fade; no sliding the entire page or scroll jump                           |
| Menu/dialog opening  | 160ms fade + translateY(4px); avoid scaling text                                               |
| Buttons              | 120ms color transition; busy state keeps width and readable action text                        |

Use `cubic-bezier(.2,.8,.2,1)` for entrances. Animate transform/opacity rather than layout. Do not
delay requests or keyboard focus until animation ends. No repeating glow, pulsing whole cards,
score count-up, or automatic table reordering animation. Respect `prefers-reduced-motion` by
removing movement/stagger and showing state changes immediately. Loading skeletons are static.

Provide designed loading, empty, no-search-results, request-error, retry and mutation-busy states.
Reserve the expected space for loading tables/cards to reduce jumps. Keep error messages beside
the action/data that failed. Use persistent visible keyboard focus; verify text contrast and
selected/disabled states on actual surfaces. Do not announce an entire table on every update.

## Implementation sequence and boundaries

Read `frontend/AGENTS.md` and `docs/frontend-architecture.md` before implementation. Use the
existing React/TypeScript/CSS stack, helpers and Lucide icons. No backend contract changes.

1. **Workspace foundation and picker.** Implement scoped tokens, navigation, picker and add/find
   page styling. Review desktop/phone alongside the unchanged homepage before proceeding.
2. **League header and standings.** Introduce the identity/actions block, tab URL state and complete
   table. Validate Draft/Classic and H2H/total-points semantics, ties, long names and large scores.
3. **Teams and player details.** Implement responsive selection, initial selection, grid/roster
   composition and league-scoped dialog polish. Preserve scoring and player interactions.
4. **Matchups and broadcast entry.** Implement gameweek navigation and scorecards, truthful status
   labels, schedule loading/error states and the existing broadcast-opening behavior.
5. **Motion, accessibility and visual acceptance.** Finish interaction states, inspect screenshots,
   fix composition defects and run full checks. Remove superseded selectors rather than adding
   override layers. Update architecture notes for intentional URL/interaction changes.

Main owners: `features/leagues/CustomerNavigation.tsx`, `LeaguePicker.tsx`, `LeagueDetailPage.tsx`,
`LeagueStandingsOverview.tsx`, `LeagueTeamVisual.tsx`, registration components and `leagues.css`.
Extract focused Standings/Teams/Matchups components as these views grow; avoid turning
`LeagueStandingsOverview` into a larger multi-purpose controller. Route state belongs with the
existing navigation ownership. Reuse query/mutation helpers and preserve cancellation.

Audit CSS import order and shared player classes before editing. Keep league styles scoped.
Any necessary shared-dialog styling change must be checked in the broadcast too. Do not modify
event queues, snapshot staging, audio, scene timing or the public demo as part of this work.

## Acceptance criteria

- Login to picker to league feels like one product with the public site: same plum palette,
  wordmark and accent language, with appropriately denser application typography.
- All tabs fit in one phone row. Every standing, score and club name remains readable; no
  clipped numerical values, overflowing podium metadata or tiny five-across phone labels.
- At 1366×768 the league title, tabs and several standings rows are visible without scrolling.
  On phones the team selector is followed immediately by the selected squad, not a tall club list.
- Review 390×844, 844×390, 820×1180, 1366×768, 1920×1080 and 3840×2160; additionally stress 320px
  width and 200% zoom. Short landscape must not lose content behind sticky controls. Large displays
  use a bounded layout rather than stretching rows edge to edge.
- Exercise zero/one/many leagues, owner/follower, all supported scoring/type combinations,
  ties, long names, four-digit totals, negative/zero/unavailable points, many entries, no players,
  missing images, empty history, unavailable schedules, failed requests and busy actions.
- Back/forward, refresh and copied view URLs work. Switching leagues clears stale selection.
  Keyboard users can operate menus/tabs/club selection/dialogs with visible focus and logical order.
- Update browser fixtures for total-points and Classic coverage; current reviewed league fixtures
  are Draft H2H. Add meaningful behavior tests for URL selection, default team choice and week
  navigation. Adapt existing accessible-name assertions when intentional copy/semantics change.
- Run `npm run check`, then `npm run test:browser` against the fresh build using the project Node
  version. Inspect before/after screenshots at each layout mode; passing functional tests alone
  is not visual acceptance. Public pages, checkout, admin and broadcasts must remain usable.

## Broadcast follow-up, intentionally deferred

For this phase, redesign only the entry point into a broadcast and protect the existing scenes.
Later, review the full broadcast separately for viewing distance, scoreboard hierarchy, selector
controls, commentary placement and motion intensity. Carry over the palette and typography
discipline, but evaluate its theatrical full-screen composition on its own terms. Keep the
recently separated data/queue/playback/measurement responsibilities intact.

## Handoff instruction

Implement this brief in sequence, following `frontend/AGENTS.md`. Treat the screen compositions,
color roles, responsive modes and data constraints above as the design decisions. Preserve the
public site's identity and existing backend behavior. Capture and inspect each completed view
before continuing. If a desired label requires unavailable data, omit it or use an honest empty
state; do not invent metrics or expand the backend to decorate the interface. Report intentional
interaction changes and validation results with the completed work.
