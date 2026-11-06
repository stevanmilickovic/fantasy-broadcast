export type PageResult<T> = {
  items: T[]
  page: number
  size: number
  totalItems: number
}

export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'HttpError'
  }
}

export function errorMessage(error: unknown, fallback = 'Unable to complete the request.'): string {
  return error instanceof Error ? error.message : fallback
}

export async function request(path: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers)
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type'))
    headers.set('Content-Type', 'application/json')
  const response = await fetch(path, { ...options, headers })
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null)
    const detail = body && typeof body === 'object' && 'detail' in body ? body.detail : undefined
    const message = body && typeof body === 'object' && 'message' in body ? body.message : undefined
    throw new HttpError(
      response.status,
      typeof detail === 'string'
        ? detail
        : typeof message === 'string'
          ? message
          : `Request failed with ${response.status}`,
    )
  }
  return response
}

export async function requestJson<T>(path: string, options?: RequestInit): Promise<T> {
  return (await request(path, options)).json()
}
