import { monthlyPlanPrice } from '../billing/billingPlans'
import { usePlanAvailability } from '../billing/usePlanAvailability'
import type { Navigate } from '../../app/useBrowserNavigation'
import { LegalFooter } from '../../shared/ui/LegalFooter'
import { PublicHeader } from '../../shared/ui/PublicHeader'
import { MAX_BROADCAST_VIEWERS } from '../broadcast/broadcastLimits'
import { TERMS_VERSION } from './policyVersions'

type Props = { page: 'pricing' | 'privacy' | 'terms' | 'refunds'; onNavigate: Navigate }

const Seller = () => (
  <p>
    <strong>Seller:</strong> Stevan Milickovic, sole trader
    <br />
    Dalmatinska 14, Podgorica, Montenegro
    <br />
    <a href="mailto:fantasybroadcastapp@gmail.com">fantasybroadcastapp@gmail.com</a>
  </p>
)

export function PublicPage({ page, onNavigate }: Props) {
  const content = page === 'pricing' ? <Pricing onNavigate={onNavigate} /> : <Policy page={page} />
  return (
    <main className="public-page">
      <PublicHeader onNavigate={onNavigate} />
      {content}
      <LegalFooter onNavigate={onNavigate} className="public-footer" />
    </main>
  )
}

function Pricing({ onNavigate }: { onNavigate: Navigate }) {
  const { aiBroadcasterEnabled, notice } = usePlanAvailability()
  return (
    <section className="public-content pricing-content">
      <h1>Choose your matchday broadcast.</h1>
      <p className="public-lead">
        Each subscription registers one FPL league and renews monthly during the Premier League
        season. Followers can watch its live broadcast, with up to {MAX_BROADCAST_VIEWERS}{' '}
        simultaneous viewers per league. Each open broadcast tab or device counts as one viewer.
      </p>
      <div className="public-plans">
        <article>
          <span>Standard</span>
          <h2>
            {monthlyPlanPrice.STANDARD} <small>/ league / month</small>
          </h2>
          <p>Live matchday coverage, billed monthly per league.</p>
          <ul>
            <li>Live matchday broadcast</li>
            <li>Up to {MAX_BROADCAST_VIEWERS} simultaneous viewers</li>
            <li>League standings and teams</li>
          </ul>
          <button onClick={() => onNavigate('/leagues/new?plan=STANDARD')}>Get started</button>
        </article>
        <article className="public-featured" aria-disabled={!aiBroadcasterEnabled}>
          <span>AI Broadcaster</span>
          <h2>
            {monthlyPlanPrice.AI_BROADCASTER} <small>/ league / month</small>
          </h2>
          <p>Live coverage with AI voice commentary, billed monthly per league.</p>
          <ul>
            <li>Live matchday broadcast</li>
            <li>Up to {MAX_BROADCAST_VIEWERS} simultaneous viewers</li>
            <li>League standings and teams</li>
            <li>AI voice commentary</li>
          </ul>
          <button
            disabled={!aiBroadcasterEnabled}
            onClick={() => onNavigate('/leagues/new?plan=AI_BROADCASTER')}
          >
            {aiBroadcasterEnabled ? 'Get started' : 'Currently unavailable'}
          </button>
        </article>
      </div>
      {notice && (
        <p className="public-note" role="status">
          {notice}
        </p>
      )}
      <p className="public-note">
        Subscriptions renew monthly until cancelled or the season ends. The final price, any
        applicable tax, and billing details are shown in Paddle checkout before purchase.{' '}
        <button onClick={() => onNavigate('/refunds')}>Read the refund policy</button>.
      </p>
    </section>
  )
}

function Policy({ page }: { page: 'privacy' | 'terms' | 'refunds' }) {
  const title =
    page === 'privacy' ? 'Privacy Policy' : page === 'terms' ? 'Terms of Service' : 'Refund Policy'
  const effectiveDate = new Date(
    `${page === 'terms' ? TERMS_VERSION : '2026-09-11'}T00:00:00Z`,
  ).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
  return (
    <article className="public-content policy-content">
      <h1>{title}</h1>
      <p className="policy-date">Effective date: {effectiveDate}</p>
      <Seller />
      {page === 'privacy' && <PrivacyPolicy />}
      {page === 'terms' && <TermsOfService />}
      {page === 'refunds' && <RefundPolicy />}
    </article>
  )
}

function PrivacyPolicy() {
  return (
    <>
      <h2>Who is responsible for your data</h2>
      <p>
        Stevan Milickovic, sole trader, is the controller of personal data processed through Fantasy
        Broadcast. Contact us at{' '}
        <a href="mailto:fantasybroadcastapp@gmail.com">fantasybroadcastapp@gmail.com</a> for privacy
        questions or to exercise your rights.
      </p>
      <h2>Data we collect</h2>
      <p>
        We collect your email address, display name, password hash, account role, session
        information, and account timestamps. When you register or follow a league, we process the
        FPL league identifier, league name, league type, associated FPL entries and managers, and
        your league and notification preferences. We also process messages and information you send
        to support.
      </p>
      <p>
        We use an essential, secure session cookie to keep you signed in. We do not sell personal
        data and do not use advertising or analytics cookies.
      </p>
      <h2>Why we use your data</h2>
      <p>
        We process account, league, and session data to create and secure your account, provide the
        live broadcast, administer registered leagues and subscriptions, respond to support
        requests, and prevent misuse. This processing is necessary to provide the service or is in
        our legitimate interests in operating a secure service. We process payment-related
        identifiers to administer the subscription; payment card details are handled by Paddle, not
        stored by Fantasy Broadcast.
      </p>
      <h2>Providers and sharing</h2>
      <p>
        We share only the data needed to operate the service with service providers acting for us,
        including our hosting, database, email, and security providers. Paddle acts as the merchant
        of record and payment provider for purchases. If you choose Google Sign-In, we receive the
        email address and display name provided by Google to create or sign in to your account. We
        request league and match information from Fantasy Premier League sources. If AI commentary
        is enabled for a league, relevant match, league, and commentary-context information is sent
        to OpenAI to generate text; if voice narration is enabled, the generated commentary text is
        sent to ElevenLabs to create audio. Do not enter sensitive personal information in league
        commentary context.
      </p>
      <p>
        Some providers may process data outside your country. Where required, we use an appropriate
        transfer mechanism and safeguards for international transfers.
      </p>
      <h2>Retention and security</h2>
      <p>
        League chats are visible to the league owner, approved followers and site administrators.
        Chat participants can see your username. Your account email is not included in chat or
        membership responses. Usernames can be changed. Messages disappear from chat 24 hours after
        sending and are removed by periodic cleanup; historical backups may retain data until those
        backups expire.
      </p>
      <p>
        We keep account and league data while your account or the related service remains active,
        then only as long as reasonably necessary for support, security, legal obligations, dispute
        resolution, and record keeping. Pending registration data expires after 15 minutes and
        password-reset tokens expire after 30 minutes. Temporary narration audio is deleted after
        its configured expiry. We use reasonable technical and organisational measures to protect
        data, but no online service can guarantee absolute security.
      </p>
      <h2>Your rights</h2>
      <p>
        Depending on applicable law, you may have rights to access, correct, delete, restrict,
        object to, or receive a copy of your personal data, and to withdraw consent where consent is
        the basis for processing. You may also complain to your local data-protection authority.
        Email us to make a request; we may need to verify your identity before responding.
      </p>
      <h2>Changes</h2>
      <p>
        We may update this policy when our practices or legal obligations change. We will post the
        updated version here and change its effective date. Material changes will be communicated
        where required by law.
      </p>
    </>
  )
}

function TermsOfService() {
  return (
    <>
      <h2>The service</h2>
      <p>
        Fantasy Broadcast is a live companion service for Fantasy Premier League leagues. It
        provides league views, matchday updates, and, on the AI Broadcaster plan, optional
        AI-generated commentary and voice narration. It is not an official Fantasy Premier League or
        Premier League product and is not affiliated with, endorsed by, or sponsored by the Premier
        League or Fantasy Premier League.
      </p>
      <p>
        The service relies on data and availability supplied by Fantasy Premier League and other
        third parties. Temporary delays, inaccuracies, or interruptions outside our reasonable
        control may affect live features. We will take reasonable steps to restore the service or
        provide a suitable alternative where practicable. Nothing in these terms limits mandatory
        consumer rights.
      </p>
      <h2>Accounts and acceptable use</h2>
      <p>
        You are responsible for keeping your account credentials confidential and for activity on
        your account. Give accurate account and league information, use the service lawfully, and do
        not attempt to disrupt, reverse engineer, scrape, or gain unauthorised access to Fantasy
        Broadcast or another user’s account. You must be old enough to enter a binding contract
        where you live, or have the permission of a parent or legal guardian.
      </p>
      <h2>Subscriptions, billing, and access</h2>
      <p>
        Each paid subscription is attached to one registered FPL league, not to an individual
        viewer. A registered league’s authorised Fantasy Broadcast followers can access its live
        broadcast while that subscription is active, with a maximum of {MAX_BROADCAST_VIEWERS}{' '}
        simultaneous viewers per league on either plan. Each open broadcast tab or device counts as
        one viewer. The applicable monthly price per league, billing currency, and any taxes are
        displayed on the Pricing page and confirmed in Paddle checkout before purchase.
      </p>
      <p>
        Subscriptions renew monthly during the Premier League season unless cancelled. Paddle is the
        merchant of record and processes subscription payments. You can cancel through the link in
        your Paddle purchase confirmation or contact Paddle support; cancellation takes effect at
        the end of the current billing period. We will cancel season subscriptions after the final
        month containing Premier League league games, so no off-season renewal is due.
      </p>
      <h2>AI and third-party information</h2>
      <p>
        AI commentary is generated from live match and league information and may be incomplete,
        delayed, or inaccurate. It is for entertainment and information only and is not an official
        score, result, or advice. Official Fantasy Premier League and match sources remain
        authoritative. Fantasy Premier League, Premier League, club, and player names and marks
        belong to their respective owners; no right to use their intellectual property is granted by
        these terms.
      </p>
      <h2>Suspension, changes, and ending the service</h2>
      <p>
        We may suspend or end access where reasonably necessary for security, fraud prevention,
        legal compliance, or a material breach of these terms. We may change the service when
        reasonably necessary, including for security, legal, technical, or third-party dependency
        reasons. For material adverse changes to an active paid service, we will provide notice
        where required and preserve any mandatory rights to cancel or obtain a remedy.
      </p>
      <h2>Liability and consumer rights</h2>
      <p>
        We are responsible for providing the service with reasonable care and skill. To the extent
        permitted by law, we are not liable for indirect or consequential loss or for failures
        caused solely by third-party services outside our reasonable control. Nothing in these terms
        excludes or limits liability that cannot lawfully be excluded, including liability for fraud
        or mandatory consumer rights.
      </p>
      <h2>Governing law and contact</h2>
      <p>
        These terms are governed by the law of Montenegro, except that consumers may retain the
        protection of mandatory law in their country of residence. Contact us at{' '}
        <a href="mailto:fantasybroadcastapp@gmail.com">fantasybroadcastapp@gmail.com</a> with
        questions or complaints.
      </p>
    </>
  )
}

function RefundPolicy() {
  return (
    <>
      <h2>Our 14-day initial-purchase refund</h2>
      <p>
        For an initial subscription purchase, we offer a full refund if you request it within 14
        calendar days of purchase. Email{' '}
        <a href="mailto:fantasybroadcastapp@gmail.com">fantasybroadcastapp@gmail.com</a> with the
        email used for your account and your Paddle transaction details. This is in addition to, and
        does not limit, any statutory rights that apply to you.
      </p>
      <h2>Renewals and cancellation</h2>
      <p>
        Subscription payments renew monthly unless cancelled. You can cancel at any time through the
        link in your Paddle purchase confirmation or by contacting Paddle support. Cancellation
        stops the next renewal and access continues until the end of the paid billing period.
        Renewal payments are not ordinarily refunded once the new billing period has started, except
        where required by law or where the service was not supplied in conformity with the contract.
      </p>
      <h2>Plan changes and upgrade payments</h2>
      <p>
        Upgrades take effect after successful payment of the prorated price difference for the
        remaining billing period. Downgrades take effect at the end of the current paid period. Your
        renewal date stays the same. An upgrade does not restart our voluntary 14-day
        initial-purchase refund window. Contact us about an upgrade charge if the service was not
        supplied as agreed or you have another applicable refund right. Your statutory rights and
        Paddle’s applicable terms are unaffected.
      </p>
      <h2>Service problems</h2>
      <p>
        If a material paid feature is unavailable or does not substantially conform to these terms,
        contact us promptly. We will investigate and, where appropriate, restore the service,
        provide a suitable alternative, or offer the remedy required by applicable law, which may
        include a proportionate price reduction or termination.
      </p>
      <h2>How refunds are handled</h2>
      <p>
        Eligible refunds are issued through Paddle to the original payment method where possible.
        The timing of the refund may depend on Paddle and your payment provider. This policy does
        not limit any statutory withdrawal, refund, cancellation, or consumer-protection right.
      </p>
    </>
  )
}
