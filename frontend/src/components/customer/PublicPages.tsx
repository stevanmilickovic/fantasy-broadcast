import type { Navigate } from '../../hooks/useBrowserNavigation'
import { LegalFooter } from './LegalFooter'
import { PublicHeader } from './PublicHeader'

type Props = { page: 'pricing' | 'privacy' | 'terms' | 'refunds'; onNavigate: Navigate }

const Seller = () => <p><strong>Seller:</strong> Stevan Milickovic, sole trader<br />Podgorica, Donji Kokoti BB, Montenegro<br /><a href="mailto:fantasybroadcastapp@gmail.com">fantasybroadcastapp@gmail.com</a></p>

export function PublicPage({ page, onNavigate }: Props) {
  const content = page === 'pricing' ? <Pricing onNavigate={onNavigate} /> : <Policy page={page} />
  return <main className="public-page"><PublicHeader onNavigate={onNavigate} />{content}<LegalFooter onNavigate={onNavigate} className="public-footer" /></main>
}

function Pricing({ onNavigate }: { onNavigate: Navigate }) { return <section className="public-content pricing-content"><h1>Choose your matchday broadcast.</h1><p className="public-lead">Each subscription covers one FPL league and renews monthly during the Premier League season. It ends automatically after the final month with league games.</p><div className="public-plans"><article><span>Standard</span><h2>€4.99 <small>/ month</small></h2><p>Everything your league needs for a live matchday.</p><ul><li>Live matchday broadcast</li><li>League standings and teams</li><li>Fixture and score updates</li></ul><button onClick={() => onNavigate('/register')}>Get started</button></article><article className="public-featured"><span>AI Broadcaster</span><h2>€14.99 <small>/ month</small></h2><p>For leagues that want the full commentary experience.</p><ul><li>Everything in Standard</li><li>AI match commentary</li><li>Natural voice narration</li></ul><button onClick={() => onNavigate('/register')}>Get started</button></article></div><p className="public-note">14-day refund window for your initial purchase. <button onClick={() => onNavigate('/refunds')}>Read the refund policy</button>.</p></section> }

function Policy({ page }: { page: 'privacy' | 'terms' | 'refunds' }) {
  const title = page === 'privacy' ? 'Privacy Policy' : page === 'terms' ? 'Terms of Service' : 'Refund Policy'
  return <article className="public-content policy-content"><h1>{title}</h1><p className="policy-date">Effective date: 10 September 2026</p><Seller />
    {page === 'privacy' && <><h2>Information we collect</h2><p>We collect account details such as your email address, display name, password hash, and the FPL league information you provide. Payment details are processed by Paddle and are not stored by Fantasy Broadcast.</p><h2>How we use information</h2><p>We use this information to provide the service, authenticate accounts, register leagues, provide support, and maintain service security. We do not sell personal information.</p><h2>Contact</h2><p>Contact us at fantasybroadcastapp@gmail.com for privacy questions or requests.</p></>}
    {page === 'terms' && <><h2>The service</h2><p>Fantasy Broadcast provides live companion broadcasts, league views, and optional AI commentary for Fantasy Premier League leagues. FPL data and match availability may change or be unavailable.</p><h2>Subscriptions and season end</h2><p>Standard and AI Broadcaster subscriptions renew monthly while the Premier League season is active. We automatically cancel subscriptions after the final month containing league games, so no off-season renewal is due. You may also cancel before your next renewal.</p><h2>Refunds</h2><p>Initial purchases are covered by the Refund Policy. Nothing in these terms limits mandatory consumer rights.</p></>}
    {page === 'refunds' && <><h2>14-day initial-purchase refund</h2><p>Request a full refund within 14 calendar days of your initial subscription purchase by emailing fantasybroadcastapp@gmail.com with the email used for your account and your Paddle transaction details.</p><h2>Renewals and cancellation</h2><p>Monthly renewal payments are not ordinarily refundable once the new billing period has started. You can cancel before the next renewal. We automatically cancel subscriptions after the final month with Premier League league games.</p><h2>Your legal rights</h2><p>This policy does not limit any mandatory consumer rights that apply to you.</p></>}</article>
}
