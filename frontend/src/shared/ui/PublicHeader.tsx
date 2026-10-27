import { ChevronRight } from 'lucide-react'
import type { Navigate } from '../../app/useBrowserNavigation'

export function PublicHeader({ onNavigate }: { onNavigate: Navigate }) {
  return (
    <header className="welcome-nav">
      <button className="welcome-brand brand-name" type="button" onClick={() => onNavigate('/')}>
        Fantasy Broadcast
      </button>
      <nav aria-label="Public navigation">
        <button className="welcome-pricing" type="button" onClick={() => onNavigate('/pricing')}>
          Pricing
        </button>
        <button className="welcome-sign-in" type="button" onClick={() => onNavigate('/login')}>
          Sign in
        </button>
        <button className="welcome-register" type="button" onClick={() => onNavigate('/register')}>
          Get started <ChevronRight size={17} />
        </button>
      </nav>
    </header>
  )
}
