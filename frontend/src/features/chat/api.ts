import { requestJson } from '../../shared/api/http'

export type ChatMessage = {
  id: string
  leagueId: number
  userId: number
  displayName: string
  body: string
  createdAt: string
  expiresAt: string
}
export type ChatPage = {
  messages: ChatMessage[]
  hasOlder: boolean
  hasMore: boolean
  serverTime: string
}
export const loadChat = (
  leagueId: number,
  cursor: { before?: string; after?: string },
  signal: AbortSignal,
) => {
  const params = new URLSearchParams()
  if (cursor.before) params.set('before', cursor.before)
  if (cursor.after) params.set('after', cursor.after)
  return requestJson<ChatPage>(`/api/customer/leagues/${leagueId}/chat?${params}`, { signal })
}
export const sendChat = (leagueId: number, body: string, sendId: string, signal: AbortSignal) =>
  requestJson<ChatMessage>(`/api/customer/leagues/${leagueId}/chat`, {
    method: 'POST',
    signal,
    body: JSON.stringify({ body, sendId }),
  })
