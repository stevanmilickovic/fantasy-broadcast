import { Radio } from 'lucide-react'
import type { Navigate } from '../../app/useBrowserNavigation'

export function LegalFooter({
  onNavigate,
  className = '',
}: {
  onNavigate: Navigate
  className?: string
}) {
  return (
    <footer className={`legal-footer ${className}`.trim()}>
      <span>
        <Radio size={17} /> Fantasy Broadcast
      </span>
      <div>
        <button type="button" onClick={() => onNavigate('/privacy')}>
          Privacy
        </button>
        <button type="button" onClick={() => onNavigate('/terms')}>
          Terms
        </button>
        <button type="button" onClick={() => onNavigate('/refunds')}>
          Refunds
        </button>
        <button type="button" onClick={() => onNavigate('/account-deletion')}>
          Delete account
        </button>
      </div>
    </footer>
  )
}
