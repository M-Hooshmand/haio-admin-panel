"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  BellRing,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Timer,
  VolumeX,
} from "lucide-react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface AlertRow {
  id: string
  fingerprint: string
  source: string
  source_label: string
  category: string
  category_label: string
  severity: "warning" | "error" | "critical"
  severity_label: string
  title: string
  sample: string
  occurrences: number
  last_run_count: number
  first_seen: string
  last_seen: string
  status: "open" | "resolved" | "muted"
  status_label: string
  resolved_at: string | null
  muted_until: string | null
  note: string
  meta: Record<string, unknown>
}

interface AlertResponse {
  rows: AlertRow[]
  total: number
  page: number
  page_size: number
  summary: {
    open: number
    muted: number
    open_by_severity: Record<string, number>
    last_seen: string | null
  }
}

const SOURCE_LABELS: Record<string, string> = {
  nginx: "nginx",
  backend: "بک‌اند",
  celery: "سلری",
  payment: "درگاه پرداخت",
}

const STATUS_OPTIONS = [
  { value: "open", label: "باز" },
  { value: "resolved", label: "رفع‌شده" },
  { value: "muted", label: "ساکت‌شده" },
] as const

const SEVERITY_OPTIONS = [
  { value: "", label: "همه" },
  { value: "critical", label: "بحرانی" },
  { value: "error", label: "خطا" },
  { value: "warning", label: "هشدار" },
] as const

const WINDOW_OPTIONS = [
  { value: 24, label: "۲۴ ساعت" },
  { value: 72, label: "۳ روز" },
  { value: 168, label: "۷ روز" },
  { value: 720, label: "۳۰ روز" },
] as const

const SEVERITY_STYLES: Record<string, { card: string; badge: string }> = {
  critical: { card: "border-rose-300 bg-rose-50/60", badge: "bg-rose-600 text-white" },
  error: { card: "border-rose-200 bg-white", badge: "bg-rose-100 text-rose-700" },
  warning: { card: "border-amber-200 bg-white", badge: "bg-amber-100 text-amber-800" },
}

function formatDateTime(value: string | null | undefined): string {
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

function extractError(error: unknown): string {
  const data = (error as { response?: { data?: unknown } })?.response?.data
  if (typeof data === "string") return data
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>
    if (typeof record.detail === "string") return record.detail
  }
  return "درخواست ناموفق بود."
}

export default function AlertsPage() {
  const [data, setData] = useState<AlertResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]["value"]>("open")
  const [severity, setSeverity] = useState("")
  const [hours, setHours] = useState(24)
  const [search, setSearch] = useState("")
  const [appliedSearch, setAppliedSearch] = useState("")
  const [expanded, setExpanded] = useState<string | null>(null)
  const [resolveNote, setResolveNote] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: payload } = await api.get<AlertResponse>("/panel/alerts/", {
        params: {
          status,
          severity: severity || undefined,
          since_hours: hours,
          search: appliedSearch || undefined,
          page_size: 100,
        },
      })
      setData(payload)
      setError(null)
    } catch (err) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }, [status, severity, hours, appliedSearch])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const timer = setInterval(() => void load(), 60_000)
    return () => clearInterval(timer)
  }, [load])

  const act = async (alert: AlertRow, action: string, payload: Record<string, unknown> = {}) => {
    setBusy(alert.id)
    try {
      await api.post(`/panel/alerts/${alert.id}/${action}/`, payload)
      setExpanded(null)
      setResolveNote("")
      await load()
    } catch (err) {
      setError(extractError(err))
    } finally {
      setBusy(null)
    }
  }

  const summary = data?.summary
  const critical = summary?.open_by_severity.critical ?? 0
  const errors = summary?.open_by_severity.error ?? 0
  const warnings = summary?.open_by_severity.warning ?? 0

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between md:p-5">
        <div>
          <h1 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
            <BellRing className="h-4 w-4 text-indigo-600" />
            هشدارهای سیستم
          </h1>
          <p className="mt-0.5 text-[11px] text-slate-500">
            دیده‌بان هر ساعت لاگ‌های nginx، بک‌اند و سلری را می‌خواند و فقط خطاهای جدید یا در حال رشد را
            اینجا نشان می‌دهد.
            {summary?.last_seen ? ` آخرین رخداد: ${formatDateTime(summary.last_seen)}` : ""}
          </p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          بروزرسانی
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Activity className="h-3.5 w-3.5" />
            هشدار باز
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{summary?.open ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <p className="flex items-center gap-1.5 text-[11px] text-rose-700">
            <AlertOctagon className="h-3.5 w-3.5" />
            بحرانی
          </p>
          <p className="mt-1 text-2xl font-bold text-rose-900">{critical}</p>
        </div>
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
          <p className="flex items-center gap-1.5 text-[11px] text-orange-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            خطا
          </p>
          <p className="mt-1 text-2xl font-bold text-orange-900">{errors}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="flex items-center gap-1.5 text-[11px] text-amber-700">
            <Timer className="h-3.5 w-3.5" />
            هشدار / ساکت‌شده
          </p>
          <p className="mt-1 text-2xl font-bold text-amber-900">
            {warnings}
            <span className="ms-1 text-xs font-normal text-amber-700">/ {summary?.muted ?? 0}</span>
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3 lg:flex-row lg:items-center">
        <div className="flex flex-wrap gap-1">
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setStatus(option.value)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px]",
                status === option.value
                  ? "border-slate-800 bg-slate-800 text-white"
                  : "border-slate-200 text-slate-600",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {SEVERITY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setSeverity(option.value)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px]",
                severity === option.value
                  ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                  : "border-slate-200 text-slate-600",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <select
          value={hours}
          onChange={(event) => setHours(Number(event.target.value))}
          className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[11px]"
        >
          {WINDOW_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label} اخیر
            </option>
          ))}
        </select>
        <form
          className="relative flex-1"
          onSubmit={(event) => {
            event.preventDefault()
            setAppliedSearch(search.trim())
          }}
        >
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="جست‌وجو در عنوان یا نمونهٔ خطا…"
            className="h-8 pl-9 text-xs"
          />
        </form>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>
      ) : null}

      {loading && !data ? (
        <div className="flex min-h-48 items-center justify-center rounded-2xl border border-slate-200 bg-white">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
        </div>
      ) : null}

      <div className="space-y-2">
        {(data?.rows ?? []).map((alert) => {
          const style = SEVERITY_STYLES[alert.severity] ?? SEVERITY_STYLES.error
          const isOpen = expanded === alert.id
          return (
            <div key={alert.id} className={cn("rounded-2xl border p-3.5", style.card)}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold",
                        style.badge,
                      )}
                    >
                      {alert.severity_label}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                      {SOURCE_LABELS[alert.source] ?? alert.source}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                      {alert.category_label}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px]",
                        alert.status === "open"
                          ? "bg-rose-100 text-rose-700"
                          : alert.status === "muted"
                            ? "bg-slate-200 text-slate-600"
                            : "bg-emerald-100 text-emerald-700",
                      )}
                    >
                      {alert.status_label}
                      {alert.status === "muted" && alert.muted_until
                        ? ` تا ${formatDateTime(alert.muted_until)}`
                        : ""}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs font-bold leading-5 text-slate-900" dir="auto">
                    {alert.title}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-500">
                    {alert.occurrences.toLocaleString("fa-IR")} بار · آخرین اجرا{" "}
                    {alert.last_run_count.toLocaleString("fa-IR")} بار · از{" "}
                    {formatDateTime(alert.first_seen)} تا {formatDateTime(alert.last_seen)}
                  </p>
                  {alert.note ? (
                    <p className="mt-1 rounded-lg bg-white/70 px-2 py-1 text-[10px] text-emerald-700">
                      یادداشت: {alert.note}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 px-2 text-[11px]"
                    onClick={() => setExpanded(isOpen ? null : alert.id)}
                  >
                    {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    نمونه
                  </Button>
                  {alert.status !== "resolved" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 px-2 text-[11px] text-emerald-700"
                      disabled={busy === alert.id}
                      onClick={() => void act(alert, "resolve")}
                    >
                      <Check className="h-3 w-3" />
                      بررسی شد
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 px-2 text-[11px]"
                      disabled={busy === alert.id}
                      onClick={() => void act(alert, "reopen")}
                    >
                      <RefreshCw className="h-3 w-3" />
                      بازگشایی
                    </Button>
                  )}
                  {alert.status === "open" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1 px-2 text-[11px] text-slate-500"
                      disabled={busy === alert.id}
                      onClick={() => void act(alert, "mute", { hours: 24 })}
                    >
                      <VolumeX className="h-3 w-3" />
                      ۲۴ ساعت
                    </Button>
                  ) : null}
                </div>
              </div>

              {isOpen ? (
                <div className="mt-3 space-y-2">
                  <pre
                    className="max-h-72 overflow-auto rounded-xl bg-slate-900 p-3 text-[10px] leading-5 text-slate-100"
                    dir="ltr"
                  >
                    {alert.sample || "نمونه‌ای ثبت نشده است."}
                  </pre>
                  {alert.status !== "resolved" ? (
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input
                        value={resolveNote}
                        onChange={(event) => setResolveNote(event.target.value)}
                        placeholder="توضیح رفع (اختیاری): مثلاً سرویس ری‌استارت شد"
                        className="h-8 flex-1 text-xs"
                      />
                      <Button
                        size="sm"
                        className="h-8 gap-1"
                        disabled={busy === alert.id}
                        onClick={() => void act(alert, "resolve", { note: resolveNote })}
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        ثبت رفع
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

      {!loading && (data?.rows.length ?? 0) === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center">
          <ShieldCheck className="mx-auto h-6 w-6 text-emerald-500" />
          <p className="mt-2 text-xs text-slate-500">در این بازه هشداری نیست.</p>
        </div>
      ) : null}

      <p className="text-[10px] text-slate-400">
        دیده‌بان ساعتی روی سرور پنل اجرا می‌شود (systemd timer) و مستقل از بک‌اند کار می‌کند؛ پس اگر
        خود پنل ۵۰۲ بدهد، هشدار همان‌جا ثبت می‌شود.
      </p>
    </div>
  )
}
