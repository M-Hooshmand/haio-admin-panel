export interface InvoiceRow {
  id: string
  amount: number
  credit_applied: number
  status: string
  status_label: string
  product: string
  product_key: string
  product_name: string
  kind: string
  created_at: string
  due_date: string | null
  paid_at: string | null
  description: string
  attempts: number
  reached_gateway: boolean
}

export interface TicketRow {
  id: string
  subject: string
  status: string
  status_label: string
  is_open: boolean
  product_type: string
  created_at: string
  updated_at: string
  comment_count: number
  last_comment: {
    side: number
    side_label: string
    body: string
    created_at: string
  } | null
}

export interface FollowUp {
  id: string
  kind: string
  kind_label: string
  status: string
  status_label: string
  priority: string
  priority_label: string
  reason: string
  due_at: string | null
  snoozed_until: string | null
  completed_at: string | null
  outcome: string
  outcome_label: string
  note: string
  meta: Record<string, unknown>
  created_at: string
  assigned_to: { id: number; name: string } | null
  customer: {
    id: number
    display_name: string
    mobile: string
    email: string
    username: string
  }
  invoice: InvoiceRow | null
  ticket: { id: string; subject: string; status: string; status_label: string } | null
}

export interface CustomerRow {
  id: number
  display_name: string
  username: string
  email: string
  mobile: string
  created_at: string
  last_login: string | null
  paid_count: number
  total_paid: number
  last_paid_at: string | null
  abandoned_count: number
  abandoned_value: number
  ticket_count: number
  open_ticket_count: number
  persona: string
  tags: string[]
  do_not_call: boolean
  last_contacted_at: string | null
  last_contact_outcome: string
  segment_reason: string
}

export interface SegmentPage {
  rows: CustomerRow[]
  total: number
  page: number
  page_size: number
}

export interface Dashboard {
  generated_at: string
  counts: {
    open: number
    due_today: number
    overdue: number
    upcoming_week: number
    snoozed: number
    done_today: number
    done_week: number
    by_kind: Record<string, number>
  }
  segments: Record<string, number>
  kpis: {
    abandoned_value_30d: number
    abandoned_count_30d: number
    recovered_value_7d: number
    recovered_count_7d: number
    calls_done_7d: number
  }
  today: FollowUp[]
  upcoming: FollowUp[]
  staff: { id: number; name: string; role: string }[]
}

export interface CustomerNote {
  id: string
  kind: string
  kind_label: string
  body: string
  outcome: string
  outcome_label: string
  pinned: boolean
  author: string
  created_at: string
}

export interface CustomerDetail {
  customer: {
    id: number
    display_name: string
    username: string
    email: string
    mobile: string
    phone: string
    national_id: string
    created_at: string
    last_login: string | null
    is_active: boolean
  }
  profile: {
    persona: string
    tags: string[]
    do_not_call: boolean
    preferred_channel: string
    last_contacted_at: string | null
    last_contact_outcome: string
    last_contact_outcome_label: string
  }
  stats: {
    paid_count: number
    total_paid: number
    first_paid_at: string | null
    last_paid_at: string | null
    abandoned_count: number
    abandoned_value: number
    ticket_total: number
    ticket_open: number
  }
  segments: string[]
  segment_labels: string[]
  ticket_summary: {
    total: number
    open: number
    last_subject: string
    last_status: string
    last_at: string | null
    products: string[]
    summary: string
  }
  invoices: InvoiceRow[]
  tickets: TicketRow[]
  notes: CustomerNote[]
  followups: FollowUp[]
  outcomes: { value: string; label: string }[]
}

export interface CrmMeta {
  segments: { key: string; label: string }[]
  kinds: { value: string; label: string }[]
  outcomes: { value: string; label: string }[]
  priorities: { value: string; label: string }[]
  channels: { value: string; label: string }[]
  staff: { id: number; name: string; role: string; role_label: string }[]
  snooze_options: { days: number; label: string }[]
}

export const SEGMENT_TABS = [
  { key: "today", label: "تماس امروز" },
  { key: "first_buyer", label: "خریداران" },
  { key: "renewer", label: "تمدیدکننده‌ها" },
  { key: "abandoned", label: "رهاشده درگاه" },
  { key: "ticketed", label: "تیکت‌ها" },
  { key: "archive", label: "بعداً / بایگانی" },
] as const

export type TabKey = (typeof SEGMENT_TABS)[number]["key"]

const moneyFormatter = new Intl.NumberFormat("fa-IR")

export function formatMoney(value: number | null | undefined): string {
  return `${moneyFormatter.format(Math.round(Number(value ?? 0)))} تومان`
}

export function formatNumber(value: number | null | undefined): string {
  return moneyFormatter.format(Number(value ?? 0))
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      dateStyle: "medium",
      timeZone: "Asia/Tehran",
    }).format(new Date(value))
  } catch {
    return "—"
  }
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—"
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "Asia/Tehran",
    }).format(new Date(value))
  } catch {
    return "—"
  }
}

export function isOverdue(value: string | null | undefined): boolean {
  if (!value) return false
  return new Date(value).getTime() < Date.now()
}

export function extractError(error: unknown): string {
  const data = (error as { response?: { data?: unknown } })?.response?.data
  if (typeof data === "string") return data
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>
    if (typeof record.detail === "string") return record.detail
    const first = Object.values(record)[0]
    if (typeof first === "string") return first
    if (Array.isArray(first) && typeof first[0] === "string") return first[0]
  }
  return "درخواست ناموفق بود. دوباره تلاش کنید."
}
