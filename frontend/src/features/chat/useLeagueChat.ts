import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage, HttpError } from '../../shared/api/http'
import { useMutation } from '../../shared/api/useMutation'
import { loadChat, sendChat, type ChatMessage, type ChatPage } from './api'

export function mergeMessages(previous: ChatMessage[], incoming: ChatMessage[], now: number) {
  const messages = new Map(previous.map((message) => [message.id, message]))
  for (const message of incoming) messages.set(message.id, message)
  return [...messages.values()]
    .filter((message) => Date.parse(message.expiresAt) > now)
    .sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : a.id === b.id ? 0 : 1))
}

export function useLeagueChat(leagueId: number) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string>()
  const [denied, setDenied] = useState(false)
  const [hasOlder, setHasOlder] = useState(false)
  const [clockOffset, setClockOffset] = useState(0)
  const newest = useRef<string | undefined>(undefined)
  const oldest = useRef<string | undefined>(undefined)
  const offset = useRef(0)
  const accessDenied = useRef(false)
  const older = useMutation()
  const sending = useMutation()
  const retrySend = useRef<{ body: string; id: string } | undefined>(undefined)
  const receive = useCallback((page: ChatPage, history: boolean) => {
    if (accessDenied.current) return
    offset.current = Date.parse(page.serverTime) - Date.now()
    setClockOffset(offset.current)
    setMessages((previous) => mergeMessages(previous, page.messages, Date.now() + offset.current))
    if (history || !oldest.current) {
      oldest.current = page.messages[0]?.id ?? oldest.current
      setHasOlder(page.hasOlder)
    }
    if (!history && page.messages.length) newest.current = page.messages.at(-1)?.id
    setLoaded(true)
    setError(undefined)
  }, [])
  const accessError = useCallback((failure: unknown) => {
    if (failure instanceof HttpError && [401, 403, 404].includes(failure.status)) {
      accessDenied.current = true
      setDenied(true)
      setMessages([])
      setHasOlder(false)
    }
    setError(errorMessage(failure))
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    let running = false
    let failures = 0
    let stopped = false
    const poll = async () => {
      if (running || stopped || controller.signal.aborted) return
      clearTimeout(timer)
      if (document.hidden) {
        timer = setTimeout(() => void poll(), 3000)
        return
      }
      running = true
      let more = false
      try {
        const page = await loadChat(leagueId, { after: newest.current }, controller.signal)
        if (controller.signal.aborted) return
        receive(page, false)
        more = page.hasMore
        failures = 0
      } catch (failure) {
        if (controller.signal.aborted) return
        accessError(failure)
        stopped = failure instanceof HttpError && [401, 403, 404].includes(failure.status)
        failures++
      } finally {
        running = false
        if (!stopped && !controller.signal.aborted)
          timer = setTimeout(() => void poll(), more ? 0 : Math.min(30_000, 3000 * 2 ** failures))
      }
    }
    const resume = () => {
      if (!document.hidden) void poll()
    }
    document.addEventListener('visibilitychange', resume)
    window.addEventListener('online', resume)
    void poll()
    return () => {
      controller.abort()
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', resume)
      window.removeEventListener('online', resume)
    }
  }, [leagueId, receive, accessError])

  useEffect(() => {
    if (!messages.length) return
    const expires = Math.min(...messages.map((message) => Date.parse(message.expiresAt)))
    const timer = setTimeout(
      () => setMessages((previous) => mergeMessages(previous, [], Date.now() + clockOffset)),
      Math.max(0, expires - Date.now() - clockOffset) + 1,
    )
    return () => clearTimeout(timer)
  }, [messages, clockOffset])

  const loadOlder = async () => {
    if (!hasOlder || !oldest.current || denied) return false
    const result = await older.run(async (signal) => {
      try {
        return await loadChat(leagueId, { before: oldest.current }, signal)
      } catch (failure) {
        if (!signal.aborted) accessError(failure)
        throw failure
      }
    })
    if (result) receive(result.data, true)
    return !!result
  }
  const send = async (body: string) => {
    if (denied) return false
    if (retrySend.current?.body !== body) retrySend.current = { body, id: crypto.randomUUID() }
    const sendId = retrySend.current.id
    const result = await sending.run(async (signal) => {
      try {
        return await sendChat(leagueId, body, sendId, signal)
      } catch (failure) {
        if (!signal.aborted) accessError(failure)
        throw failure
      }
    })
    if (result) {
      if (accessDenied.current) return false
      setMessages((previous) => mergeMessages(previous, [result.data], Date.now() + offset.current))
      retrySend.current = undefined
      setError(undefined)
    }
    return !!result
  }
  return {
    messages,
    loaded,
    error,
    denied,
    hasOlder,
    loadOlder,
    loadingOlder: older.busy,
    send,
    sending: sending.busy,
    sendError: sending.error,
  }
}
