"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AlertTriangle, ChevronDown, Cloud, Loader2, RefreshCw, Server } from "lucide-react"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"

export interface CloudzyServer {
  id: string | null
  hostname: string
  status: string
  ip: string
  region: string
  os: string
  vcpu: number | null
  ram_mb: number | null
  disk_gb: number | null
}

export interface CloudzyBalance {
  available: boolean
  amount: number | null
  currency: string | null
  path: string | null
  error: string | null
  checked_at: string | null
}

export interface CloudzySnapshot {
  balance: CloudzyBalance
  servers: CloudzyServer[]
  summary: { total: number; active: number; shutdown: number; other: number }
  inventory_error: string | null
  threshold: number
  low_balance: boolean
  alert: { group_configured: boolean; last_alert_at: string | null; last_alert_balance: number | null }
  fetched_at: string
  cached: boolean
}

const POLL_MS = 60_000

function money(amount: number | null | undefined, currency?: string | null): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "—"
  const symbol = currency === "EUR" ? "€" : currency === "GBP" ? "£" : "$"
  return `${symbol}${amount.toFixed(2)}`
}

function statusTone(status: string) {
  switch (status) {
    case "active":
      return { dot: "bg-emerald-500", text: "text-emerald-700", label: "فعال" }
    case "shutdown":
    case "stopped":
    case "off":
      return { dot: "bg-rose-500", text: "text-rose-700", label: "خاموش" }
    default:
      return { dot: "bg-slate-400", text: "text-slate-600", label: status || "نامشخص" }
  }
}

export function CloudzyStatusWidget() {
  const [snapshot, setSnapshot] = useState<CloudzySnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(false)
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async (force = false) => {
    try {
      if (force) setRefreshing(true)
      const { data } = await api.get<CloudzySnapshot>("/panel/cloudzy/", {
        params: force ? { refresh: 1 } : undefined,
      })
      setSnapshot(data)
      setError(false)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const timer = setInterval(() => void load(), POLL_MS)
    const onFocus = () => void load()
    window.addEventListener("focus", onFocus)
    return () => {
      clearInterval(timer)
      window.removeEventListener("focus", onFocus)
    }
  }, [load])

  useEffect(() => {
    if (!open) return
    const onClick = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [open])

  const balance = snapshot?.balance
  const summary = snapshot?.summary
  const low = Boolean(snapshot?.low_balance)
  const serversDown = Boolean(summary && summary.shutdown > 0)
  const amountLabel = loading ? "…" : money(balance?.amount, balance?.currency)

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs transition-colors sm:px-3",
          low
            ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
            : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
        )}
        aria-label="وضعیت شارژ و سرورهای کلودزی"
        title="شارژ پنل و وضعیت سرورهای کلودزی"
      >
        <span className="relative flex items-center">
          <Cloud className={cn("h-4 w-4", low ? "text-rose-600" : "text-slate-500")} />
          {low ? (
            <AlertTriangle className="absolute -right-1 -top-1 h-2.5 w-2.5 text-rose-600" />
          ) : null}
        </span>
        <span className="flex items-baseline gap-1">
          <span className="hidden text-[10px] font-medium text-slate-500 sm:inline">شارژ کلودزی</span>
          <span className={cn("font-bold tabular-nums", low && "text-rose-700")}>
            {balance?.available === false ? "نامشخص" : amountLabel}
          </span>
        </span>
        <span className="hidden h-3 w-px bg-slate-300 sm:block" />
        <span className="hidden items-center gap-1 sm:flex">
          <Server className={cn("h-3.5 w-3.5", serversDown ? "text-amber-600" : "text-slate-400")} />
          <span className={cn("tabular-nums", serversDown ? "text-amber-700" : "text-slate-600")}>
            {loadErrorOrSummary(error, summary)}
          </span>
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-slate-400 transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-50 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
              <Cloud className="h-4 w-4 text-sky-600" />
              پنل کلودزی
            </div>
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={refreshing}
              className="rounded-md p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              aria-label="به‌روزرسانی"
            >
              {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            </button>
          </div>

          <div
            className={cn(
              "mb-2 rounded-lg px-3 py-2",
              low ? "bg-rose-50" : "bg-slate-50"
            )}
          >
            <div className="text-[10px] text-slate-500">موجودی حساب</div>
            <div className={cn("text-lg font-bold tabular-nums", low ? "text-rose-700" : "text-slate-900")}>
              {balance?.available === false ? "نامشخص" : amountLabel}
              {balance?.available ? (
                <span className="mr-1 text-[10px] font-normal text-slate-500">
                  (حد هشدار {money(snapshot?.threshold ?? 2, balance?.currency)})
                </span>
              ) : null}
            </div>
            {balance?.available === false && balance?.error ? (
              <div className="mt-1 text-[10px] leading-relaxed text-amber-700">{balance.error}</div>
            ) : null}
            {low ? (
              <div className="mt-1 flex items-center gap-1 text-[10px] font-medium text-rose-700">
                <AlertTriangle className="h-3 w-3" />
                شارژ پنل کم است — هشدار در بله ارسال می‌شود
              </div>
            ) : null}
          </div>

          <div className="mb-1 flex items-center justify-between text-[10px] text-slate-500">
            <span>سرورها</span>
            <span className="tabular-nums">
              {summary ? `${summary.total} دستگاه · ${summary.active} فعال` : "—"}
              {summary && summary.shutdown > 0 ? ` · ${summary.shutdown} خاموش` : ""}
            </span>
          </div>

          <div className="max-h-64 space-y-1 overflow-y-auto">
            {loading && !snapshot ? (
              <div className="flex items-center justify-center py-4 text-xs text-slate-400">
                <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin" /> در حال دریافت…
              </div>
            ) : null}

            {snapshot?.inventory_error ? (
              <div className="rounded-md bg-amber-50 px-2 py-1.5 text-[10px] text-amber-800">
                {snapshot.inventory_error}
              </div>
            ) : null}

            {snapshot?.servers?.length ? (
              snapshot.servers.map((server) => {
                const tone = statusTone(server.status)
                return (
                  <div
                    key={server.id ?? server.hostname}
                    className="flex items-center justify-between rounded-md border border-slate-100 px-2 py-1.5"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[11px] font-medium text-slate-800" dir="ltr">
                        {server.hostname}
                      </div>
                      <div className="truncate text-[10px] text-slate-500" dir="ltr">
                        {server.ip || "—"}
                        {server.region ? ` · ${server.region}` : ""}
                      </div>
                    </div>
                    <span className={cn("flex shrink-0 items-center gap-1 text-[10px] font-medium", tone.text)}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} />
                      {tone.label}
                    </span>
                  </div>
                )
              })
            ) : !loading && !snapshot?.inventory_error ? (
              <div className="py-3 text-center text-[11px] text-slate-400">سروری ثبت نشده است</div>
            ) : null}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-[9px] text-slate-400">
            <span>{snapshot?.fetched_at ? `آخرین بروزرسانی: ${formatClock(snapshot.fetched_at)}` : ""}</span>
            {error ? <span className="text-amber-600">اتصال به سرور برقرار نشد</span> : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function loadErrorOrSummary(
  error: boolean,
  summary: CloudzySnapshot["summary"] | undefined
): string {
  if (error && !summary) return "—"
  if (!summary) return "…"
  if (summary.total === 0) return "بدون سرور"
  return `${summary.active}/${summary.total} فعال`
}

function formatClock(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit" }).format(date)
}
