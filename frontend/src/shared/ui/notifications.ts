import { createContext, useContext } from 'react'

export type NoticeKind = 'success' | 'info' | 'error'
export type Notice = { message: string; kind: NoticeKind; id: string }
export type Notify = (message: string, options?: { kind?: NoticeKind; id?: string }) => void

export const NotificationContext = createContext<{ notify: Notify }>({ notify: () => {} })
export const useNotifications = () => useContext(NotificationContext)
