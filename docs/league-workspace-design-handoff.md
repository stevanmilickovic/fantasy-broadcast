# League workspace design handoff

Use the league workspace header, tab underline, plum background and typography as the visual reference. Find leagues should read like a directory, registration like a short purchase form, management like a settings list, and standings like a scoreboard. Keep their existing routes, data and actions. This brief updates the visual recommendations in the [previous registration brief](league-registration-design-brief.md), including its recommendation to frame the league lookup.

The review covered the current component markup and CSS, plus Playwright fixture captures at phone and laptop sizes. The public preview capture at 320px makes the standings problem particularly clear. Preview and registered leagues share the standings component and currently apply different narrow overrides.

## Shared design direction

- Keep the workspace shell and tab navigation. Start each screen with one left-aligned title, approximately 26–28px on phones and 30–32px on larger screens. Align the title, controls and content to the same left edge. Use the existing type family and weights. Give names and prices more emphasis than labels or metadata.
- Use the shell plum `#18001d`, surface `#25002c`, raised plum `#31003a`, white `#ffffff`, muted text `#d9cbe0` and cyan `#20e6ff` through existing tokens. Use the existing faint border for list separation. Keep cyan for genuine primary actions, selection and focus. Registration verification keeps its green feedback.
- Start with 16px phone gutters, 8–12px between closely related controls and 20–24px between groups. Use existing small control radii and 44px touch targets. Add surfaces only for plan choices, the purchase summary and existing dialogs. Let the workspace tab underline carry the page accent.
- Preserve visible focus, natural tab order, readable muted text, and status announcements. Let content wrap and grow at 320px and at enlarged text sizes. Use only short feedback transitions for state changes and honor reduced motion.

## Find leagues

**What is wrong.** The `find-league-card` border and tinted fill surround the whole workflow, then every record has another separator and a visually distinct action treatment. The “Follow” kicker repeats what the active tab and title already communicate. At 390px the long-name fixture shows how action width can force names into a narrow strip. Single-page results still display an entire disabled pager, followed by a detached registration link.

```text
Find leagues
[ League name or ID                 ] [ Search ]
──────────────────────────────────────────────────
Sunday League Elite                  Open league
Draft · Head-to-head
──────────────────────────────────────────────────
North Bank League                     Request to follow
Draft · Head-to-head · Private
──────────────────────────────────────────────────
[ Previous ]       Page 1 of 3        [ Next ]
```

1. In `LeagueDiscoveryPage.tsx` and `LeagueSearchCard.tsx`, replace the card visual with a flat content column about 760–820px wide at most. Keep the title outside the list and remove the kicker and accent edge. Scope the removal to Find in `workflow.css` and `leagues.css`. Use a labeled search form with one input and a compact Search button. Preserve Enter, native clear, the clear-to-default behavior, URL search/page, browser Back and cancellation of stale searches.
2. Render results as a semantic list with a single rule between rows, no individual fill, and 10–12px block padding. Place the name above its metadata. Preserve scoring type, privacy and owner status. Use a flexible identity column and a quiet action column. At 400px and below, give the identity the full row width and put the action immediately below it, aligned to the same left edge. Allow long unbroken names to wrap. Use one-line action labels where space permits.
3. Use a plain navigable link for **Open league**, one consistent secondary button style for **Follow**, **Request to follow** and **Request again**, and muted text with a clock icon for **Pending approval**. Pending remains perceptible and has no click or tab stop. Retain existing follow, approval and retry behavior. Keep one empty message, with a distinction between no registered leagues and no matches for a query. Put fetch/retry feedback at the list and mutation errors beside the relevant action when possible.
4. Render the pager only for more than one page. Keep the existing Register tab as the cross-workflow route. The extra Register link below the directory can be removed once coverage confirms eligible users always have that tab and closed registration stays respected.

## Register

**What is wrong.** The actual flow is already linear. The phone capture shows a framed lookup, two framed choices, a detached consent row and a second accent-edged panel. The lookup and receipt look like matching cards even though only the receipt needs a surface. Keep the two large choices and the distinct receipt approved in the earlier design.

```text
Register a league
FPL league ID                         League type
[ 49824                    ]           [ Draft | Classic ]
✓ ST League
  Draft · 4 managers

Choose a plan
[ Standard       ○ ]   [ AI Broadcaster   ○ ]
[ €6.99 / month    ]   [ €19.99 / month     ]
Shared viewer limit

[ ] I agree to the Terms and Conditions …
╭ Selected plan ──────────────────────────────────╮
  Standard · €6.99 / month     Continue to payment
  Renewal and checkout disclosures
╰─────────────────────────────────────────────────╯
```

1. In `LeagueCheckoutPage.tsx` and `billing.css`, take the fill, border and inset padding off `.checkout-league-panel`, including the shared declaration with `.checkout-summary`. Keep the labeled ID control and the custom Draft/Classic segmented buttons aligned on one line where they fit. Give the ID field enough width to read its value at 390px. Stack when the layout cannot fit both controls, including at 320px with large text. Preserve the selected appearance and actual verification behavior.
2. Use one aligned verification area directly under the fields. Show the verifying status, then the existing check with verified name and details. Put invalid-ID feedback at the ID and service errors/retry here too. Keep the verification result in the page flow with no inner box. Let multiline feedback grow. Keep focus and scroll stable while the user types.
3. Retain the two existing plan tiles, the native radios, the selected border and one clear price per card. Use two columns when each tile remains readable and a single column on phones. Keep the plan names, billing interval, current prices, AI availability and shared viewer limit from existing sources. If recovering space, trim outer gaps and duplicated phrases first. Keep the whole label tappable and give keyboard focus its own outline.
4. Keep consent after the tiles and 8–12px above the receipt, in a comfortably tappable row. Preserve real checkbox behavior and the separate legal links. Keep the receipt as the remaining framed panel. Use a quiet border or fill once, with plan and price together, renewal disclosure underneath and payment next to them on desktop or below them on phones. Preserve terms validation, payment errors beside the action, checkout dismissal focus, and the existing mobile scroll assistance after intentional selection or consent when the next control is outside the usable viewport.
5. Style the closed, loading and error states in `LeagueRegistrationPage.tsx` on the same plain page frame. Keep the route back to Find leagues. Check both registration entry URLs, preselected plans, and the test case where checkout is unavailable.

## League management

**What is wrong.** At 390px the back control, large two-line heading and padded Privacy and followers panel push the first approval well down the screen. The switch is visually centered against the entire wrapped description. Refresh takes its own row. The emblem instructions and separate refund card extend the page substantially even when a user only came to manage access.

```text
‹ Back to league
League management
Sunday League Elite

Private league                        [ switch ]
New followers need approval. Existing followers keep access.

Follow requests (1)                  [ Refresh ]
Applicant name
[ Approve ] [ Reject ]
─────────────────────────────────────────────────
Followers (12)
Follower name  #105                   [ Remove ]
…
[ Previous ]       Page 1 of 2        [ Next ]
─────────────────────────────────────────────────
Team emblems                                 ⌄
─────────────────────────────────────────────────
Subscription                   Current status ⌄
```

1. In `LeagueManagementPage.tsx`, keep a compact back link and consolidate header spacing. Show the league name immediately below the title. Use one continuous, left-aligned settings column even on desktop. Keep access controls first. Remove the enclosing border and padding in `.league-membership-settings`. Keep its accessible section name through a heading, or use an accessible label if the section title is visually redundant.
2. In `LeagueMembershipSettings.tsx`, align the switch with the top label, with the explanation below. Place Refresh beside the follow-request heading as a quiet labeled control with a 44px target. Desktop request rows can put actions beside the applicant. In narrow space, put the two actions directly beneath the name with primary emphasis on Approve. Use one divider between groups and quiet text for empty states. Avoid reporting zero while a count is still loading.
3. **Followers stays visible** for public and private leagues, even with no followers. Show the count, name and secondary ID. Give Remove a consistent trailing position and a quiet destructive color, with an accessible name that identifies the follower. Keep confirmation and the behavior described there. Preserve paging, access permissions, focus after removal, final-page recovery and refresh after approval. Keep errors local to the affected control or list.
4. Present **Team emblems** and **Subscription** as two progressive disclosures, collapsed on first entry. Use keyboard-operable disclosure controls with clear expanded state. Keep each section's body in the same flow when opened, with no additional outer card. Within emblems, put format guidance next to the upload workflow and keep errors with the affected team. Within Subscription, show plan/status once data exists, keep plan and billing actions together and surface refund/help as a small separate subsection within the expanded section. Preserve refund terms and the links or actions that reach them. Keep mounted forms and confirmations intact across disclosure toggles. Scope presentation changes to League Management because billing content can also render from account subscriptions.

## Phone standings

**What is wrong.** The narrow H2H rules hide some desktop columns but reserve a full Form column. A 44px picture control wraps separately from the club, and the manager begins at the cell edge while the club starts after its emblem. Preview adds its own form and points widths and explicitly stacks the picture control. The 320px capture shows names splitting into three lines while the points sit against the outer border. Shrinking type or touch targets would leave the underlying alignment problem.

```text
 Rank   Club                              Pts
  1     [crest] Bonus Point Wanderers      6
 ↑2             Luka                       115 FP
        [W][L][W][D][W]          [image]
 ───────────────────────────────────────────────
```

1. In `LeagueStandingsTable.tsx` and `leagues.css`, keep a real table and use three visible phone columns. Give Rank about 36px, Points about 60–68px including its inset, and the remaining width to Club. Use a consistent 12–16px inset from the panel edge to the right-aligned score. Align rank and score to the first line of identity and keep their secondary values directly below. Use tabular digits. Expose the full column label to assistive technology. For H2H, show the compact `FP` label next to the secondary value with “Fantasy points” available as its full name. Total-points leagues show one score and no form.
2. Build the identity as a compact crest slot around 24px and a `minmax(0, 1fr)` text slot. Put the club link and manager on two lines sharing the same left edge. Let a long club or manager name wrap within the identity slot and keep the link navigable. If needed, add a standings-specific presentation option to `LeagueTeamLink` so the manager can align with its name while existing callers keep their layout. Keep the missing-entry fallback and don't render an empty manager line.
3. Move H2H form into a supporting line inside the Club cell on phone. Place the existing image action on that same line at the trailing end of the cell. Keep the action's 44px target and accessible name, using a subdued icon treatment. Give five compact form dots around 16px each with 2–3px gaps. Keep order, result labels, provisional state and no-results meaning. If a long form fallback needs more room, let it wrap inside that line. For Total Points, the supporting line contains only the image button. Keep one active image control per row and the existing standings-level image action.
4. Scope the compact composition to this table at the current `max-width: 639px` breakpoint. Keep desktop columns and the desktop button position. If rendering responsive variants of form or action markup, use the same underlying JSX and handlers and use `display: none` on the inactive variant so it leaves the accessibility tree and tab order. Hide the phone's standalone Form header together with its cells. Update the conflicting rules in `images/league-images.css` and retire the corresponding preview-only table geometry in `public.css`. Preserve the shared rendering path through `LeagueStandingsOverview` and all FPL/Live, search, dialog, and image-export behavior.

## Implementation and acceptance

Implement and capture each screen before moving to the next. Capture the same fixtures at 320×740, 390×844, 844×390 and 1366×768. Also check tablet and large landscape at the project's Playwright sizes. A screenshot at default zoom and an enlarged-text pass should show readable hierarchy, no horizontal scroll and no clipped focus ring. Check the keyboard sequence and reduced-motion behavior.

| Screen | Cases that must pass |
| --- | --- |
| Find leagues | Default directory, search, immediate clear, Back, no matches, retry, long names, public/private/pending/rejected/open states, one page and multiple pages. Update `league-discovery-layout.spec.ts` geometry and style assertions to reflect the deliberate stacked phone layout and pending status. Preserve the underlying interaction coverage. |
| Register | Idle, verifying, verified, invalid, offline retry, unavailable AI, preselection, consent unchecked/checked, closed registration, checkout dismissal. Use `checkout-design.spec.ts`, `checkout-consent.spec.ts`, `checkout-dismissal.spec.ts` and `registration-navigation.spec.ts`. |
| Management | Owner and admin, public and private, zero and multiple pending requests, long names, follower removal confirmed/cancelled, final-page recovery, emblem upload and subscription actions. Extend `league-privacy.spec.ts` where the existing scenarios can verify the new layout. |
| Standings | Preview and registered league, H2H and Total Points, long names/emblems, missing club data, five results and no results, rank movement, large points values, correct image dialog, unchanged desktop alignment. Use `preview-league.spec.ts` and add focused geometry coverage for aligned identity and score columns if absent. |

Run `npm run check` and browser checks against a fresh build. Keep the change in the affected frontend features. Verify that the standings patch leaves the live broadcast scoreboard and generated share-image layout intact.
