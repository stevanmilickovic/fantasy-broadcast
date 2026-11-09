# League image creation plan

Status: implemented. Chrome, Firefox and WebKit verification is recorded below.
Actual iPhone save/share behavior remains a manual hardware check.

## Scope and entry points

Build four distinct image categories, each available in Square (1080 × 1080)
and Story (1080 × 1920). Start with one polished Fantasy Broadcast theme.

| Category           | Content                                                                                                                | Button location                                                  |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| League standings   | Top 12 clubs and managers, rank, movement and points; recent form and fantasy points where appropriate for H2H         | Right side of the standings heading                              |
| Gameweek matchups  | All pairings for the selected gameweek, names, managers, emblems, scores and result status                             | Right side of the matchups section heading                       |
| Individual club    | Featured club and manager, emblem, league position, movement and correctly labelled season totals; recent form for H2H | Discreet action beside each club's identity in its standings row |
| Individual matchup | One pairing with both club and manager identities, emblems, prominent scores and outcome/status                        | Top-right corner of each matchup card                            |

Individual club and individual matchup remain separate categories. Club images work
for both total-points and H2H scoring, across Classic and Draft leagues. Matchup
categories appear only for H2H. The entry point selects its category and subject
directly; users do not need to navigate a separate image-creation page.

Use a shared, square image button with the existing Lucide image-plus icon,
a quiet border/background and an approximately 44 × 44 px touch target. Keep it
visible on touch devices. Give it a contextual accessible name and tooltip, such
as "Create standings image" or "Create image for North Bank FC vs Expected Toulouse".
Preserve visible keyboard focus and sufficient contrast.

Reserve space for the buttons so they do not cover names, scores, logos, source
controls or the existing top-left provisional label. Place row buttons inside the
club identity cell with room for wrapping, rather than widening the mobile table.
Do not nest them inside club links or change ordinary club navigation.

## Preview and export experience

1. Press an image button to open a preview dialog with the selected content.
2. Choose Square or Story; update the composition while keeping the same data.
3. Download PNG, or use Share on devices supporting image-file sharing.
4. Close with the close button, Escape or backdrop; return focus to the trigger.

Reuse the native dialog and `useDialogMotion` conventions, including reduced motion.
Keep controls reachable on narrow and short screens, with a scaled preview that
preserves its aspect ratio. The export canvas always uses the chosen output
dimensions, independently of the device's viewport or pixel density.

Prepare the PNG before enabling Download and Share. Regenerate it when the format
changes; ignore obsolete generation results. Include a generating state, prevent
duplicate export attempts, and offer retry on failure without losing the snapshot.
Release generated object URLs and pending work when closing or leaving the league.
Treat cancelling the device share sheet as cancellation, not an application error.

Use a descriptive filename containing category, league, gameweek and format.
Keep Download available when native sharing is unsupported. Native Share opens the
device's share sheet; the available destinations are controlled by the device.

## Data correctness

- Capture a snapshot of the selected data and emblem metadata when opening the
  preview. Live polling continues in the app but must not change the open preview
  or the image being downloaded. Reopening captures the latest data.
- Reuse `LeagueStandingsOverview`'s displayed data and existing `leagueData` and
  `withLiveLeague` helpers. Do not calculate scores or automatic substitutions again.
- Standings and club images inherit the standings source. Matchup images inherit
  the matchups source and selected week. Preserve their independent FPL/Live choices.
- Label the source actually used. If Live falls back to FPL, label the fallback;
  do not label FPL scores as live. Historical weeks keep their FPL data.
- Include league name, gameweek, source, applicable live/provisional/final status,
  capture time, Fantasy Broadcast branding and `fantasybroadcast.net` fixed in the
  bottom-right corner of every image, including local previews.
- Distinguish H2H league points from cumulative fantasy points and total-points
  scoring. Only show additional individual gameweek totals if the selected source
  supplies them; do not infer them from incomplete squad data.
- Standings export the first 12 ranked clubs, or all clubs when fewer exist,
  independently of the table's search filter. Label a truncated table "Top 12".
  Preserve supplied ranks, ties and missing previous-rank information.
- Preserve zero and negative scores. Draws, upcoming fixtures, missing scores and
  unavailable movement need deliberate display states; never invent a win or zero.
- Resolve Draft league-entry IDs separately from FPL entry IDs when matching
  standings, fixtures and emblems. Never assume those IDs are interchangeable.
- Work entirely from data already authorized and loaded for the signed-in user.
  Export only the displayed identities and results, with no account emails or
  internal administrative metadata. No publicly accessible image URLs are created.

## Visual composition

Use dedicated export layouts with the existing plum palette, typography, cyan
accents and green/red result cues. Build a restrained branded background using
CSS or static vector decoration. Emblems remain optional, with a clean layout
when absent or broken. Reserve safe margins for story content and branding.

Adapt the composition to each format. For standings, keep 12 rows readable in
both sizes, prioritizing rank, identity, movement and primary points. H2H form and
secondary totals can be compact supporting information. Club and single-matchup
images should use the extra space for larger emblems, names and key numbers.

Support 1–10 matchups explicitly. Use a single column for small square collections
and two columns for larger ones; Story uses a vertical composition. Preserve fixture
order and test the ten-matchup case with long names. If an upstream league exceeds
ten pairings, divide it into numbered images rather than silently omitting fixtures
or reducing text indefinitely. The preview must make any additional pages apparent.

Long names must wrap within a defined text area. Validate readability at the image's
normal phone viewing size, not only at full export resolution. Avoid animations,
interactive controls and hover-dependent styling inside exported artwork.

## Technical ownership

Keep the implementation in `frontend/src/features/leagues/images/`:

- A reusable image button and one preview/export dialog.
- A small typed snapshot model covering the four categories and their metadata.
- Four presentation templates sharing their brand frame and small visual pieces.
- One PNG export helper and local styles.

`LeagueStandingsOverview` owns source-aware snapshot creation and the dialog.
`LeagueStandingsTable` and `LeagueMatchupsView` expose the contextual actions.
`LeagueDetailPage` supplies registered league identity for consistent headings.
Reuse `TeamEmblemProvider` metadata and existing ranking/name helpers; extract a
shared data helper only where this avoids duplicating existing rules.

Use HTML/CSS for the preview and browser-side PNG generation. Evaluate
[html-to-image](https://github.com/bubkoo/html-to-image) in the initial prototype;
load the exporter only when needed. Embed authenticated same-origin emblems and
required font resources before export. Wait for fonts and image decoding, and
handle failed images deliberately so the saved PNG matches its preview.

Use capability detection for [native file sharing](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share).
Generate the file ahead of the Share click so the native call occurs within the
user gesture. The intended first version needs no new backend endpoint, image
storage, database migration or public sharing route.

## Implementation sequence

1. **Prove export reliability.** Render a representative square/story card with
   emblems, gradients and fonts. Verify exact PNG dimensions, sharp text and image
   completeness in Chrome, Firefox and Safari, especially a real iPhone. Resolve
   renderer problems before expanding to all templates.
2. **Build the shared workflow.** Implement the snapshot model, square trigger,
   accessible preview dialog, format selection, PNG preparation, download and
   supported native sharing. Cover loading, cancellation, retry and cleanup.
3. **Add standings and club images.** Connect source-aware standings data, top-12
   selection and individual rows. Implement both templates in both aspect ratios.
4. **Add matchup collection and individual matchup images.** Connect selected-week
   data and independent source settings. Implement both templates and the dense
   ten-matchup layout, plus explicit overflow handling.
5. **Verify and launch.** Run the checks below, update the architecture notes and
   run `./scripts/test-stack.sh` so the local app includes the completed feature.

## Acceptance and checks

- All four entry points open the correct category and subject; existing navigation
  and matchup geometry remain intact at all six configured viewport sizes.
- Unit tests cover snapshot selection, source fallbacks, independent preferences,
  ranking/ties/movement, Draft ID mapping, missing data and fixture pagination.
- Browser tests cover opening/closing/focus, both formats, PNG download dimensions,
  live updates during an open preview, regenerating formats, failed emblem loads,
  export failure/retry, and supported/unsupported/cancelled native sharing.
- Inspect actual exported PNGs for all four categories in both formats, including
  12 standings rows, 10 matchups, long names, no emblems, ties and provisional scores.
  Download tests must check the artwork as well as file existence.
- Run Node 22 `npm run check` and relevant `npm run test:browser` tests against a
  fresh build. Extend export checks to Firefox/WebKit and verify real iPhone saving
  and sharing; Chromium emulation alone does not establish Safari compatibility.

## Deferred scope and main risk

Defer theme selection, editable backgrounds, drag-and-drop design tools, saved
image libraries, public share links and automatic social posting. First deliver
the four categories, two formats and reliable PNG download/native sharing.

Browser export is implemented with `html-to-image` 1.11.13, system Arial/Helvetica
fonts, predecoded embedded emblems and a second canvas draw to stabilize WebKit.
The automated tests exercise actual PNG downloads in Chrome, Firefox and WebKit.
Native file sharing uses pre-generated files and capability detection; cancellation
is covered with a simulated share implementation. Actual iPhone save/share behavior
has not been checked on hardware.

## Design basis

The templates use the app's plum/cyan identity, restrained gradients, a consistent
spacing grid, aligned numbers and a clear hierarchy from league to club to score.
Brand and website occupy stable corners; secondary metadata is quieter than results.
Separate compositions handle dense collections and individual featured results.
The approach follows the grouping, alignment and hierarchy principles in
[Material layout guidance](https://m2.material.io/design/layout/understanding-layout.html)
and [Apple's layout guidance](https://developer.apple.com/design/human-interface-guidelines/layout).
