"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Gauge,
  Loader2,
  Mail,
  Package,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Timer,
  UserRound,
  Users,
} from "lucide-react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { NAV_ITEMS, navItemsForUser } from "@/lib/roles"
import { useAuthStore } from "@/stores/auth-store"

interface GateOwner {
  id: number
  display_name: string
  username: string
  email: string
  mobile: string
  role: string
  is_active: boolean
}

interface GatePackage {
  id: string
  name: string
  price: number
  traffic_bytes: number
}

interface GateAccount {
  id: string
  username: string
  status: string
  status_display: string
  is_legacy: boolean
  owner: GateOwner
  package: GatePackage
  package_name: string
  total_traffic_bytes: number
  usage_bytes: number
  remaining_traffic_bytes: number
  usage_display: string
  usage_percent: number
  traffic_is_over: boolean
  expired_at: string | null
  days_remaining: number | null
  is_expired: boolean
  pending_reserves_count: number
  last_sync: string | null
  created_at: string
  updated_at: string
}

interface GateSummary {
  total: number
  active: number
  expired: number
  quota_exhausted: number
  suspended: number
  expiring_soon: number
  traffic_total: number
  traffic_used: number
  traffic_remaining: number
  expiring_days: number
}

interface GatePage {
  count: number
  page: number
  page_size: number
  pages: number
  ordering: string
  generated_at: string
  summary: GateSummary
  results: GateAccount[]
}

const PAGE_SIZE = 25

const ORDERINGS = [
  { value: "created", label: "جدیدترین — قدیمی‌ترین در انتها (پیش‌فرض)" },
  { value: "expiry", label: "نزدیک‌ترین تاریخ انقضا" },
  { value: "usage", label: "بیشترین مصرف حجم" },
  { value: "remaining", label: "کمترین حجم باقی‌مانده" },
]

const GATE_STATUS: Record<string, { label: string; style: string }> = {
  active: {
    label: "فعال",
    style: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  expired: {
    label: "منقضی",
    style: "bg-slate-100 text-slate-600 border-slate-200",
  },
  quota_exhausted: {
    label: "اتمام ترافیک",
    style: "bg-amber-50 text-amber-700 border-amber-200",
  },
  suspended: {
    label: "تعلیق",
    style: "bg-rose-50 text-rose-700 border-rose-200",
  },
}

function extractError(error: unknown): string {
  const data = (error as { response?: { data?: unknown } })?.response?.data
  if (typeof data === "string") return data
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>
    if (typeof record.detail === "string") return record.detail
    for (const value of Object.values(record)) {
      if (typeof value === "string") return value
      if (Array.isArray(value) && typeof value[0] === "string") return value[0]
    }
  }
  return "خطایی رخ داد. دوباره تلاش کنید."
}

function formatNumber(value: number): string {
  return (value || 0).toLocaleString("fa-IR")
}

function formatDate(value?: string | null): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("fa-IR", { dateStyle: "medium" })
}

function formatDateTime(value?: string | null): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString("fa-IR", { dateStyle: "short", timeStyle: "short" })
}

function formatToman(value: number): string {
  if (!value) return "۰"
  return `${value.toLocaleString("fa-IR")} تومان`
}

/** 1024-based, so it matches the backend's ``usage_display``. */
function formatBytes(value: number): string {
  if (!value || value <= 0) return "۰"
  const units = ["B", "KB", "MB", "GB", "TB"]
  let size = value
  let index = 0
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024
    index += 1
  }
  const digits = index >= 3 ? (size < 10 ? 2 : 1) : 1
  return `${size.toLocaleString("fa-IR", { maximumFractionDigits: digits })} ${units[index]}`
}

function daysLabel(row: GateAccount): { text: string; style: string } {
  if (row.is_expired) {
    return { text: "منقضی شده", style: "bg-rose-50 text-rose-700 border-rose-200" }
  }
  if (row.days_remaining === null) {
    return { text: "بدون تاریخ انقضا", style: "bg-slate-100 text-slate-600 border-slate-200" }
  }
  if (row.days_remaining === 0) {
    return { text: "کمتر از ۱ روز", style: "bg-amber-50 text-amber-700 border-amber-200" }
  }
  const days = formatNumber(row.days_remaining)
  if (row.days_remaining <= 3) {
    return { text: `${days} روز مانده`, style: "bg-rose-50 text-rose-700 border-rose-200" }
  }
  if (row.days_remaining <= 7) {
    return { text: `${days} روز مانده`, style: "bg-amber-50 text-amber-700 border-amber-200" }
  }
  if (row.days_remaining <= 14) {
    return { text: `${days} روز مانده`, style: "bg-sky-50 text-sky-700 border-sky-200" }
  }
  return { text: `${days} روز مانده`, style: "bg-emerald-50 text-emerald-700 border-emerald-200" }
}

function trafficTone(percent: number): string {
  if (percent >= 90) return "bg-rose-500"
  if (percent >= 70) return "bg-amber-500"
  return "bg-emerald-500"
}

function StatusChip({ status }: { status: string }) {
  const item =
    GATE_STATUS[status] ?? {
      label: status || "—",
      style: "bg-slate-100 text-slate-600 border-slate-200",
    }
  return (
    <span className={cn("inline-flex rounded-lg border px-2 py-0.5 text-[11px]", item.style)}>
      {item.label}
    </span>
  )
}

function MetaCard({
  title,
  value,
  note,
  icon: Icon,
  tone,
  highlight = false,
}: {
  title: string
  value: string
  note: string
  icon: React.ComponentType<{ className?: string }>
  tone: string
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-white p-4",
        highlight ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[11px] text-slate-500">{title}</p>
        <Icon className={cn("h-4 w-4 shrink-0", tone)} />
      </div>
      <p className={cn("mt-2 text-lg font-bold", highlight ? "text-emerald-700" : "text-slate-900")}>
        {value}
      </p>
      <p className="mt-0.5 truncate text-[11px] text-slate-400">{note}</p>
    </div>
  )
}

function TrafficCell({ row }: { row: GateAccount }) {
  const percent = Math.min(100, Math.max(0, row.usage_percent))
  return (
    <div className="min-w-44">
      <div className="flex items-baseline justify-between gap-2 text-[11px]">
        <span className="font-medium text-slate-700">
          باقی‌مانده {formatBytes(row.remaining_traffic_bytes)}
        </span>
        <span className="text-slate-400">از {formatBytes(row.total_traffic_bytes)}</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn("h-1.5 rounded-full transition-all", trafficTone(percent))}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
        <span>
          مصرف {formatNumber(Math.round(percent))}٪
          {row.traffic_is_over ? " · تمام‌شده" : ""}
        </span>
        {row.usage_display ? <span>{row.usage_display}</span> : null}
      </div>
    </div>
  )
}

function OwnerCell({ owner }: { owner: GateOwner }) {
  return (
    <div className="min-w-44">
      <div className="flex items-center gap-1.5">
        <UserRound className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        <span className="truncate font-medium text-slate-800">{owner.display_name}</span>
        {!owner.is_active ? (
          <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] text-rose-600">غیرفعال</span>
        ) : null}
      </div>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
        <span className="font-mono">{owner.username}</span>
        {owner.mobile ? (
          <span className="inline-flex items-center gap-1">
            <Phone className="h-3 w-3" />
            {owner.mobile}
          </span>
        ) : null}
        {owner.email ? (
          <span className="inline-flex items-center gap-1 truncate">
            <Mail className="h-3 w-3" />
            {owner.email}
          </span>
        ) : null}
      </div>
    </div>
  )
}

export default function HaiogatePage() {
  const { user, isLoading: authLoading } = useAuthStore()
  const [rows, setRows] = useState<GateAccount[]>([])
  const [summary, setSummary] = useState<GateSummary | null>(null)
  const [count, setCount] = useState(0)
  const [pages, setPages] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)

  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const [expiring, setExpiring] = useState("")
  const [ordering, setOrdering] = useState("created")

  const requestId = useRef(0)

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  const fetchRows = useCallback(async () => {
    const current = ++requestId.current
    setLoading(true)
    setError("")
    try {
      const params: Record<string, string | number> = {
        page,
        page_size: PAGE_SIZE,
        ordering,
      }
      if (search) params.search = search
      if (status) params.status = status
      if (expiring) params.expiring = expiring
      const { data } = await api.get<GatePage>("/panel/haiogate/accounts/", { params })
      if (current !== requestId.current) return
      setRows(data.results)
      setSummary(data.summary)
      setCount(data.count)
      setPages(data.pages)
      setGeneratedAt(data.generated_at)
    } catch (err) {
      if (current !== requestId.current) return
      setError(extractError(err))
    } finally {
      if (current === requestId.current) setLoading(false)
    }
  }, [page, search, status, expiring, ordering])

  useEffect(() => {
    void fetchRows()
  }, [fetchRows])

  const sectionItem = NAV_ITEMS.find((item) => item.key === "haiogate")
  const allowed = navItemsForUser(user).some((item) => item.key === "haiogate")

  if (authLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-col items-center gap-2 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
          <p className="text-xs">در حال بررسی دسترسی…</p>
        </div>
      </div>
    )
  }

  if (!allowed) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
        <ShieldCheck className="mx-auto h-8 w-8 text-amber-500" />
        <h2 className="mt-3 text-sm font-bold text-amber-900">دسترسی محدود</h2>
        <p className="mt-2 text-sm text-amber-800">
          این بخش برای نقش شما در دسترس نیست.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm leading-6 text-slate-500">
            {sectionItem?.description} — همه کانفیگ‌های ساخته‌شده توسط کاربران، از جدیدترین
            تا قدیمی‌ترین. هر ردیف مالک، پکیج، حجم مصرف‌شده و باقی‌مانده، تاریخ انقضا و
            روزهای باقی‌مانده را نشان می‌دهد.
          </p>
          {generatedAt ? (
            <p className="mt-1 text-[11px] text-slate-400">
              آخرین بروزرسانی: {formatDateTime(generatedAt)}
            </p>
          ) : null}
        </div>
        <Button variant="outline" size="sm" onClick={() => void fetchRows()} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          بروزرسانی
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <MetaCard
          title="کل کانفیگ‌ها"
          value={formatNumber(summary?.total ?? 0)}
          note={`${formatNumber(count)} در این فهرست`}
          icon={Users}
          tone="text-indigo-600"
        />
        <MetaCard
          title="فعال"
          value={formatNumber(summary?.active ?? 0)}
          note="در حال استفاده"
          icon={ShieldCheck}
          tone="text-emerald-600"
          highlight
        />
        <MetaCard
          title={`رو به انقضا (${formatNumber(summary?.expiring_days ?? 7)} روز)`}
          value={formatNumber(summary?.expiring_soon ?? 0)}
          note="نیاز به تمدید"
          icon={Timer}
          tone="text-amber-600"
        />
        <MetaCard
          title="منقضی"
          value={formatNumber(summary?.expired ?? 0)}
          note="پایان دوره"
          icon={CalendarClock}
          tone="text-slate-500"
        />
        <MetaCard
          title="اتمام ترافیک"
          value={formatNumber(summary?.quota_exhausted ?? 0)}
          note="حجم تمام‌شده"
          icon={Gauge}
          tone="text-rose-600"
        />
        <MetaCard
          title="تعلیق"
          value={formatNumber(summary?.suspended ?? 0)}
          note="غیرفعال‌شده"
          icon={CircleAlert}
          tone="text-orange-600"
        />
        <MetaCard
          title="حجم باقی‌مانده کل"
          value={formatBytes(summary?.traffic_remaining ?? 0)}
          note={`از ${formatBytes(summary?.traffic_total ?? 0)}`}
          icon={Package}
          tone="text-violet-600"
        />
      </div>

      <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 lg:grid-cols-[1fr_170px_170px_260px]">
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="جستجو با نام کانفیگ، نام کاربر، موبایل یا ایمیل…"
            className="pr-9"
          />
        </div>
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value)
            setPage(1)
          }}
          className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100"
        >
          <option value="">همه وضعیت‌ها</option>
          <option value="active">فعال</option>
          <option value="expired">منقضی</option>
          <option value="quota_exhausted">اتمام ترافیک</option>
          <option value="suspended">تعلیق</option>
        </select>
        <select
          value={expiring}
          onChange={(event) => {
            setExpiring(event.target.value)
            setPage(1)
          }}
          className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100"
        >
          <option value="">همه تاریخ‌ها</option>
          <option value="7">انقضا تا ۷ روز آینده</option>
          <option value="30">انقضا تا ۳۰ روز آینده</option>
          <option value="90">انقضا تا ۹۰ روز آینده</option>
        </select>
        <select
          value={ordering}
          onChange={(event) => {
            setOrdering(event.target.value)
            setPage(1)
          }}
          className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100"
        >
          {ORDERINGS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1240px] text-right text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">کانفیگ</th>
                <th className="px-4 py-3 font-medium">برای چه کسی</th>
                <th className="px-4 py-3 font-medium">پکیج</th>
                <th className="px-4 py-3 font-medium">وضعیت</th>
                <th className="px-4 py-3 font-medium">حجم مصرف‌شده و باقی‌مانده</th>
                <th className="px-4 py-3 font-medium">باقی‌مانده از انقضا</th>
                <th className="px-4 py-3 font-medium">تاریخ ساخت</th>
                <th className="px-4 py-3 font-medium">آخرین همگام‌سازی</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-slate-400">
                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                    در حال دریافت کانفیگ‌ها…
                  </td>
                </tr>
              ) : null}

              {!loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-slate-400">
                    کانفیگی با این فیلترها پیدا نشد.
                  </td>
                </tr>
              ) : null}

              {rows.map((row) => {
                const days = daysLabel(row)
                return (
                  <tr key={row.id} className="transition-colors hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-medium text-slate-800">
                          {row.username}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
                        <span className="font-mono">{row.id.slice(0, 8)}</span>
                        {row.is_legacy ? (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">
                            انتقالی
                          </span>
                        ) : null}
                        {row.pending_reserves_count > 0 ? (
                          <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-indigo-600">
                            {formatNumber(row.pending_reserves_count)} تمدید در انتظار
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <OwnerCell owner={row.owner} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-medium text-slate-700">{row.package.name}</div>
                      <div className="mt-0.5 text-[11px] text-slate-400">
                        {formatToman(row.package.price)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusChip status={row.status} />
                    </td>
                    <td className="px-4 py-3">
                      <TrafficCell row={row} />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-lg border px-2 py-0.5 text-[11px]",
                          days.style,
                        )}
                      >
                        {days.text}
                      </span>
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                        <CalendarDays className="h-3 w-3" />
                        {formatDate(row.expired_at)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {formatDate(row.created_at)}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {formatDateTime(row.last_sync)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
        <span>
          {formatNumber(count)} کانفیگ · صفحه {formatNumber(page)} از {formatNumber(pages || 1)}
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
            disabled={page >= (pages || 1) || loading}
            onClick={() => setPage((current) => current + 1)}
          >
            بعدی
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
