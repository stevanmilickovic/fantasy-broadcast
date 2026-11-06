import type { PageResult } from '../../shared/api/http'
import { requestJson } from '../../shared/api/http'
import type {
  AdminSubscription,
  BillingPlan,
  Payment,
  PlanPreview,
  Refund,
  Subscription,
} from './types'

const base = (id: number) => `/api/customer/leagues/${id}/subscription`
const post = <T>(url: string, body: object, signal?: AbortSignal) =>
  requestJson<T>(url, { method: 'POST', body: JSON.stringify(body), signal })

export const loadSubscription = (id: number, signal: AbortSignal) =>
  requestJson<Subscription>(`${base(id)}?refresh=true`, { signal })
export const previewPlan = (id: number, target: BillingPlan, signal: AbortSignal) =>
  post<PlanPreview>(`${base(id)}/preview`, { target }, signal)
export const changePlan = (
  id: number,
  preview: PlanPreview,
  requestId: string,
  signal: AbortSignal,
) =>
  post<Subscription>(
    `${base(id)}/plan`,
    { target: preview.target, version: preview.version, requestId },
    signal,
  )
export const cancelSubscription = (
  id: number,
  undo: boolean,
  requestId: string,
  signal: AbortSignal,
) => post<Subscription>(`${base(id)}/cancel`, { undo, requestId }, signal)
export const openBillingPortal = (id: number, signal: AbortSignal) =>
  post<{ url: string }>(`${base(id)}/portal`, {}, signal)
export const loadBillingSubscriptions = (search: string, page: number, signal: AbortSignal) =>
  requestJson<PageResult<AdminSubscription>>(
    `/api/customer/admin/subscriptions?${new URLSearchParams({ search, page: String(page), size: '10' })}`,
    { signal },
  )
export const loadSubscriptionPayments = (id: string, signal: AbortSignal) =>
  requestJson<Payment[]>(`/api/customer/admin/subscriptions/${id}/payments`, { signal })
export const submitRefund = (
  id: string,
  input: {
    transactionId: string
    requestId: string
    partialAmount: number | null
    reason: string
    endsAccess: boolean
  },
  signal: AbortSignal,
) => post<Refund>(`/api/customer/admin/subscriptions/${id}/refunds`, input, signal)
