# Subscription management

One purchasing owner manages each league subscription from **League actions → Manage
subscription**. Followers can remove a league from their list without changing billing.
League deletion is disabled so it cannot leave a paid subscription running in Paddle.

- Upgrades use Paddle's preview and charge the remaining-period price difference
  immediately. Failed payments preserve the old plan and renewal date.
- Downgrades replace the renewal price with no mid-period adjustment. The app retains
  AI access through the already-paid period. Keeping AI before that date costs nothing.
- Cancellation stops renewal and retains access through the paid period. It can be
  undone before taking effect. Returning after cancellation requires a new checkout.
- Failed renewals receive three days of grace after the previous paid period ends.
  Payment details and invoices open in a temporary Paddle customer-portal session.
- An hourly reconciliation imports existing signed app purchases, repairs missed events
  and schedules cancellation before off-season renewals. Season dates come from FPL
  fixtures; the final month and fixture completion determine the cancellation boundary.

## Refunds for the administrator

Customers email refund requests using the link on their subscription page. In
**Administration → Subscriptions & refunds**, search the owner's email, league name,
FPL ID, payment reference or subscription ID, then select the subscription and payment.

The screen shows purchase dates, tax-inclusive amounts, remaining refundable balances,
previous refunds and the initial 14-day window. This indicator is informational: service
issues and statutory rights may justify other refunds. An upgrade does not restart the
voluntary initial-purchase refund window.
An upgrade-only change-of-mind refund is a manual decision, not a separate guaranteed
14-day refund offer. Applicable consumer rights remain unaffected.

1. Select **Review refund**, choose the full remaining balance or a partial amount,
   and enter the reason from the customer's request.
2. Decide whether approval should also end the subscription and its paid access. This
   defaults on for an initial purchase within 14 days. Partial goodwill refunds can keep
   the subscription running. Review this choice explicitly.
3. Review the amount, customer and access consequences, then submit to Paddle.
4. Pending approval is not a completed refund. Webhooks or **Refresh payments & refunds**
   update the outcome. After approval, access ends if selected; the background worker
   cancels that subscription immediately, retrying if Paddle is temporarily unavailable.

An initial purchase followed by an upgrade can have two separate payments. Review both
when resolving a request to refund the whole purchase; refunding one payment does not
automatically refund the other. Refunding an upgrade alone can be a partial goodwill
remedy, so explicitly choose whether to retain or end access.

Duplicate requests share a durable reference. A request whose outcome is uncertain
blocks further submissions for that payment. Refresh first: an adjustment found in
Paddle is matched using the internal reference in its reason. If no adjustment can be
confirmed, inspect the transaction in Paddle or contact Paddle support; do not submit
a second refund in another tool without first establishing the original outcome.

## Paddle setup

### Existing products and prices

No new products or prices are required for subscription management, refunds or invoices.
Reuse the existing Standard and AI Broadcaster monthly recurring price IDs. Plan changes
replace the price on the existing subscription instead of creating another subscription.

Configure `PADDLE_API_KEY`, `PADDLE_CLIENT_SIDE_TOKEN`, `PADDLE_STANDARD_PRICE_ID`,
`PADDLE_AI_BROADCASTER_PRICE_ID` and `PADDLE_WEBHOOK_SECRET_KEY`. Set Standard to
EUR 6.99/month and AI Broadcaster to EUR 19.99/month in Paddle. Both prices must be
monthly recurring prices, quantity one. `PADDLE_API_URL` defaults to the sandbox API.
For the local Docker stack, add sandbox values to the ignored `.env.testing` file.
Never commit credentials. Sandbox and live use their own credentials, price IDs and
notification destinations. For production, set `PADDLE_API_URL=https://api.paddle.com`.
Billing stays unavailable if the API URL, browser token and modern API key refer to
different environments. Legacy API keys have no environment prefix; Paddle validates
their account when called.

### API permissions and webhooks

Check that the backend API key has these permissions; an existing key with these
permissions needs no change:

- `subscription.read` and `subscription.write`: status, plan changes and cancellation.
- `transaction.read` and `transaction.write`: checkout creation and payment history.
- `adjustment.read` and `adjustment.write`: refund balances, submissions and outcomes.
- `customer_portal_session.write`: authenticated payment management and invoice access.

Configure a public HTTPS notification destination at `/api/paddle/webhook`. Keep
`transaction.completed` enabled and add all subscription lifecycle events, plus
`adjustment.created` and `adjustment.updated`. Copy that destination's signing secret
into `PADDLE_WEBHOOK_SECRET_KEY`. Keep the public webhook reachable when testing;
localhost alone cannot receive Paddle notifications.

Verified webhook events are saved to the database before acknowledgment. A background
worker processes them separately, retries failures after 30 seconds, and recovers
unfinished work after a restart. Duplicate deliveries reuse the saved event. Existing
processed events remain processed when migration `018-paddle-webhook-inbox` runs.

Checkout requires explicit acceptance of the current terms version, checked on the
server and recorded with its timestamp in the saved checkout and Paddle metadata.
When terms change, update `PaddleCheckoutService.TERMS_VERSION` and the frontend's
`policyVersions.ts` together. An unfinished checkout with older terms is cancelled and
replaced after the customer accepts the current terms; completed payments are not changed.

Purchase verification uses the saved checkout record, so API-key rotation does not
invalidate outstanding checkouts, including earlier HMAC checkouts with saved operation
records. Historical purchases without an operation record retain their original HMAC
verification and still require the API key that signed them.

### Customer portal and invoices

Invoice generation and downloads are provided by Paddle's hosted customer portal. The
app's **Payment details & invoices** button opens a temporary authenticated portal
session. No separate invoice product, price or app-generated PDF is needed.

Keep customer-portal plan changes disabled: the app owns the delayed-downgrade policy;
Paddle's portal may apply downgrades immediately. Payment updates, invoices and cancellation
remain available through the portal.

### Default payment-link page

The app provides a public `/pay` page. Set Paddle's default payment link to
`https://YOUR_APP_DOMAIN/pay` for the relevant sandbox or live environment, and ensure
the domain is on that environment's approved websites list. Use the deployed page;
an arbitrary app URL does not initialize checkout automatically.

Paddle email links append `?_ptxn=txn_…`. The page validates the transaction reference,
loads the browser-safe client token from `/api/paddle/configuration`, and initializes
Paddle.js in the matching environment. Paddle automatically opens the existing transaction,
including payment-method updates. No sign-in, new subscription or new transaction is
created by visiting the page. Missing or invalid references do not load checkout.

The page handles completion, dismissal, configuration errors and SDK loading failures.
Customers can reload the same link to reopen checkout. Completion is informational;
signed server webhooks remain authoritative for subscription access. Only the public
client-side token is returned by the configuration endpoint; API keys and signing secrets
stay on the backend. No additional server secrets or price IDs are required.

Paddle requires a default payment link when creating transactions and also uses the
page for payment-method update links. Verify both direct payment links and payment-method
updates with your Paddle sandbox account after deploying and configuring `/pay`.

### Verification before launch

Use sandbox purchases to verify an upgrade, downgrade, cancellation/undo, failed payment,
pending/approved/rejected refund, invoice download and direct payment links before
enabling production credentials. Automated tests use isolated databases and mock payment
responses; they do not charge cards or
issue real refunds. No real payment actions are executed during development checks.

References: [Paddle plan changes](https://developer.paddle.com/build/subscriptions/replace-products-prices-upgrade-downgrade/),
[subscription provisioning](https://developer.paddle.com/build/subscriptions/provision-access-webhooks/),
[refund adjustments](https://developer.paddle.com/api-reference/adjustments/create-adjustment/),
[customer portal sessions](https://developer.paddle.com/api-reference/customer-portals/create-customer-portal-session/),
[default payment links](https://developer.paddle.com/build/transactions/default-payment-link/).

### Temporarily offering Standard only

Set `PADDLE_AI_BROADCASTER_ENABLED=false` in the backend environment file
(`data/backend/application.env` in production or `.env.testing` for the local
Docker stack). AI purchases and plan changes to AI are disabled by default.
Set it to `true` to offer AI Broadcaster again. Restart/recreate the backend
after changing its environment. The frontend reads availability from the backend;
it needs no separate flag or rebuild.

When disabled, pricing and checkout keep the AI card greyed out with a disabled button
labelled Currently unavailable, and subscription settings hide upgrades to AI. Existing paid AI access,
webhook processing, cancellation, refunds and downgrades remain available.
Standard checkout does not require an AI price ID while AI sales are disabled.
