import { CheckCircle, Info, CircleAlert, X } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { NotificationContext, type Notice, type Notify } from './notifications'

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([])
  const [paused, setPaused] = useState(false)
  const host = useRef<HTMLDivElement>(null)
  const origin = useRef<HTMLElement | null>(null)
  const current = notices[0]
  const notify = useCallback<Notify>(
    (message, { kind = 'info', id = `${kind}:${message}` } = {}) => {
      if (
        document.activeElement instanceof HTMLElement &&
        !host.current?.contains(document.activeElement)
      )
        origin.current = document.activeElement
      setNotices((previous) =>
        previous.some((item) => item.id === id)
          ? previous
          : [...previous.slice(0, 3), { message, kind, id }],
      )
    },
    [],
  )
  const dismiss = useCallback(() => {
    if (host.current?.contains(document.activeElement) && origin.current?.isConnected)
      origin.current.focus()
    setNotices((previous) => previous.slice(1))
    setPaused(false)
  }, [])

  useEffect(() => {
    if (!current || current.kind === 'error' || paused) return
    const timer = window.setTimeout(dismiss, 6000)
    return () => window.clearTimeout(timer)
  }, [current, paused, dismiss])

  useLayoutEffect(() => {
    const element = host.current
    if (!element || !current) return
    const viewport = window.visualViewport
    const root = document.documentElement
    const measure = () => {
      const keyboardInset = viewport
        ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
        : 0
      element.style.bottom = `calc(${keyboardInset}px + max(16px, env(safe-area-inset-bottom)))`
      root.style.setProperty(
        '--notification-space',
        `${element.getBoundingClientRect().height + keyboardInset + 32}px`,
      )
    }
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    viewport?.addEventListener('resize', measure)
    viewport?.addEventListener('scroll', measure)
    measure()
    return () => {
      observer.disconnect()
      viewport?.removeEventListener('resize', measure)
      viewport?.removeEventListener('scroll', measure)
      root.style.removeProperty('--notification-space')
    }
  }, [current])

  const Icon =
    current?.kind === 'success' ? CheckCircle : current?.kind === 'error' ? CircleAlert : Info
  return (
    <NotificationContext value={{ notify }}>
      {children}
      {current && (
        <div
          ref={host}
          className="notification-host"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false)
          }}
        >
          <div className="notification" data-kind={current.kind}>
            <Icon size={20} aria-hidden="true" />
            <p role={current.kind === 'error' ? 'alert' : 'status'}>{current.message}</p>
            <button type="button" aria-label="Dismiss notification" onClick={dismiss}>
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </NotificationContext>
  )
}
