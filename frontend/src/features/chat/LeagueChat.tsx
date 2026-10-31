import { useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { useLeagueChat } from './useLeagueChat'
import { ChatAuthor } from './ChatAuthor'

export function LeagueChat({
  leagueId,
  onHistoryChange,
}: {
  leagueId: number
  onHistoryChange?: (readingHistory: boolean) => void
}) {
  const chat = useLeagueChat(leagueId)
  const [draft, setDraft] = useState('')
  const [atBottom, setAtBottom] = useState(true)
  const [newMessages, setNewMessages] = useState(false)
  const list = useRef<HTMLDivElement>(null)
  const nearBottom = useRef(true)
  const previousLast = useRef<string | undefined>(undefined)
  const prepend = useRef<{ height: number; top: number } | undefined>(undefined)
  const updatePosition = () => {
    const node = list.current
    if (!node) return
    const bottom = node.scrollHeight - node.scrollTop - node.clientHeight < 32
    nearBottom.current = bottom
    setAtBottom(bottom)
    if (bottom) setNewMessages(false)
    onHistoryChange?.(!bottom)
  }
  useLayoutEffect(() => {
    const node = list.current
    if (!node) return
    const last = chat.messages.at(-1)?.id
    if (prepend.current) {
      node.scrollTop = prepend.current.top + node.scrollHeight - prepend.current.height
      prepend.current = undefined
    } else if (nearBottom.current) node.scrollTop = node.scrollHeight
    else if (last && previousLast.current && last !== previousLast.current) setNewMessages(true)
    previousLast.current = last
  }, [chat.messages])
  const latest = () => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight
    updatePosition()
  }
  const loadOlder = async () => {
    if (!list.current) return
    prepend.current = { height: list.current.scrollHeight, top: list.current.scrollTop }
    if (!(await chat.loadOlder())) prepend.current = undefined
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!draft.trim() || chat.sending) return
    const text = draft.trim()
    if (await chat.send(text)) {
      setDraft((current) => (current.trim() === text ? '' : current))
      latest()
    }
  }
  return (
    <section className="league-chat" aria-label="League chat">
      <p className="chat-notice">
        Messages disappear after 24 hours. Select a username to see their email.
      </p>
      <div
        className="chat-message-area"
        ref={list}
        onScroll={updatePosition}
        tabIndex={0}
        aria-label="Chat messages"
      >
        {chat.hasOlder && (
          <button
            className="chat-older"
            onClick={() => void loadOlder()}
            disabled={chat.loadingOlder}
          >
            {chat.loadingOlder ? 'Loading…' : 'Load older messages'}
          </button>
        )}
        {!chat.loaded && !chat.error && <p role="status">Loading chat…</p>}
        {chat.loaded && !chat.messages.length && !chat.denied && (
          <p className="chat-empty">No messages yet. Start the conversation.</p>
        )}
        <ol className="chat-messages">
          {chat.messages.map((message) => (
            <li key={message.id} className="chat-message">
              <div className="chat-message-meta">
                <ChatAuthor name={message.displayName} email={message.email} />
                <time
                  dateTime={message.createdAt}
                  title={new Date(message.createdAt).toLocaleString()}
                >
                  {new Date(message.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </time>
              </div>
              <p>{message.body}</p>
            </li>
          ))}
        </ol>
      </div>
      {!atBottom && (
        <button className="chat-latest" onClick={latest}>
          {newMessages ? 'New messages · Back to latest' : 'Back to latest'}
        </button>
      )}
      {(chat.error || chat.sendError) && (
        <p className="chat-error" role="alert">
          {chat.sendError ?? chat.error}
          {!chat.denied &&
            (chat.sendError
              ? ' Your message is still in the box. Select Send to retry.'
              : ' Retrying connection automatically.')}
        </p>
      )}
      <form className="chat-composer" onSubmit={(event) => void submit(event)}>
        <label className="chat-input-label" htmlFor={`chat-message-${leagueId}`}>
          Message
        </label>
        <textarea
          id={`chat-message-${leagueId}`}
          value={draft}
          rows={2}
          maxLength={1000}
          placeholder="Message your league…"
          disabled={chat.denied}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault()
              void submit(event)
            }
          }}
        />
        <button type="submit" disabled={!draft.trim() || chat.sending || chat.denied}>
          {chat.sending ? 'Sending…' : 'Send'}
        </button>
      </form>
    </section>
  )
}
