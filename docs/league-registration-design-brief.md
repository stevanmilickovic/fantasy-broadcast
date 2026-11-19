# League registration design brief

Give league registration the density and finish of the signed-in league workspace. Keep the two substantial purple plan cards and the separate selected-plan panel. A customer should be able to identify their league, see what the extra €13 per month buys, agree to the terms, and continue in one downward pass.

## What the current page gets right

The order is right. The league verifies as the user types, the two prices are easy to find, consent is explicit, and the payment action has an accurate label. The plum background, white typography and cyan accent already belong to Fantasy Broadcast. Keep those decisions.

## What looks unfinished

I reviewed the running app at 1366 × 768 and 390 × 844 with the browser fixtures. The following measurements are from the populated Standard-plan view at normal zoom.

| What appears on screen | Why it matters |
| --- | --- |
| The laptop has a 56px page title followed by a bordered panel headed “Your league”. Its verification result gets about 430px of its own bordered space. | The title and nested result box give a short lookup the visual weight of a whole workflow. On the phone, the verification panel alone is about 316px tall. |
| The selected Draft button has the same solid cyan emphasis as the payment button. The plan names are small cyan labels and the billing unit next to each price is tiny. | A default league type attracts more attention than the names of the products being purchased. The monthly commitment is easy to overlook. |
| Both plan cards repeat three benefits. The reason to buy AI appears last. Each card ends in a 44px imitation button containing a browser radio, even though the entire card already selects the plan. | The user has to read both lists to discover the difference. The bottom strip suggests a second action and leaves a hole above it in Standard. On the phone the AI card begins around y=874, below the first viewport. |
| Consent sits by itself between two substantial vertical gaps. In the populated laptop summary, the plan and its price are almost a column-width apart. A nearly 1,000px-wide payment button sits beneath two paragraphs. | The smallest control looks detached, and the final box makes the eye travel to assemble a simple purchase decision. On the phone the summary takes about 300px. |

## Visual references

Use **Find leagues** for the scale of the heading and field, its muted plum surface, fine borders, and the way a league name and its metadata read as one item. Use **My leagues** for the 6px card corners, visibly interactive border and 140ms transitions. Use **Pricing** for the recognizable two-card pairing, strong price and legible billing unit. Keep registration's header, workspace tabs and footer as the common frame.

IBM Carbon explicitly uses single-select tiles for pricing plans. Its whole-tile target and always-visible selection indicator solve the ambiguity of the current radio strip. Shopify’s checkout example puts the price totals and final action together on both mobile and desktop. Borrow these two interaction decisions and use Fantasy Broadcast’s own controls and colors. [IBM Carbon tile guidelines](https://www.carbondesignsystem.com/building-blocks/core/components/tile/guidelines) · [Shopify Checkout](https://www.shopify.com/checkout)

## Implementation plan, in reading order

### 1. Make the top one compact league lookup

Move the existing **Register a league** heading into the league panel and retire the visible **Your league** heading. Use the page heading as the field group's accessible label. Start around 30–32px on laptop and 26–28px on phone. Give the panel the muted registration surface and restrained accent edge already found in the workspace. Set the page's content cap around 900–960px, keep the 16px phone gutters, and align every section to the same edges.

Put the labeled **FPL league ID** field and **League type** selector on one line when they fit. Give the input the dark inset, 4px corners and focus outline of the Find leagues field. Present Draft and Classic as two segments inside one track. Use a quiet tinted fill, stronger text and a visible edge on the selected segment. Keep the 44px hit height. On a 390px phone, aim to fit the ID and type side by side. Stack them when the labels, values or touch targets need more space.

Put verification directly below those controls, aligned with the input. Idle can be quiet with an empty status line. While a lookup is pending, show a small spinner and “Verifying league…”. On success, show a green check, the **league name**, and muted metadata such as “Draft · 4 managers”. Give the name first claim on the space and let long names wrap. For an invalid ID, show the correction at the field. For a failed lookup, show the reason and the existing retry action there. Reuse the same area for each state, allowing a long error to grow. Typing or receiving a result must leave focus and scroll with the user.

### 2. Make each plan card one obvious choice

Retain two equal-width, equal-height cards on desktop and stack them in the same order on narrow screens. Preserve the recognizable purple surfaces and the subtle AI treatment. Use roughly 20px of desktop padding and 16px on phones. Let the contents determine height. Keep the shared features and viewer rule available without repeating the full comparison.

| Card | Name and price | Main detail |
| --- | --- | --- |
| Standard | **Standard** · **€6.99** per league / month | Live matchday broadcast, league standings and teams. |
| AI | **AI Broadcaster** · **€19.99** per league / month | Everything in Standard, plus **AI voice commentary**. |

Use these as copy and hierarchy guidance. Render prices and the viewer limit from their existing constants. Give the name a readable white semibold heading, the price the largest type in the card, and the unit a readable muted 13–14px. Place the limit once immediately below the pair, for example “Both plans include up to 50 simultaneous viewers. Each open tab or device counts as one viewer.”

Use the whole card as the label for its existing native radio. Replace the full-width “Select plan” strip with a small, always-visible ring in the card header. Fill its center and accent the card border when selected. Hover may brighten the surface. Keyboard focus needs its own outline around the card, distinct from its selected state. Give each radio a short accessible name and associate its price and details as a description. When AI is unavailable, put the reason on the AI card and keep Standard usable. A plan selected on Pricing carries through. A fresh visit starts without a paid plan selected.

### 3. Bring consent visually closer to the review

Keep consent **after both cards and before the separate summary**. Leave about 8–12px between the consent row and that panel, with more space above the row. Use an 18–20px dark square, the same border and small corner radius as the app's fields, and a cyan fill with a contrasting check when accepted. Keep a real, initially unchecked checkbox and a generous clickable label area. The text should align with the first line, including when it wraps. Preserve the existing agreement wording and both policy links. Opening either link must leave consent as the user set it.

### 4. Make the separate summary read like a receipt

Keep the accent-edged panel. Use **Selected plan** as a small label. On the next line, put **Standard · €6.99 / month** together on the left and a content-width **Continue to payment** button on the right. Place the renewal and checkout details beneath the plan, in muted, readable text. On phones, stack the plan, details and full-width button in that order. Before selection, use “Choose a plan” in the same summary position. Keep the bottom action as the only way to open payment.

Tighten the existing disclosures while preserving their meaning. A possible wording is “Renews monthly during the Premier League season. Cancel to stop the next renewal.” Follow with “Checkout shows today’s total, renewal amount and any tax before you pay.” An unavailable payment or payment error belongs beside the bottom button. A dismissed checkout returns focus there with selections intact.

### 5. Use motion to explain state

Use the workspace's roughly 140ms transition for segment selection, the radio fill, checkbox and card border. A brief fade from spinner to verified check is sufficient. Reserve green for verification and solid cyan for the primary action or a small selected indicator. Keep panels stationary under the pointer. Under reduced motion, show the end state immediately.

On phones, preserve the existing forward assistance after a deliberate plan tap or consent tap. Scroll the minimum distance needed to reveal consent or the payment action when it is outside the usable viewport. If it is already visible, leave the page still. Check this with the mobile keyboard, short landscape viewports and wrapped billing text. Keep ordinary keyboard navigation in document order.

## Handoff and acceptance

Work primarily in `frontend/src/features/billing/LeagueCheckoutPage.tsx` and `frontend/src/features/billing/billing.css`. Use `frontend/src/features/leagues/leagues.css` and `workflow.css` as the workspace references. Scope the new control styling to registration. The existing lookup, pricing, consent persistence within the form, registration access, and checkout already supply the necessary behavior.

1. At **1366 × 768**, a user can read both plan names, prices and differences at once. At **390 × 844**, aim for both names and prices in the initial viewport with an ordinary verified league. Recover space from the repeated headings, radio strips and duplicate benefits. Preserve type size and touch targets.
2. Compare captures of the initial, verified, selected and consented states with Find leagues at the same zoom. Also check 320px width, a short landscape phone, tablet and wide desktop. Long league names, errors and enlarged text can extend the page naturally.
3. Test both plan cards from their header and body, then by keyboard. Selection changes exactly once and updates the summary immediately. Check visible focus, screen-reader names, high-contrast controls, reduced motion, and each consent link independently.
4. Exercise lookup failure and retry, unavailable AI, unavailable payment, missing consent, checkout dismissal and closed registration. Each message appears beside the control that owns it. A user can recover without re-entering earlier choices.
5. Run the frontend checks and browser workflow suite against a fresh build. Update assertions coupled to the old visual geometry while retaining checks for accessible names, required consent, intentional scrolling and checkout behavior. Judge the result from laptop and phone screenshots as well as passing tests.
