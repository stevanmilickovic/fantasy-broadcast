import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage } from './http'

type MutationState =
  { status: 'idle' | 'pending' | 'success'; error?: undefined } | { status: 'error'; error: string }

export function useMutation() {
  const [state, setState] = useState<MutationState>({ status: 'idle' })
  const active = useRef<AbortController | null>(null)
  useEffect(
    () => () => {
      active.current?.abort()
    },
    [],
  )
  const run = useCallback(
    async <T>(action: (signal: AbortSignal) => Promise<T>): Promise<{ data: T } | undefined> => {
      if (active.current && !active.current.signal.aborted) return undefined
      const controller = new AbortController()
      active.current = controller
      setState({ status: 'pending' })
      try {
        const data = await action(controller.signal)
        if (controller.signal.aborted) return undefined
        setState({ status: 'success' })
        return { data }
      } catch (error) {
        if (!controller.signal.aborted) setState({ status: 'error', error: errorMessage(error) })
      } finally {
        if (active.current === controller) active.current = null
      }
    },
    [],
  )
  const reset = useCallback(() => {
    active.current?.abort()
    active.current = null
    setState({ status: 'idle' })
  }, [])
  return { ...state, busy: state.status === 'pending', run, reset }
}
