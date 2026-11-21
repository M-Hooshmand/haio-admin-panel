"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Hash,
  Inbox,
  Loader2,
  MessageSquare,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Search,
  Send,
  Wallet,
  XCircle,
} from "lucide-react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type Location = 1 | 2
type StatusFilter = "all" | "delivered" | "pending" | "failed"

interface SmsMessage {
  MsgID: number | string | null
  Body: string | null
  SendDate: string | null
  Sender: string | null
  Receiver: string | null
  CurrentLocation: number | null
  status_code: number | null
  status_label: string
  delivered: boolean
  failed: boolean
  Parts: number | null
  RecCount: number | null
  RecSuccess: number | null
  RecFailed: number | null
}

interface Overview {
  provider: string
  configured: boolean
  location: number
  credit_sms: number
  credit_rial: number
  low_balance_threshold_rial: number
  messages: SmsMessage[]
  fetched_at: string
  detail?: string
}

const POLL_OPTIONS = [
  { value: 1000, label: "هر ۱ ثانیه" },
  { value: 5000, label: "هر ۵ ثانیه" },
  { value: 15000, label: "هر ۱۵ ثانیه" },
]

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "همه" },
  { key: "delivered", label: "رسیده" },
  { key: "pending", label: "در راه" },
  { key: "failed", label: "ناموفق" },
]

function formatNumber(value: number | null | undefined): string {
  return (value ?? 0).toLocaleString("fa-IR")
}

function formatDateTime(value?: string | null): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString("fa-IR", { dateStyle: "short", timeStyle: "medium" })
}

function formatClock(value: Date | null): string {
  if (!value) return "—"
  return value.toLocaleTimeString("fa-IR", { hour12: false })
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

function StatusBadge({ row }: { row: SmsMessage }) {
  const tone = row.delivered
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : row.failed
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-amber-200 bg-amber-50 text-amber-700"
  const Icon = row.delivered ? CheckCircle2 : row.failed ? XCircle : Clock
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        tone,
      )}
      title={row.status_code === null ? "کد وضعیت از ارائه‌دهنده دریافت نشد" : `کد ${row.status_code}`}
    >
      <Icon className="h-3 w-3" />
      {row.status_label}
    </span>
  )
}

export default function MeliPayamakPage() {
  const [location, setLocation] = useState<Location>(2)
  const [count, setCount] = useState(25)
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [intervalMs, setIntervalMs] = useState(5000)
  const [paused, setPaused] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")

  const requestId = useRef(0)
  const busy = useRef(false)

  const load = useCallback(
    async (options?: { refresh?: boolean; silent?: boolean }) => {
      if (busy.current) return
      busy.current = true
      const current = ++requestId.current
      if (!options?.silent) setLoading(true)
      try {
        const { data: payload } = await api.get<Overview>("/staff/sms/melipayamak/", {
          params: {
            location,
            count,
            ...(options?.refresh ? { refresh: 1 } : {}),
          },
        })
        if (current !== requestId.current) return
        setData(payload)
        setError("")
        setLastUpdated(new Date())
      } catch (err) {
        if (current !== requestId.current) return
        setError(extractError(err))
      } finally {
        busy.current = false
        if (current === requestId.current && !options?.silent) setLoading(false)
      }
    },
    [location, count],
  )

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (paused) return
    const timer = window.setInterval(() => {
      if (document.visibilityState === "hidden") return
      void load({ silent: true })
    }, intervalMs)
    return () => window.clearInterval(timer)
  }, [load, intervalMs, paused])

  const rows = data?.messages ?? []
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (statusFilter === "delivered" && !row.delivered) return false
      if (statusFilter === "failed" && !row.failed) return false
      if (statusFilter === "pending" && (row.delivered || row.failed)) return false
      if (!needle) return true
      return (
        (row.Receiver ?? "").toLowerCase().includes(needle) ||
        (row.Body ?? "").toLowerCase().includes(needle) ||
        String(row.MsgID ?? "").includes(needle)
      )
    })
  }, [rows, search, statusFilter])

  const stats = useMemo(() => {
    let delivered = 0
    let failed = 0
    for (const row of rows) {
      if (row.delivered) delivered += 1
      else if (row.failed) failed += 1
    }
    return { delivered, failed, pending: rows.length - delivered - failed }
  }, [rows])

  const lowBalance =
    data != null && data.credit_rial < data.low_balance_threshold_rial
  const usageRatio =
    data && data.low_balance_threshold_rial > 0
      ? Math.min(100, Math.round((data.credit_rial / (data.low_balance_threshold_rial * 4)) * 100))
      : null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <MessageSquare className="h-4 w-4 text-indigo-600" />
            ملی‌پیامک
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs leading-6 text-slate-500">
            <span className="inline-flex items-center gap-1">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  paused ? "bg-slate-400" : "animate-pulse bg-emerald-500",
                )}
              />
              {paused ? "بروزرسانی متوقف شد" : "بروزرسانی زنده"}
            </span>
            <span className="text-slate-300">•</span>
            <span>آخرین دریافت: {formatClock(lastUpdated)}</span>
            {data?.fetched_at ? (
              <>
                <span className="text-slate-300">•</span>
                <span>داده ارائه‌دهنده: {formatDateTime(data.fetched_at)}</span>
              </>
            ) : null}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={intervalMs}
            onChange={(event) => setIntervalMs(Number(event.target.value))}
            className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs text-slate-700"
            aria-label="فاصله بروزرسانی"
          >
            {POLL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPaused((value) => !value)}
            title={paused ? "ادامه بروزرسانی خودکار" : "توقف بروزرسانی خودکار"}
          >
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            {paused ? "ادامه" : "توقف"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load({ refresh: true })}
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            بروزرسانی
          </Button>
        </div>
      </div>

      {data?.configured === false ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-800">
          <p className="font-bold">اتصال به ملی‌پیامک کامل نشده است.</p>
          <p>{error || data.detail}</p>
          <p className="mt-1">
            در سرور <code dir="ltr">MELIPAYAMAK_USERNAME</code> و{" "}
            <code dir="ltr">MELIPAYAMAK_API_KEY</code> را تنظیم کنید و IP سرور را در فهرست
            IPهای مجاز پنل ملی‌پیامک ثبت کنید.
          </p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs leading-6 text-rose-700">
          {error}
        </div>
      ) : null}

      {lowBalance && data ? (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            موجودی ریالی زیر آستانه هشدار ({formatNumber(data.low_balance_threshold_rial / 10)}{" "}
            تومان) است. در صورت تمام‌شدن شارژ، ارسال پیامک‌های ورود و هشدارهای کاربران قطع
            می‌شود.
          </span>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className={cn("rounded-2xl border bg-white p-4", lowBalance ? "border-amber-300" : "border-slate-200")}>
          <p className="flex items-center gap-2 text-[11px] font-medium text-slate-400">
            <Wallet className="h-3.5 w-3.5 text-indigo-500" />
            موجودی حساب (ریال)
          </p>
          <p className="mt-2 text-xl font-bold text-slate-900">
            {loading && !data ? "…" : `${formatNumber((data?.credit_rial ?? 0) / 10)} تومان`}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {formatNumber(data?.credit_rial ?? 0)} ریال — همان عدد «موجودی» در سایدبار پنل ملی‌پیامک
          </p>
          {usageRatio !== null ? (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={cn("h-full rounded-full", lowBalance ? "bg-amber-500" : "bg-emerald-500")}
                style={{ width: `${usageRatio}%` }}
              />
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="flex items-center gap-2 text-[11px] font-medium text-slate-400">
            <Radio className="h-3.5 w-3.5 text-indigo-500" />
            پیامک باقی‌مانده
          </p>
          <p className="mt-2 text-xl font-bold text-slate-900">
            {loading && !data ? "…" : formatNumber(data?.credit_sms ?? 0)}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">بر اساس واحد شمارش ملی‌پیامک</p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
          <p className="flex items-center gap-2 text-[11px] font-medium text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            رسیده به گوشی
          </p>
          <p className="mt-2 text-xl font-bold text-emerald-800">{formatNumber(stats.delivered)}</p>
          <p className="mt-0.5 text-[11px] text-emerald-700/70">از {formatNumber(rows.length)} پیامک این صفحه</p>
        </div>

        <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4">
          <p className="flex items-center gap-2 text-[11px] font-medium text-rose-700">
            <XCircle className="h-3.5 w-3.5" />
            ناموفق / در راه
          </p>
          <p className="mt-2 text-xl font-bold text-rose-800">{formatNumber(stats.failed)}</p>
          <p className="mt-0.5 text-[11px] text-rose-700/70">
            {formatNumber(stats.pending)} پیامک هنوز در حال ارسال
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
          {[
            { value: 2 as Location, label: "ارسالی", icon: Send },
            { value: 1 as Location, label: "دریافتی", icon: Inbox },
          ].map((tab) => {
            const Icon = tab.icon
            const active = location === tab.value
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setLocation(tab.value)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors",
                  active ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-500 hover:text-slate-800",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setStatusFilter(filter.key)}
                className={cn(
                  "rounded-lg px-2.5 py-1.5 text-[11px] transition-colors",
                  statusFilter === filter.key
                    ? "bg-slate-900 font-medium text-white"
                    : "text-slate-500 hover:text-slate-800",
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <select
            value={count}
            onChange={(event) => setCount(Number(event.target.value))}
            className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs text-slate-700"
            aria-label="تعداد پیامک"
          >
            {[25, 50, 100].map((value) => (
              <option key={value} value={value}>
                {value} پیامک آخر
              </option>
            ))}
          </select>
          <div className="relative">
            <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="جست‌وجوی شماره یا متن"
              className="h-9 w-56 pr-8 text-xs"
            />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <p className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <MessageSquare className="h-3.5 w-3.5 text-indigo-600" />
            {location === 2 ? "پیامک‌های ارسالی" : "پیامک‌های دریافتی"}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-normal text-slate-500">
              {formatNumber(filtered.length)}
            </span>
          </p>
          {loading ? (
            <span className="flex items-center gap-1 text-[11px] text-slate-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              دریافت…
            </span>
          ) : null}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-right text-xs">
            <thead className="bg-slate-50 text-[11px] text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">زمان</th>
                <th className="px-3 py-2 font-medium">{location === 2 ? "گیرنده" : "فرستنده"}</th>
                <th className="px-3 py-2 font-medium">متن پیامک</th>
                <th className="px-3 py-2 font-medium">وضعیت</th>
                <th className="px-3 py-2 font-medium">بخش</th>
                <th className="px-3 py-2 font-medium">شناسه</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((row) => (
                <tr key={String(row.MsgID ?? `${row.Receiver}-${row.SendDate}`)} className="hover:bg-slate-50/60">
                  <td className="whitespace-nowrap px-3 py-2 text-slate-500">{formatDateTime(row.SendDate)}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-slate-700" dir="ltr">
                    {row.Receiver || "—"}
                  </td>
                  <td className="max-w-[380px] px-3 py-2">
                    <p className="line-clamp-2 break-words text-slate-700" title={row.Body ?? ""}>
                      {row.Body || "—"}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <StatusBadge row={row} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-500">
                    {formatNumber(row.Parts ?? 1)}
                    {row.RecCount != null ? (
                      <span className="mr-1 text-[10px] text-slate-400">
                        ({formatNumber(row.RecSuccess)}✓ / {formatNumber(row.RecFailed)}✗)
                      </span>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-[10px] text-slate-400" dir="ltr">
                    {row.MsgID ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <Hash className="h-6 w-6 text-slate-300" />
            <p className="text-xs text-slate-500">
              {rows.length === 0
                ? "پیامکی در این بخش ثبت نشده است."
                : "با این فیلتر پیامکی پیدا نشد."}
            </p>
          </div>
        ) : null}
      </div>

      <p className="text-[11px] leading-6 text-slate-400">
        وضعیت‌ها مستقیم از ملی‌پیامک خوانده می‌شوند؛ داده سرور حداکثر چند ثانیه کش می‌شود تا
        فراخوانی‌های پیاپی به ارائه‌دهنده محدود بماند. برای وضعیت یک شناسه مشخص از اندپوینت
        <code dir="ltr" className="mx-1">/staff/sms/melipayamak/delivery/</code>
        استفاده می‌شود.
      </p>
    </div>
  )
}
