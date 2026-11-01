# Configurable league subscription proposal

Status: **Deferred for future consideration.** Retain this proposal and calculator as planning references; implementation has not been approved. Revisit provider prices, account terms, and measured application capacity when development resumes.

Research date: 1 November 2026. Proposal only; no application, catalog, or subscription changes have been made. The accompanying [calculator](custom-tier-pricing-calculator.html) runs locally without contacting any service.

## Recommendation

Keep Standard and AI Broadcaster for leagues with up to 50 teams and 50 concurrent broadcast viewers. Add Custom when either requirement exceeds 50, with independently selected capacity and optional AI highlights. Use packs of 50 for both dimensions.

Proposed monthly price:

```text
extraTeamPacks   = max(0, ceil(actualTeams / 50) - 1)
extraViewerPacks = max(0, ceil(requestedViewers / 50) - 1)
price = EUR 4.99 + EUR 3 * extraTeamPacks
                 + EUR 2 * extraViewerPacks
                 + EUR 10 if AI is included
```

Teams means FPL manager entries, not football players, followers, or registered app accounts. Viewer slots retain the current broadcast tab/device definition; reconnecting the same tab should not consume a second slot.

These are suggested list prices. The economics below treat them as **before VAT**. This does not establish or change the existing Paddle tax configuration: if those amounts are advertised tax-inclusive, the revenue available to cover costs is lower. Always show Paddle's localized final total before payment.

| Teams | Concurrent viewers | Without AI/month | With AI/month |
| ---: | ---: | ---: | ---: |
| 50 | 50 | EUR 4.99 | EUR 14.99 |
| 50 | 100 | EUR 6.99 | EUR 16.99 |
| 100 | 50 | EUR 7.99 | EUR 17.99 |
| 100 | 100 | EUR 9.99 | EUR 19.99 |
| 250 | 250 | EUR 24.99 | EUR 34.99 |
| 500 | 250 | EUR 39.99 | EUR 49.99 |
| 1,000 | 1,000 | EUR 99.99 | EUR 109.99 |
| 5,000 | 5,000 | EUR 499.99 | EUR 509.99 |

These are candidate commercial prices, **not certified server capacities**. Release capacities only after testing their combinations and total simultaneous leagues. Start with a conservative tested ceiling and expand it; larger requests can receive an owner-reviewed quote.

The formula avoids a single multiplier that incorrectly multiplies AI cost by audience size. When teams and viewers grow together, each additional 50 of each costs EUR 5. A large audience for a small league costs less than a large league with the same audience.

## What the current application actually costs

The application already shares one live session and one generated narration per league. New viewers do not independently poll FPL or generate more ElevenLabs audio. However, they do download the live feed, images, and audio.

Germany is assumed. Hetzner documents 20 TB/month outgoing traffic for EU CX/CAX servers and EUR 1/TB overage. The allowance belongs to the **whole server**, not each league. Incoming/internal traffic is excluded. Verify the exact server and invoice before committing margins. [Hetzner traffic](https://docs.hetzner.com/robot/general/traffic/)

Do not divide the entire VPS bill by one league forever, or assume its CPU is unlimited because bandwidth is inexpensive. Budget shared hosting, backups, monitoring, and support across paying leagues, then check actual aggregate utilization. A provisional EUR 20-60/month infrastructure budget for an expanded deployment is an assumption, not a capacity guarantee or provider quote.

The current live feed sends full squads and standings every 10 seconds. A synthetic 15-player Classic squad model based on repository fixture shapes produced these uncompressed estimates, at full viewer occupancy for 60 active hours/month:

| Teams/viewers | Approximate full JSON/update | Uncompressed live transfer | Transfer at a hypothetical 20 KB/update |
| ---: | ---: | ---: | ---: |
| 50/50 | 264 KB | 0.285 TB | 0.022 TB |
| 250/250 | 1.32 MB | 7.13 TB | 0.108 TB |
| 1,000/1,000 | 5.28 MB | 114 TB | 0.432 TB |
| 5,000/5,000 | 26.4 MB | 2,854 TB | 2.16 TB |

These are payload extrapolations, not measured Internet traffic or load benchmarks. Compression could substantially reduce the first traffic column. Synthetic squads repeat data and compress especially well; do not promise those compression ratios in production. The 20 KB column is an engineering scenario, **not an implemented or measured result**. At 1,000 teams/viewers, the uncompressed example also implies about 4.2 Gbit/s peak delivery, independent of the monthly allowance.

```text
liveTB = averageWireBytesPerUpdate * 360 * activeHours * averageViewers / 1e12
transferCost = max(0, totalOutgoingTB - remainingSharedServerAllowanceTB) * EUR 1
```

Add initial page loads, reconnects, logo downloads, and audio to live transfer. Concurrent slots do not limit monthly distinct visits. At 5,000 teams and the current 200 KB emblem cap, stored emblems total approximately 1 GB. But 5,000 cold visitors each loading every emblem means 5 TB transferred per complete round; two rounds mean 10 TB. Pagination, small list thumbnails, lazy loading, and existing immutable image caching matter. CDN caching should be measured rather than assumed to eliminate authenticated live traffic.

There is no finite absolute cost ceiling implied by viewer slots alone. Continuous broadcasting, rapidly changing visitors, reconnects, or abusive requests can increase traffic. The calculator includes a 744-hour month and adjustable visits; production needs rate limits, bandwidth alerts, bounded work, and stated reasonable-use terms. Avoid surprise metered invoices to league owners in the first release.

## AI allowance and manual ElevenLabs top-ups

Manual top-ups are supported; automatic top-ups can be enabled later. Generation stops when funds run out. An account funded through PAYG retains its underlying plan restrictions. Free-plan content is described as non-commercial with attribution, while paid plans grant commercial rights. Confirm commercial rights for the exact account/voice arrangement before selling this add-on; purchasing credits alone should not be assumed to change the license. [PAYG](https://elevenlabs.io/docs/overview/administration/pay-as-you-go), [billing and commercial rights](https://elevenlabs.io/docs/overview/administration/billing)

The configured model is `eleven_multilingual_v2`. Its published API rate is currently USD 0.08 per 1,000 characters; Flash/Turbo is USD 0.04. Actual account terms, currency conversion, and taxes can differ. Changing models requires an audio quality check. [ElevenLabs API pricing](https://elevenlabs.io/pricing/api)

For a predictable EUR 10 AI add-on, propose **up to 200 curated audio highlights per billing month, at most 220 characters each**, retaining the existing 40/gameweek pacing limit. This is highlights coverage of the league, not narration of every event involving every team. The current 40/gameweek cap is an upper bound, not a promise to generate 200 messages in quieter months.

- Maximum 44,000 characters: USD 3.52 voice generation at the published Multilingual rate.
- Text generation is small: 200 requests at an assumed 2,000 input and 256 output tokens are approximately USD 0.04 using the configured `gpt-5-nano` rates. Actual prompt lengths/retries vary. [Official model pricing](https://developers.openai.com/api/docs/models/gpt-5-nano)
- For planning, the calculator reserves EUR 4.40 voice plus EUR 0.06 text, before its additional 25% general cost buffer. These EUR values are conservative assumptions, not quoted currency conversion rates.
- At 128 kbit/s and an illustrative 16 seconds/highlight, all 200 clips total about 51 MB per viewer/month. More viewers multiply this delivery traffic, not the generation bill.

The existing 100,000-character **global monthly** guard is shared across every league. It cannot guarantee this allowance to each paying league. Add durable atomic reservations per league/billing period plus a separate account-wide spend guard, accounting for concurrent jobs, retries, and upgrades. Track provider usage even for failed or unused generations; avoid duplicate generation for the same event. Switching AI off and on must not reset an allowance. A mid-cycle upgrade must either prorate its allowance with the charge or explicitly price a full allowance; downgrades preserve already paid access through period end.

Show remaining allowance and notify the operator before prepaid balance exhaustion. Text fallback preserves the scoreboard but does not fulfill a promise of available paid voice. At larger scale, a fixed allowance remains affordable but cannot cover every team's events. Additional explicitly purchased highlights packs could follow later; do not include automatic overage charges initially.

## Margins and the multiplier

Paddle's published standard fee is 5% plus USD 0.50 per checkout transaction. This proposal budgets the fixed component as EUR 0.50 for illustration; actual settlement conversion and other applicable fees must come from Paddle. [Pricing](https://www.paddle.com/pricing), [supplier settlement terms](https://www.paddle.com/legal/terms)

Calculate margin after tax, fees, allocated hosting, transfer, generation, and a risk reserve. Trial credits are not a sustainable cost reduction. A useful target for the overall Custom plan is around 70% contribution margin, with lower margin on the separately optional AI component at full usage. This is before company overhead, income tax, refunds, development, and acquisition costs.

For a tax-exclusive price `P`, tax fraction `t`, fee percentage `p`, fixed fee `F`, buffered direct cost `C`, and target contribution margin `m`:

```text
grossPayment = P * (1 + t)
contribution = P - p * grossPayment - F - C
minimumPretaxPrice = (C + F) / (1 - p * (1 + t) - m)
```

At no VAT, 5% fee, EUR 0.50 fixed fee, and 70% target margin, this is approximately **4 times buffered direct cost plus EUR 2**. At 20% VAT it is approximately **4.17 times cost plus EUR 2.08**. This is a sanity floor, not the customer-facing pricing formula. Set the pack prices from value and measured costs; recheck whether the floor is met for real usage and aggregate server allocations. A small plan cannot carry the cost of an otherwise empty server at a high margin.

## Automatic selection and Classic league growth

1. Owner enters the FPL league ID. Use cached, complete membership discovery to count actual manager entries and recommend Standard, AI Broadcaster, or Custom. FPL failures or partial page results must not change billing.
2. Round team capacity up to 50. Owner selects concurrent slots in packs of 50 and whether to add AI, with its allowance shown next to the checkbox. The selected viewers may be lower than the number of teams.
3. Preview the localized recurring total and immediate charge, then ask the owner to purchase. Recommendation is automatic; charges and capacity upgrades require owner approval.

Proposed permanent courtesy buffer for **growth of existing paid leagues**:

```text
growthBuffer = min(25, max(5, ceil(paidTeamCapacity * 0.10)))
```

Thus a 50-team subscription continues through 55, 100 through 110, and 250 through 275. A newly registered 51-team league starts on 100-team capacity; the buffer protects later growth rather than reducing the initial advertised requirement. Existing 49 -> 54 can stay on its current subscription. Existing 49 -> 56 needs the next pack.

Reuse hourly roster caches. Confirm an excess using complete successful observations at least 24 hours apart; issue the owner a clear notice and upgrade preview. Give 14 days to resolve it, and preserve the remainder of an already paid period if longer. No silent upgrade or surprise charge. If unresolved, stop the undersized subscription from renewing and pause new broadcasts after paid access/courtesy grace ends; retain the league data. Exact notice and renewal behavior must be disclosed before purchase and tested around renewal boundaries.

Bound the courtesy import to at most one extra 50-team pack beyond nominal capacity while waiting. A jump from 49 to thousands must trigger an upgrade requirement before warming thousands of squads. Keep the last complete state visibly marked as awaiting a capacity update; never silently present partial standings as complete.

Viewer slots have a hard admission cap, without this roster buffer. Additional tabs see the existing capacity-full state. Count disconnected/reconnecting tabs using expiring leases, and do not disconnect a live audience merely because the owner scheduled a future downgrade. Lower team/viewer capacity and AI removal take effect after the paid period; a lower tier must fit the then-current league. Membership decreases do not silently reprice or oscillate the subscription.

## Paddle integration

Use a single monthly subscription containing catalog components, rather than generating a new price for every possible combination. Keep the existing Standard and AI price IDs for those plans. Add these monthly prices for Custom:

| Component | Unit price | Quantity |
| --- | ---: | ---: |
| Custom base, includes 50 teams/50 slots | EUR 4.99 | 1 |
| Additional 50 teams | EUR 3.00 | extraTeamPacks |
| Additional 50 viewer slots | EUR 2.00 | extraViewerPacks |
| AI highlights allowance | EUR 10.00 | 1 when selected |

Omit zero-quantity items. A 500-team/250-viewer league with AI has quantities `1, 9, 4, 1`, totaling EUR 49.99 before VAT. Paddle supports multiple recurring items with quantities on one subscription, provided their billing intervals match. Updates send the **complete desired item list**; omitted items are removed. [Recurring add-ons](https://developer.paddle.com/build/subscriptions/add-remove-products-prices-addons/)

Implementation requirements:

- Backend creates and persists an expiring quote bound to owner, FPL league/type, capacities, AI allowance, currency, catalog price IDs/quantities, and pricing version. Sign/bind that complete quote, not just a plan enum. Never trust a browser-supplied amount.
- Create the Paddle transaction server-side and open its ID through the existing Paddle.js flow. Set explicit allowed catalog quantities consistent with the tested maximum.
- Reuse webhook verification, event deduplication, reconciliation, payment grace, cancellations, refunds, and invoices. Provision from verified paid items and trusted price IDs, independently of array order. A client success callback does not grant access.
- Replace the current exactly-one-item/quantity-one parser. Store current and renewal team limits, viewer limits, and AI quota rather than treating all rights as one plan enum. Keep old catalog versions recognizable for existing subscribers.
- Preview upgrades, then use `prorated_immediately` and `on_payment_failure: prevent_change`; failed payment retains existing access. Lower renewal prices without immediately removing paid capacity/AI. `do_not_bill` alone does not implement delayed application entitlements. [Subscription update API](https://developer.paddle.com/api-reference/subscriptions/update-subscription/)
- Handle growth between checkout and webhook fulfillment as a capacity-growth issue, not a reason to reject a successfully paid subscription. Preserve existing owner/league authorization checks.

Non-catalog recurring prices are also supported and useful for negotiated enterprise exceptions, but ordinary packs are easier to audit and reconcile. [Custom transaction prices](https://developer.paddle.com/build/transactions/bill-create-custom-items-prices-products/)

## Required application changes and suggested commits

1. **Model configurable league entitlements and pricing.** Backfill existing subscriptions to 50/50; add quote/version and current/renewal capacities. Test money, rounding, authorization, and legacy behavior.
2. **Discover complete Classic membership with bounded caching.** The current preview reads only the first standings page and uses a 51 sentinel. Registration, live state, standings, and discovery need consistent pagination/deduplication. Preserve caches and avoid per-viewer or per-slider FPL calls.
3. **Prepare broadcasts and AI budgets for larger leagues.** Send shared serialized updates/deltas, limit loaded details, paginate team views, add small list thumbnails, isolate slow league refreshes, and account for AI allowances atomically. Current polling uses a shared synchronized path and serial sends; do not just replace 50 with 5,000.
4. **Support multi-item Paddle checkout and provisioning.** Introduce configured catalog IDs, signed quotes, paid item parsing, and capacity changes. Sandbox-test duplicate/out-of-order webhooks, failed payment, VAT/currency, period-end downgrades, and checkout-time membership changes.
5. **Add Custom selection and owner management.** Automatic recommendation, independent viewer control, AI allowance, Paddle preview, mobile-friendly explanation and capacity status. Update existing fixed-limit labels and emblem/team authorization paths.
6. **Handle growth notices and validate launch limits.** Add confirmed growth states, bounded grace and non-renewal handling; test reconnects, membership failures, capacity shrink, renewal boundaries, and provider exhaustion. Run realistic load/soak tests on the actual deployment before enabling each advertised capacity.

Multiple backend instances additionally require a shared viewer registry and shared/sticky authentication: current viewer lists and authentication sessions are process-local. A higher price or a second server alone does not solve this.

Not checked: the actual Hetzner invoice/plan, ElevenLabs account-specific rate/license, production wire compression, or measured maximum deployment capacity. No live billing changes or server load tests were performed.
