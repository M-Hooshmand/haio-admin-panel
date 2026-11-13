"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ComponentType } from "react"
import {
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Wallet,
  X,
} from "lucide-react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { JalaliDateInput } from "@/components/ui/jalali-date-input"
import { formatJalali, formatJalaliShort } from "@/lib/jalali"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/stores/auth-store"

// ---------------------------------------------------------------------------
// public config types
// ---------------------------------------------------------------------------

/** Fields every product report row shares (see haio/staff/product_apis.py). */
export interface ReportRow {
  id: string
  status: string
  status_label: string
  plan_slug: string
  plan_name: string
  organization_name: string
  organization_slug: string
  user_id: number | null
  username: string | null
  email: string | null
  mobile: string | null
  display_name: string
  billing_cycle: string
  billing_cycle_label: string
  price: number
  created_at: string
  current_period_start: string | null
  current_period_end: string | null
  [key: string]: unknown
}

export type PlanFieldType = "text" | "number" | "textarea" | "checkbox" | "php_versions"

export interface PlanField {
  key: string
  label: string
  type: PlanFieldType
  required?: boolean
  nullable?: boolean
  help?: string
  placeholder?: string
  mono?: boolean
}

export interface DetailField {
  key: string
  label: string
  kind?: "date" | "date-time" | "money" | "number" | "bool" | "text" | "mono"
}

export interface ProductReportConfig {
  /** Key inside `/staff/products/report-meta/`. */
  product: "wordpress" | "android_cloud"
  title: string
  subtitle: string
  icon: ComponentType<{ className?: string }>
  sitesPath: string
  summaryPath: string
  plansPath: string
  /** "سایت" / "دستگاه" — used in the empty state and plan hint. */
  entityName: string
  /** Domain or host shown as the product-specific identifier column. */
  identifier: { label: string; value: (row: ReportRow) => string }
  details: DetailField[]
  planFields: PlanField[]
  planDefaults: Record<string, string | number | boolean>
  planNote: string
}

// ---------------------------------------------------------------------------
// API shapes
// ---------------------------------------------------------------------------

interface Page<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

interface Option {
  value: string
  label: string
}

interface MetaPlan {
  slug: string
  name: string
  is_active: boolean
  is_trial?: boolean
  is_multi_site?: boolean
}

interface OrgOption {
  slug: string
  name: string
}

interface ReportMeta {
  statuses: Option[]
  cycles: Option[]
  plans: MetaPlan[]
  organizations: OrgOption[]
}

interface Summary {
  total: number
  active: number
  expired: number
  pending: number
  canceled: number
  live: number
  trial?: number
  revenue_current_period: number
  revenue_monthly_equivalent: number
  by_status: { key: string; label: string; count: number }[]
  by_plan: { slug: string; name: string; count: number; active: number; is_active: boolean }[]
}

interface PlanRecord {
  id: string
  slug: string
  name: string
  is_active: boolean
  price_monthly: number
  price_annual: number
  [key: string]: unknown
}

type FormValues = Record<string, string | number | boolean>

const PAGE_SIZE = 20

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—"
  return value.toLocaleString("fa-IR")
}

function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—"
  return `${formatNumber(value)} تومان`
}

function formatDateTime(value?: string | null): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString("fa-IR", { dateStyle: "short", timeStyle: "short" })
}

function extractError(error: unknown): string {
  const data = (error as { response?: { data?: unknown } })?.response?.data
  if (typeof data === "string") return data
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>
    if (typeof record.detail === "string") return record.detail
    for (const [key, value] of Object.entries(record)) {
      if (typeof value === "string") return `${key}: ${value}`
      if (Array.isArray(value) && typeof value[0] === "string") return `${key}: ${value[0]}`
    }
    const first = Object.values(record)[0]
    if (typeof first === "string") return first
  }
  const message = (error as { message?: string })?.message
  return message || "خطای نامشخص در ارتباط با سرور"
}

const STATUS_TONES: Record<string, string> = {
  running: "border-emerald-200 bg-emerald-50 text-emerald-700",
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  verified: "border-emerald-200 bg-emerald-50 text-emerald-700",
  stopped: "border-slate-200 bg-slate-50 text-slate-600",
  suspended: "border-amber-200 bg-amber-50 text-amber-700",
  pending_payment: "border-sky-200 bg-sky-50 text-sky-700",
  provisioning: "border-sky-200 bg-sky-50 text-sky-700",
  booting: "border-sky-200 bg-sky-50 text-sky-700",
  error: "border-rose-200 bg-rose-50 text-rose-700",
  canceled: "border-rose-200 bg-rose-50 text-rose-700",
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        STATUS_TONES[status] ?? "border-slate-200 bg-slate-50 text-slate-600",
      )}
    >
      {label || status || "—"}
    </span>
  )
}

function DetailValue({ field, value }: { field: DetailField; value: unknown }) {
  if (value === null || value === undefined || value === "") return <span className="text-slate-300">—</span>
  switch (field.kind) {
    case "date":
      return <span>{formatJalali(String(value))}</span>
    case "date-time":
      return <span>{formatDateTime(String(value))}</span>
    case "money":
      return <span>{formatMoney(Number(value))}</span>
    case "number":
      return <span>{formatNumber(Number(value))}</span>
    case "bool":
      return <span>{value ? "بله" : "خیر"}</span>
    case "mono":
      return (
        <span dir="ltr" className="font-mono text-[11px]">
          {String(value)}
        </span>
      )
    default:
      return <span>{String(value)}</span>
  }
}

function planToForm(plan: PlanRecord, fields: PlanField[]): FormValues {
  const values: FormValues = {}
  for (const field of fields) {
    const raw = plan[field.key]
    if (field.type === "checkbox") values[field.key] = Boolean(raw)
    else if (field.type === "php_versions") values[field.key] = Array.isArray(raw) ? raw.join(", ") : ""
    else values[field.key] = raw === null || raw === undefined ? "" : String(raw)
  }
  return values
}

function buildPlanPayload(fields: PlanField[], values: FormValues): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  for (const field of fields) {
    const raw = values[field.key]
    if (field.type === "checkbox") {
      payload[field.key] = Boolean(raw)
      continue
    }
    if (field.type === "php_versions") {
      payload[field.key] = String(raw ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
      continue
    }
    if (field.type === "number") {
      const text = String(raw ?? "").trim()
      if (!text) {
        if (field.nullable) payload[field.key] = null
        continue
      }
      payload[field.key] = Number(text)
      continue
    }
    payload[field.key] = String(raw ?? "").trim()
  }
  return payload
}

// ---------------------------------------------------------------------------
// page
// ---------------------------------------------------------------------------

export function ProductReportPage({ config }: { config: ProductReportConfig }) {
  const role = useAuthStore((state) => state.role)
  // The staff API is authoritative (admin tier); the panel only hides controls
  // it knows will be rejected.
  const canWritePlans = role === "MANAGER"

  const [rows, setRows] = useState<ReportRow[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [summary, setSummary] = useState<Summary | null>(null)
  const [summaryError, setSummaryError] = useState("")
  const [meta, setMeta] = useState<ReportMeta | null>(null)

  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [plan, setPlan] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [cycle, setCycle] = useState("")
  const [organization, setOrganization] = useState("")
  const [dateFrom, setDateFrom] = useState<string | null>(null)
  const [dateTo, setDateTo] = useState<string | null>(null)

  const [selected, setSelected] = useState<ReportRow | null>(null)
  const requestId = useRef(0)

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  const filterParams = useMemo(() => {
    const params: Record<string, string> = {}
    if (search) params.search = search
    if (plan) params.plan = plan
    if (statusFilter) params.status = statusFilter
    if (cycle) params.billing_cycle = cycle
    if (organization) params.organization = organization
    if (dateFrom) params.date_from = dateFrom
    if (dateTo) params.date_to = dateTo
    return params
  }, [search, plan, statusFilter, cycle, organization, dateFrom, dateTo])

  const fetchRows = useCallback(async () => {
    const current = ++requestId.current
    setLoading(true)
    setError("")
    try {
      const { data } = await api.get<Page<ReportRow>>(config.sitesPath, {
        params: { ...filterParams, page, page_size: PAGE_SIZE },
      })
      if (current !== requestId.current) return
      setRows(data.results)
      setCount(data.count)
    } catch (err) {
      if (current !== requestId.current) return
      setError(extractError(err))
    } finally {
      if (current === requestId.current) setLoading(false)
    }
  }, [config.sitesPath, filterParams, page])

  const fetchSummary = useCallback(async () => {
    try {
      const { data } = await api.get<Summary>(config.summaryPath, { params: filterParams })
      setSummary(data)
      setSummaryError("")
    } catch (err) {
      setSummaryError(extractError(err))
    }
  }, [config.summaryPath, filterParams])

  const fetchMeta = useCallback(async () => {
    try {
      const { data } = await api.get<Record<string, ReportMeta>>("/staff/products/report-meta/")
      setMeta(data[config.product] ?? null)
    } catch {
      // Filters fall back to the static plan list inside the plan dialog; a
      // failed meta call must not blank the report.
      setMeta(null)
    }
  }, [config.product])

  useEffect(() => {
    void fetchMeta()
  }, [fetchMeta])

  useEffect(() => {
    void fetchRows()
  }, [fetchRows])

  useEffect(() => {
    void fetchSummary()
  }, [fetchSummary])

  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  const hasDateRange = Boolean(dateFrom || dateTo)
  const activeFilterCount =
    [plan, statusFilter, cycle, organization].filter(Boolean).length + (hasDateRange ? 1 : 0)

  const resetFilters = () => {
    setSearchInput("")
    setPlan("")
    setStatusFilter("")
    setCycle("")
    setOrganization("")
    setDateFrom(null)
    setDateTo(null)
    setPage(1)
  }

  const refreshAll = () => {
    void fetchRows()
    void fetchSummary()
    void fetchMeta()
  }

  const Icon = config.icon

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Icon className="h-4 w-4 text-indigo-600" />
            {config.title}
          </h2>
          <p className="mt-1 text-xs leading-6 text-slate-500">{config.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <PlansDialog
            config={config}
            meta={meta}
            canWrite={canWritePlans}
            onChanged={refreshAll}
          />
          <Button variant="outline" size="sm" onClick={refreshAll} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            بروزرسانی
          </Button>
        </div>
      </div>

      {summaryError ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          خلاصه گزارش دریافت نشد: {summaryError}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={Wallet}
          label="کل فروش"
          value={summary ? formatNumber(summary.total) : "…"}
          tone="border-slate-200 bg-white text-slate-900"
          accent="text-slate-500"
          hint={config.entityName}
        />
        <SummaryCard
          icon={CheckCircle2}
          label="فعال"
          value={summary ? formatNumber(summary.active) : "…"}
          tone="border-emerald-200 bg-emerald-50 text-emerald-900"
          accent="text-emerald-700"
          hint="دوره جاری معتبر"
        />
        <SummaryCard
          icon={Ban}
          label="منقضی"
          value={summary ? formatNumber(summary.expired) : "…"}
          tone="border-rose-200 bg-rose-50 text-rose-900"
          accent="text-rose-700"
          hint="پایان دوره گذشته"
        />
        <SummaryCard
          icon={Clock3}
          label="در انتظار"
          value={summary ? formatNumber(summary.pending) : "…"}
          tone="border-sky-200 bg-sky-50 text-sky-900"
          accent="text-sky-700"
          hint="پرداخت / راه‌اندازی"
        />
      </div>

      {summary ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
          <span>
            درآمد دورهٔ جاری:{" "}
            <b className="text-slate-800">{formatMoney(summary.revenue_current_period)}</b>
          </span>
          <span>
            معادل ماهانه:{" "}
            <b className="text-slate-800">{formatMoney(summary.revenue_monthly_equivalent)}</b>
          </span>
          {typeof summary.trial === "number" ? (
            <span>
              نسخهٔ آزمایشی: <b className="text-slate-800">{formatNumber(summary.trial)}</b>
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3">
        <div className="grid gap-2 lg:grid-cols-[1fr_170px_170px_150px_200px]">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="نام مشتری، ایمیل، موبایل، سازمان، پلن یا شناسه…"
              className="pr-9"
            />
          </div>
          <select
            value={plan}
            onChange={(event) => {
              setPlan(event.target.value)
              setPage(1)
            }}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100"
          >
            <option value="">همه پلن‌ها</option>
            {(meta?.plans ?? []).map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.name}
                {item.is_active ? "" : " (غیرفعال)"}
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
            {(meta?.statuses ?? []).map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <select
            value={cycle}
            onChange={(event) => {
              setCycle(event.target.value)
              setPage(1)
            }}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100"
          >
            <option value="">همه دوره‌ها</option>
            {(meta?.cycles ?? []).map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <select
            value={organization}
            onChange={(event) => {
              setOrganization(event.target.value)
              setPage(1)
            }}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100"
          >
            <option value="">همه سازمان‌ها</option>
            {(meta?.organizations ?? []).map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="w-full sm:w-52">
            <p className="mb-1 text-[11px] text-slate-400">از تاریخ خرید</p>
            <JalaliDateInput
              value={dateFrom}
              onChange={(iso) => {
                setDateFrom(iso)
                setPage(1)
              }}
            />
          </div>
          <div className="w-full sm:w-52">
            <p className="mb-1 text-[11px] text-slate-400">تا تاریخ خرید</p>
            <JalaliDateInput
              value={dateTo}
              onChange={(iso) => {
                setDateTo(iso)
                setPage(1)
              }}
            />
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
        <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-right text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">تاریخ خرید</th>
                <th className="px-4 py-3 font-medium">مشتری</th>
                <th className="px-4 py-3 font-medium">سازمان</th>
                <th className="px-4 py-3 font-medium">پلن</th>
                <th className="px-4 py-3 font-medium">{config.identifier.label}</th>
                <th className="px-4 py-3 font-medium">پایان دوره</th>
                <th className="px-4 py-3 font-medium">مبلغ / دوره</th>
                <th className="px-4 py-3 font-medium">وضعیت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-slate-400">
                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                    در حال دریافت گزارش…
                  </td>
                </tr>
              ) : null}

              {!loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-slate-400">
                    هیچ {config.entityName}ی با این فیلترها پیدا نشد.
                  </td>
                </tr>
              ) : null}

              {rows.map((row) => {
                const customer =
                  row.display_name ||
                  row.username ||
                  row.email ||
                  row.mobile ||
                  (row.user_id ? `#${row.user_id}` : "—")
                return (
                  <tr
                    key={row.id}
                    onClick={() => setSelected(row)}
                    className="cursor-pointer transition-colors hover:bg-indigo-50/40"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                      {formatJalaliShort(row.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium text-slate-800">{customer}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400" dir="ltr">
                        {row.mobile || row.email || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-slate-700">{row.organization_name || "—"}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-slate-400" dir="ltr">
                        {row.organization_slug}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-slate-700">{row.plan_name || "—"}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-slate-400" dir="ltr">
                        {row.plan_slug}
                      </p>
                    </td>
                    <td
                      className="max-w-[210px] truncate px-4 py-3 text-xs text-slate-600"
                      dir="ltr"
                      title={config.identifier.value(row)}
                    >
                      {config.identifier.value(row) || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                      {formatJalaliShort(row.current_period_end)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">
                      {formatMoney(row.price)}
                      <span className="mr-1 text-[10px] text-slate-400">
                        / {row.billing_cycle_label || row.billing_cycle}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <StatusBadge status={row.status} label={row.status_label} />
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
          {formatNumber(count)} {config.entityName} · صفحه {formatNumber(page)} از{" "}
          {formatNumber(pages)}
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

      {selected ? (
        <DetailDrawer config={config} row={selected} onClose={() => setSelected(null)} />
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// summary card
// ---------------------------------------------------------------------------

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone,
  accent,
  hint,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  value: string
  tone: string
  accent: string
  hint: string
}) {
  return (
    <div className={cn("rounded-2xl border p-4", tone)}>
      <span className={cn("flex items-center gap-1.5 text-xs font-medium", accent)}>
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      <p className="mt-0.5 text-[10px] opacity-60">{hint}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// row detail drawer
// ---------------------------------------------------------------------------

function DetailDrawer({
  config,
  row,
  onClose,
}: {
  config: ProductReportConfig
  row: ReportRow
  onClose: () => void
}) {
  const base: DetailField[] = [
    { key: "created_at", label: "تاریخ خرید", kind: "date-time" },
    { key: "status_label", label: "وضعیت" },
    { key: "plan_name", label: "پلن" },
    { key: "plan_slug", label: "شناسه پلن", kind: "mono" },
    { key: "organization_name", label: "سازمان" },
    { key: "organization_slug", label: "شناسه سازمان", kind: "mono" },
    { key: "display_name", label: "مشتری" },
    { key: "username", label: "نام کاربری", kind: "mono" },
    { key: "email", label: "ایمیل", kind: "mono" },
    { key: "mobile", label: "موبایل", kind: "mono" },
    { key: "billing_cycle_label", label: "دوره پرداخت" },
    { key: "price", label: "مبلغ دوره", kind: "money" },
    { key: "current_period_start", label: "شروع دوره", kind: "date-time" },
    { key: "current_period_end", label: "پایان دوره", kind: "date-time" },
    { key: "application_status", label: "وضعیت اپلیکیشن" },
  ]

  return (
    <div
      className="fixed inset-0 z-40 flex justify-start bg-slate-900/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <aside
        className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900">جزئیات {config.entityName}</p>
            <p className="mt-0.5 truncate font-mono text-[10px] text-slate-400" dir="ltr">
              {row.id}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="بستن"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 divide-y divide-slate-100 overflow-y-auto px-4">
          <div className="flex items-center justify-between py-3 text-xs">
            <span className="text-slate-400">{config.identifier.label}</span>
            <span className="max-w-[60%] truncate text-slate-800" dir="ltr">
              {config.identifier.value(row) || "—"}
            </span>
          </div>
          {[...base, ...config.details].map((field) => (
            <div key={field.key} className="flex items-start justify-between gap-4 py-3 text-xs">
              <span className="shrink-0 text-slate-400">{field.label}</span>
              <span className="text-left text-slate-800 break-all">
                <DetailValue field={field} value={row[field.key]} />
              </span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  )
}

// ---------------------------------------------------------------------------
// plans dialog
// ---------------------------------------------------------------------------

function PlansDialog({
  config,
  meta,
  canWrite,
  onChanged,
}: {
  config: ProductReportConfig
  meta: ReportMeta | null
  canWrite: boolean
  onChanged: () => void
}) {
  const [open, setOpen] = useState(false)
  const [plans, setPlans] = useState<PlanRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState("")
  const [editing, setEditing] = useState<PlanRecord | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [values, setValues] = useState<FormValues>({})

  const resetForm = useCallback(
    (plan?: PlanRecord) => {
      setEditing(plan ?? null)
      setValues(plan ? planToForm(plan, config.planFields) : { ...config.planDefaults })
      setFormError("")
    },
    [config.planDefaults, config.planFields],
  )

  const fetchPlans = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const { data } = await api.get<{ count: number; results: PlanRecord[] }>(config.plansPath)
      setPlans(data.results)
    } catch (err) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }, [config.plansPath])

  useEffect(() => {
    if (!open) return
    void fetchPlans()
  }, [open, fetchPlans])

  const openDialog = () => {
    setOpen(true)
    setShowForm(false)
    resetForm()
  }

  const startCreate = () => {
    resetForm()
    setShowForm(true)
  }

  const startEdit = (plan: PlanRecord) => {
    resetForm(plan)
    setShowForm(true)
  }

  const save = async () => {
    setSaving(true)
    setFormError("")
    try {
      const payload = buildPlanPayload(config.planFields, values)
      if (editing) {
        await api.patch(`${config.plansPath}${editing.slug}/`, payload)
      } else {
        await api.post(config.plansPath, payload)
      }
      setShowForm(false)
      await fetchPlans()
      onChanged()
    } catch (err) {
      setFormError(extractError(err))
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (plan: PlanRecord) => {
    setError("")
    try {
      await api.post(
        `${config.plansPath}${plan.slug}/${plan.is_active ? "deactivate" : "activate"}/`,
      )
      await fetchPlans()
      onChanged()
    } catch (err) {
      setError(extractError(err))
    }
  }

  const activePlanCount = plans.filter((plan) => plan.is_active).length
  const metaPlanCount = meta?.plans.length ?? 0

  return (
    <>
      <Button variant="outline" size="sm" onClick={openDialog}>
        <Settings2 className="h-4 w-4" />
        مدیریت پلن‌ها
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4">
          <div className="my-6 w-full max-w-5xl rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">مدیریت پلن‌های {config.title}</h3>
                <p className="mt-1 text-[11px] leading-5 text-slate-500">
                  پلن ساخته‌شده در جدول واقعی محصول ذخیره می‌شود و اگر فعال باشد در فهرست
                  عمومی/API دیده می‌شود. {config.planNote}
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="بستن"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3 text-xs text-slate-500">
              <span>
                {formatNumber(plans.length)} پلن · {formatNumber(activePlanCount)} فعال
                {metaPlanCount !== plans.length ? ` · ${formatNumber(metaPlanCount)} در فیلتر` : ""}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void fetchPlans()}
                  disabled={loading}
                >
                  <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                  بروزرسانی
                </Button>
                {canWrite ? (
                  <Button size="sm" onClick={startCreate}>
                    <Plus className="h-4 w-4" />
                    پلن جدید
                  </Button>
                ) : null}
              </div>
            </div>

            {!canWrite ? (
              <div className="mx-5 mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                مشاهدهٔ پلن‌ها برای همهٔ نقش‌ها باز است؛ ساخت، ویرایش و فعال/غیرفعال‌کردن
                پلن فقط با نقش «مدیر» انجام می‌شود.
              </div>
            ) : null}

            {error ? (
              <div className="mx-5 mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
                {error}
              </div>
            ) : null}

            <div className="max-h-[65vh] overflow-y-auto">
              {showForm ? (
                <PlanForm
                  config={config}
                  values={values}
                  editing={Boolean(editing)}
                  saving={saving}
                  error={formError}
                  onChange={(key, value) =>
                    setValues((current) => ({ ...current, [key]: value }))
                  }
                  onCancel={() => {
                    setShowForm(false)
                    setFormError("")
                  }}
                  onSave={() => void save()}
                />
              ) : (
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="px-5 py-2.5 font-medium">نام</th>
                      <th className="px-3 py-2.5 font-medium">شناسه</th>
                      <th className="px-3 py-2.5 font-medium">ماهانه</th>
                      <th className="px-3 py-2.5 font-medium">سالانه</th>
                      <th className="px-3 py-2.5 font-medium">وضعیت</th>
                      <th className="px-3 py-2.5 font-medium">
                        {config.product === "wordpress" ? "سایت‌ها" : "دستگاه‌ها"}
                      </th>
                      <th className="px-5 py-2.5 font-medium">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading && plans.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                          در حال دریافت پلن‌ها…
                        </td>
                      </tr>
                    ) : null}
                    {!loading && plans.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                          هنوز پلنی ثبت نشده است.
                        </td>
                      </tr>
                    ) : null}
                    {plans.map((plan) => {
                      const usage = plan[config.product === "wordpress" ? "sites_count" : "devices_count"]
                      const visible = config.product === "wordpress"
                        ? plan.is_active && !plan.is_multi_site && !plan.is_trial
                        : plan.is_active
                      return (
                        <tr key={plan.id} className={cn(!plan.is_active && "bg-slate-50/60")}>
                          <td className="px-5 py-2.5">
                            <p className="text-xs font-medium text-slate-800">{plan.name}</p>
                            {plan.is_trial ? (
                              <span className="mt-0.5 inline-block rounded bg-violet-50 px-1.5 text-[10px] text-violet-700">
                                آزمایشی
                              </span>
                            ) : null}
                            {plan.is_multi_site ? (
                              <span className="mt-0.5 mr-1 inline-block rounded bg-sky-50 px-1.5 text-[10px] text-sky-700">
                                چند سایتی
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500" dir="ltr">
                            {plan.slug}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-700">
                            {formatMoney(plan.price_monthly)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-700">
                            {formatMoney(plan.price_annual)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-xs">
                            <span
                              className={cn(
                                "inline-flex rounded-full border px-2 py-0.5 text-[10px]",
                                plan.is_active
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "border-slate-200 bg-slate-100 text-slate-500",
                              )}
                            >
                              {plan.is_active ? "فعال" : "غیرفعال"}
                            </span>
                            {plan.is_active && !visible ? (
                              <span className="mt-0.5 block text-[10px] text-amber-600">
                                خارج از کاتالوگ عمومی
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-slate-600">
                            {typeof usage === "number" ? formatNumber(usage) : "—"}
                          </td>
                          <td className="px-5 py-2.5">
                            {canWrite ? (
                              <div className="flex items-center gap-1.5">
                                <Button variant="ghost" size="sm" onClick={() => startEdit(plan)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                  ویرایش
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className={plan.is_active ? "text-rose-600" : "text-emerald-600"}
                                  onClick={() => void toggle(plan)}
                                >
                                  {plan.is_active ? "غیرفعال" : "فعال"}
                                </Button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-300">فقط مشاهده</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

// ---------------------------------------------------------------------------
// plan form
// ---------------------------------------------------------------------------

function PlanForm({
  config,
  values,
  editing,
  saving,
  error,
  onChange,
  onCancel,
  onSave,
}: {
  config: ProductReportConfig
  values: FormValues
  editing: boolean
  saving: boolean
  error: string
  onChange: (key: string, value: string | boolean) => void
  onCancel: () => void
  onSave: () => void
}) {
  return (
    <div className="p-5">
      <h4 className="mb-4 text-xs font-bold text-slate-700">
        {editing ? "ویرایش پلن" : "ساخت پلن جدید"}
      </h4>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {config.planFields.map((field) => (
          <PlanFieldInput
            key={field.key}
            field={field}
            value={values[field.key]}
            disabled={saving || (editing && field.key === "slug")}
            onChange={(value) => onChange(field.key, value)}
          />
        ))}
      </div>

      {error ? (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="mt-4 flex items-center gap-2">
        <Button size="sm" onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {editing ? "ذخیره تغییرات" : "ساخت پلن"}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          انصراف
        </Button>
        {editing ? (
          <span className="text-[11px] text-slate-400">
            شناسه پلن قابل تغییر نیست؛ برای تغییر آن یک پلن جدید بسازید.
          </span>
        ) : null}
      </div>
    </div>
  )
}

function PlanFieldInput({
  field,
  value,
  disabled,
  onChange,
}: {
  field: PlanField
  value: string | number | boolean | undefined
  disabled: boolean
  onChange: (value: string | boolean) => void
}) {
  const wide = field.type === "textarea" || field.type === "php_versions"
  const controlClass =
    "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-400"

  return (
    <label className={cn("block", wide && "sm:col-span-2 lg:col-span-3")}>
      <span className="mb-1 block text-[11px] text-slate-500">
        {field.label}
        {field.required ? <span className="text-rose-500"> *</span> : null}
      </span>

      {field.type === "checkbox" ? (
        <span className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={Boolean(value)}
            disabled={disabled}
            onChange={(event) => onChange(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600"
          />
          {field.help || "فعال"}
        </span>
      ) : field.type === "textarea" ? (
        <textarea
          value={String(value ?? "")}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          rows={2}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-400"
        />
      ) : (
        <input
          dir={field.mono || field.type === "php_versions" ? "ltr" : undefined}
          type={field.type === "number" ? "number" : "text"}
          value={String(value ?? "")}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          className={cn(
            controlClass,
            (field.mono || field.type === "php_versions") && "font-mono text-[12px]",
          )}
        />
      )}

      {field.help && field.type !== "checkbox" ? (
        <span className="mt-0.5 block text-[10px] text-slate-400">{field.help}</span>
      ) : null}
    </label>
  )
}

