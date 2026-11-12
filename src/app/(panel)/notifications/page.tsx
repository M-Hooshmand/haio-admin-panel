"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Bell,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Mail,
  MessageSquare,
  MinusCircle,
  RefreshCw,
  Search,
  ScrollText,
  X,
  XCircle,
} from "lucide-react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { JalaliDateInput } from "@/components/ui/jalali-date-input"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 20

interface NotificationRow {
  id: string
  created_at: string
  sent_at: string | null
  user_id: number | null
  username: string | null
  email: string | null
  mobile: string | null
  recipient: string
  channel: string
  channel_label: string
  product: string
  product_label: string
  event: string
  event_label: string
  status: string
  status_label: string
  subject: string
  template_name: string
  provider_message_id: string
  error_message: string
  related_object_type: string
  related_object_id: string
  metadata: Record<string, unknown>
}

interface Page<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

interface BreakdownRow {
  key: string
  label: string
  sent: number
  failed: number
  skipped: number
  total: number
}

interface StatusRow {
  key: string
  label: string
  count: number
}

interface Summary {
  days: number
  since: string
  total: number
  by_status: StatusRow[]
  by_channel: BreakdownRow[]
  by_product: BreakdownRow[]
}

const PRODUCT_OPTIONS = [
  { value: "haioflash", label: "هایوفلش" },
  { value: "wordpress", label: "وردپرس" },
  { value: "other", label: "سایر محصولات" },
]

const EVENT_OPTIONS = [
  { value: "expiration", label: "انقضا" },
  { value: "suspension", label: "تعلیق" },
  { value: "provisioned", label: "راه‌اندازی" },
  { value: "other", label: "سایر رویدادها" },
]

const CHANNEL_OPTIONS = [
  { value: "email", label: "ایمیل" },
  { value: "sms", label: "پیامک" },
]

const STATUS_OPTIONS = [
  { value: "sent", label: "ارسال‌شده" },
  { value: "failed", label: "ناموفق" },
  { value: "skipped", label: "ردشده" },
]

const STATUS_STYLES: Record<string, string> = {
  sent: "border-emerald-200 bg-emerald-50 text-emerald-700",
  failed: "border-rose-200 bg-rose-50 text-rose-700",
  skipped: "border-slate-200 bg-slate-50 text-slate-600",
}

const STATUS_CARDS = [
  { key: "sent", label: "ارسال‌شده", tone: "border-emerald-200 bg-emerald-50 text-emerald-900", accent: "text-emerald-700", icon: CheckCircle2 },
  { key: "failed", label: "ناموفق", tone: "border-rose-200 bg-rose-50 text-rose-900", accent: "text-rose-700", icon: XCircle },
  { key: "skipped", label: "ردشده", tone: "border-slate-200 bg-white text-slate-900", accent: "text-slate-500", icon: MinusCircle },
]

const CHANNEL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  email: Mail,
  sms: MessageSquare,
}

function formatDateTime(value?: string | null): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString("fa-IR", { dateStyle: "short", timeStyle: "short" })
}

function formatNumber(value: number): string {
  return (value || 0).toLocaleString("fa-IR")
}

function extractError(error: unknown): string {
  const data = (error as { response?: { data?: unknown } })?.response?.data
  if (typeof data === "string") return data
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>
    if (typeof record.detail === "string") return record.detail
    for (const value of Object.values(record)) {
      if (typeof value === "string") return value
    }
  }
  const message = (error as { message?: string })?.message
  return message || "خطای نامشخص در دریافت داده‌ها"
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        STATUS_STYLES[status] ?? "border-slate-200 bg-slate-50 text-slate-600",
      )}
    >
      {label || status || "—"}
    </span>
  )
}

function BreakdownCard({ title, rows }: { title: string; rows: BreakdownRow[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-xs font-bold text-slate-700">{title}</h2>
      {rows.length === 0 ? (
        <p className="py-4 text-center text-xs text-slate-400">در حال دریافت آمار…</p>
      ) : (
        <div className="space-y-1.5">
          <div className="grid grid-cols-[1fr_repeat(4,3.5rem)] gap-2 px-1 text-[10px] text-slate-400">
            <span />
            <span className="text-center">ارسال</span>
            <span className="text-center">ناموفق</span>
            <span className="text-center">ردشده</span>
            <span className="text-center">کل</span>
          </div>
          {rows.map((row) => (
            <div
              key={row.key}
              className="grid grid-cols-[1fr_repeat(4,3.5rem)] items-center gap-2 rounded-lg px-1 py-1.5 text-xs odd:bg-slate-50/70"
            >
              <span className="font-medium text-slate-700">{row.label}</span>
              <span className="text-center font-mono text-emerald-700">{formatNumber(row.sent)}</span>
              <span className="text-center font-mono text-rose-700">{formatNumber(row.failed)}</span>
              <span className="text-center font-mono text-slate-500">{formatNumber(row.skipped)}</span>
              <span className="text-center font-mono font-bold text-slate-800">
                {formatNumber(row.total)}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function DetailField({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className={cn("mt-0.5 break-words text-sm text-slate-800", mono && "font-mono text-xs")} dir={mono ? "ltr" : undefined}>
        {value || "—"}
      </p>
    </div>
  )
}

function DetailDrawer({ row, onClose }: { row: NotificationRow; onClose: () => void }) {
  const metadata = useMemo(() => {
    if (!row.metadata || Object.keys(row.metadata).length === 0) return ""
    return JSON.stringify(row.metadata, null, 2)
  }, [row.metadata])

  const userLabel = row.username || row.email || (row.user_id ? `#${row.user_id}` : "—")

  return (
    <div
      className="fixed inset-0 z-40 flex justify-start bg-slate-900/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-2xl flex-col bg-slate-50 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white p-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-base font-bold text-slate-900">جزئیات اعلان</h2>
              <StatusBadge status={row.status} label={row.status_label} />
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
              <span dir="ltr">{row.recipient}</span>
              <span>{formatDateTime(row.created_at)}</span>
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="بستن">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4 scrollbar-thin">
          <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
            <DetailField label="کاربر" value={userLabel} />
            <DetailField label="ایمیل / موبایل" value={row.email || row.mobile || "—"} />
            <DetailField label="محصول" value={row.product_label} />
            <DetailField label="رویداد" value={row.event_label} />
            <DetailField label="کانال" value={row.channel_label} />
            <DetailField label="وضعیت" value={row.status_label} />
            <DetailField label="زمان ایجاد" value={formatDateTime(row.created_at)} />
            <DetailField label="زمان ارسال" value={formatDateTime(row.sent_at)} />
            <DetailField label="گیرنده" value={row.recipient} mono />
            <DetailField label="شناسه پیام" value={row.provider_message_id} mono />
            <DetailField label="موضوع" value={row.subject} />
            <DetailField label="قالب" value={row.template_name} mono />
            <DetailField
              label="شیء مرتبط"
              value={
                row.related_object_type || row.related_object_id
                  ? `${row.related_object_type || "—"} / ${row.related_object_id || "—"}`
                  : "—"
              }
              mono
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="mb-2 text-[11px] font-medium text-slate-400">خطای ارسال</p>
            {row.error_message ? (
              <pre className="whitespace-pre-wrap break-words rounded-lg bg-rose-50 p-3 text-xs leading-6 text-rose-700" dir="ltr">
                {row.error_message}
              </pre>
            ) : (
              <p className="text-sm text-slate-500">خطایی ثبت نشده است.</p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="mb-2 text-[11px] font-medium text-slate-400">فراداده (metadata)</p>
            {metadata ? (
              <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs leading-6 text-slate-100" dir="ltr">
                {metadata}
              </pre>
            ) : (
              <p className="text-sm text-slate-500">فراداده‌ای ثبت نشده است.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function NotificationLogsPage() {
  const [rows, setRows] = useState<NotificationRow[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [summary, setSummary] = useState<Summary | null>(null)
  const [summaryError, setSummaryError] = useState("")

  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [product, setProduct] = useState("")
  const [event, setEvent] = useState("")
  const [channel, setChannel] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [dateFrom, setDateFrom] = useState<string | null>(null)
  const [dateTo, setDateTo] = useState<string | null>(null)

  const [selected, setSelected] = useState<NotificationRow | null>(null)
  const requestId = useRef(0)

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  const fetchSummary = useCallback(async () => {
    try {
      const { data } = await api.get<Summary>("/staff/notifications/logs/summary/", {
        params: { days: 30 },
      })
      setSummary(data)
      setSummaryError("")
    } catch (err) {
      setSummaryError(extractError(err))
    }
  }, [])

  const fetchRows = useCallback(async () => {
    const current = ++requestId.current
    setLoading(true)
    setError("")
    try {
      const params: Record<string, string | number> = { page, page_size: PAGE_SIZE }
      if (search) params.search = search
      if (product) params.product = product
      if (event) params.event = event
      if (channel) params.channel = channel
      if (statusFilter) params.status = statusFilter
      if (dateFrom) params.date_from = dateFrom
      if (dateTo) params.date_to = dateTo
      const { data } = await api.get<Page<NotificationRow>>("/staff/notifications/logs/", { params })
      if (current !== requestId.current) return
      setRows(data.results)
      setCount(data.count)
    } catch (err) {
      if (current !== requestId.current) return
      setError(extractError(err))
    } finally {
      if (current === requestId.current) setLoading(false)
    }
  }, [page, search, product, event, channel, statusFilter, dateFrom, dateTo])

  useEffect(() => {
    void fetchSummary()
  }, [fetchSummary])

  useEffect(() => {
    void fetchRows()
  }, [fetchRows])

  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { sent: 0, failed: 0, skipped: 0 }
    for (const row of summary?.by_status ?? []) counts[row.key] = row.count
    return counts
  }, [summary])

  const hasDateRange = Boolean(dateFrom || dateTo)
  const activeFilterCount = [product, event, channel, statusFilter].filter(Boolean).length + (hasDateRange ? 1 : 0)

  const resetFilters = () => {
    setSearchInput("")
    setProduct("")
    setEvent("")
    setChannel("")
    setStatusFilter("")
    setDateFrom(null)
    setDateTo(null)
    setPage(1)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Bell className="h-4 w-4 text-indigo-600" />
            گزارش اعلان‌ها
          </h2>
          <p className="mt-1 text-xs leading-6 text-slate-500">
            تاریخچه ارسال ایمیل و پیامک برای همه محصولات
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void fetchRows()
            void fetchSummary()
          }}
          disabled={loading}
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          بروزرسانی
        </Button>
      </div>

      {summaryError ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          خلاصه ۳۰ روز اخیر دریافت نشد: {summaryError}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        {STATUS_CARDS.map((card) => {
          const Icon = card.icon
          const isActive = statusFilter === card.key
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => {
                setStatusFilter((current) => (current === card.key ? "" : card.key))
                setPage(1)
              }}
              className={cn(
                "rounded-2xl border p-4 text-right transition-all",
                card.tone,
                isActive ? "ring-2 ring-indigo-400 ring-offset-1" : "hover:border-slate-300",
              )}
            >
              <span className={cn("flex items-center gap-1.5 text-xs font-medium", card.accent)}>
                <Icon className="h-3.5 w-3.5" />
                {card.label} · ۳۰ روز اخیر
              </span>
              <p className="mt-1 text-2xl font-bold">
                {summary ? formatNumber(statusCounts[card.key] ?? 0) : "…"}
              </p>
            </button>
          )
        })}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <BreakdownCard title="به تفکیک کانال" rows={summary?.by_channel ?? []} />
        <BreakdownCard title="به تفکیک محصول" rows={summary?.by_product ?? []} />
      </div>

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3">
        <div className="grid gap-2 lg:grid-cols-[1fr_150px_150px_140px_140px]">
          <div className="relative">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="ایمیل، موبایل، نام کاربری، شناسه پیام یا موضوع…"
              className="pr-9"
            />
          </div>
          <select
            value={product}
            onChange={(event) => {
              setProduct(event.target.value)
              setPage(1)
            }}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100"
          >
            <option value="">همه محصولات</option>
            {PRODUCT_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <select
            value={event}
            onChange={(event) => {
              setEvent(event.target.value)
              setPage(1)
            }}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100"
          >
            <option value="">همه رویدادها</option>
            {EVENT_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <select
            value={channel}
            onChange={(event) => {
              setChannel(event.target.value)
              setPage(1)
            }}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100"
          >
            <option value="">همه کانال‌ها</option>
            {CHANNEL_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value)
              setPage(1)
            }}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100"
          >
            <option value="">همه وضعیت‌ها</option>
            {STATUS_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="w-full sm:w-52">
            <p className="mb-1 text-[11px] text-slate-400">از تاریخ</p>
            <JalaliDateInput value={dateFrom} onChange={(iso) => { setDateFrom(iso); setPage(1) }} />
          </div>
          <div className="w-full sm:w-52">
            <p className="mb-1 text-[11px] text-slate-400">تا تاریخ</p>
            <JalaliDateInput value={dateTo} onChange={(iso) => { setDateTo(iso); setPage(1) }} />
          </div>
          {activeFilterCount > 0 ? (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="text-slate-500">
              <X className="h-4 w-4" />
              حذف فیلترها
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] text-right text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">تاریخ / ساعت</th>
                <th className="px-4 py-3 font-medium">کاربر</th>
                <th className="px-4 py-3 font-medium">محصول</th>
                <th className="px-4 py-3 font-medium">رویداد</th>
                <th className="px-4 py-3 font-medium">کانال</th>
                <th className="px-4 py-3 font-medium">گیرنده</th>
                <th className="px-4 py-3 font-medium">وضعیت</th>
                <th className="px-4 py-3 font-medium">شناسه پیام</th>
                <th className="px-4 py-3 font-medium">موضوع / قالب</th>
                <th className="px-4 py-3 font-medium">خطا</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-16 text-center text-slate-400">
                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                    در حال دریافت گزارش…
                  </td>
                </tr>
              ) : null}

              {!loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-16 text-center text-slate-400">
                    هیچ اعلانی با این فیلترها پیدا نشد.
                  </td>
                </tr>
              ) : null}

              {rows.map((row) => {
                const ChannelIcon = CHANNEL_ICONS[row.channel] ?? ScrollText
                const user = row.username || row.email || row.mobile || (row.user_id ? `#${row.user_id}` : "—")
                return (
                  <tr
                    key={row.id}
                    onClick={() => setSelected(row)}
                    className="cursor-pointer transition-colors hover:bg-indigo-50/40"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                      {formatDateTime(row.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium text-slate-800">{user}</p>
                      {row.email && row.username ? (
                        <p className="mt-0.5 truncate text-[11px] text-slate-400" dir="ltr">
                          {row.email}
                        </p>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">{row.product_label}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">{row.event_label}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                        <ChannelIcon className="h-3.5 w-3.5 text-slate-400" />
                        {row.channel_label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600" dir="ltr">
                      {row.recipient || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <StatusBadge status={row.status} label={row.status_label} />
                    </td>
                    <td className="max-w-[150px] truncate px-4 py-3 font-mono text-[11px] text-slate-500" dir="ltr" title={row.provider_message_id}>
                      {row.provider_message_id || "—"}
                    </td>
                    <td className="max-w-[190px] px-4 py-3">
                      <p className="truncate text-xs text-slate-700" title={row.subject}>
                        {row.subject || row.template_name || "—"}
                      </p>
                      {row.template_name && row.subject ? (
                        <p className="mt-0.5 truncate font-mono text-[10px] text-slate-400" dir="ltr">
                          {row.template_name}
                        </p>
                      ) : null}
                    </td>
                    <td className="max-w-[170px] truncate px-4 py-3 text-[11px] text-rose-600" title={row.error_message}>
                      {row.error_message || "—"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          {formatNumber(count)} اعلان · صفحه {formatNumber(page)} از {formatNumber(pages)}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            <ChevronRight className="h-4 w-4" />
            قبلی
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pages || loading}
            onClick={() => setPage((current) => current + 1)}
          >
            بعدی
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {selected ? <DetailDrawer row={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  )
}
