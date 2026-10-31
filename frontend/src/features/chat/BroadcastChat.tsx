import { MessageCircle, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useDialogMotion } from '../../shared/ui/useDialogMotion'
import { LeagueChat } from './LeagueChat'

export function BroadcastChat({ leagueId }: { leagueId: number }) {
  const { dialog, open, closing, show, close, onClose } = useDialogMotion()
  const [history, setHistory] = useState(false)
  useEffect(() => {
    if (!open) return
    const viewport = window.visualViewport
    const resize = () => {
      dialog.current?.style.setProperty(
        '--chat-viewport-height',
        `${viewport?.height ?? window.innerHeight}px`,
      )
      dialog.current?.style.setProperty(
        '--chat-keyboard-offset',
        `${Math.max(0, window.innerHeight - (viewport?.height ?? window.innerHeight) - (viewport?.offsetTop ?? 0))}px`,
      )
    }
    resize()
    viewport?.addEventListener('resize', resize)
    viewport?.addEventListener('scroll', resize)
    return () => {
      viewport?.removeEventListener('resize', resize)
      viewport?.removeEventListener('scroll', resize)
    }
  }, [open, dialog])
  return (
    <>
      <button
        className="broadcast-chat-button"
        type="button"
        aria-label="Open league chat"
        aria-haspopup="dialog"
        onClick={() => {
          setHistory(false)
          show()
        }}
      >
        <MessageCircle size={20} />
        <span>Chat</span>
      </button>
      <dialog
        ref={dialog}
        className="broadcast-chat-dialog dialog-motion"
        aria-labelledby="broadcast-chat-title"
        data-history={history}
        data-closing={closing}
        onClose={onClose}
        onCancel={(event) => {
          event.preventDefault()
          close()
        }}
      >
        <header>
          <h2 id="broadcast-chat-title">League chat</h2>
          <button type="button" aria-label="Close league chat" onClick={() => close()}>
            <X size={20} />
          </button>
        </header>
        {open && <LeagueChat leagueId={leagueId} onHistoryChange={setHistory} />}
      </dialog>
    </>
  )
}
