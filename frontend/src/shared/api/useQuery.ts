import { useCallback, useEffect, useReducer } from 'react'
import { errorMessage } from './http'

type QueryState<T> =
  | { status: 'loading'; data?: undefined; error?: undefined }
  | { status: 'success'; data: T; error?: undefined }
  | { status: 'error'; data?: undefined; error: string }

type Snapshot<T> = { key: string; revision: number; result: QueryState<T> }

/** The caller supplies a stable loader; the key identifies the resource being displayed. */
export function useQuery<T>(key: string, load: (signal: AbortSignal) => Promise<T>) {
  const [revision, refresh] = useReducer((value: number) => value + 1, 0)
  const [snapshot, receive] = useReducer(
    (_previous: Snapshot<T> | null, next: Snapshot<T>) => next,
    null,
  )
  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted)
          receive({ key, revision, result: { status: 'success', data } })
      },
      (error) => {
        if (!controller.signal.aborted)
          receive({ key, revision, result: { status: 'error', error: errorMessage(error) } })
      },
    )
    return () => controller.abort()
  }, [key, revision, load])
  const result: QueryState<T> =
    snapshot?.key === key && snapshot.revision === revision
      ? snapshot.result
      : { status: 'loading' }
  return { ...result, refresh: useCallback(() => refresh(), []) }
}
