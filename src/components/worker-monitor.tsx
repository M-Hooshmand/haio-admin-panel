"use client"

import { useMemo, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Loader2,
  RefreshCw,
  Search,
  TimerOff,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  PRODUCT_BY_KEY,
  faNum,
  formatDuration,
  labelForTask,
  normalizeProductKey,
  productForTask,
  type DiagnosticIssue,
  type TaskRunStatus,
  type WorkerMonitorSnapshot,
} from "@/lib/brain"

type TabKey = "running" | "stuck" | "done" | "queued"

const TABS: Array<{ key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: "running", label: "در حال اجرا", icon: Zap },
  { key: "queued", label: "در صف", icon: Clock3 },
  { key: "stuck", label: "گیرکرده / خطا", icon: AlertTriangle },
  { key: "done", label: "انجام‌شده", icon: CheckCircle2 },
]

interface MonitorRow {
  key: string
  taskId: string
  name: string
  product: string
  status: TaskRunStatus | "queued"
  worker: string
  startedAt: string | null
  finishedAt: string | null
  durationMs: number | null
  detail: string
  args?: string
  error?: string
  queue?: string
  isLive?: boolean
}

function statusTone(status: MonitorRow["status"]) {
  switch (status) {
    case "running":
      return { dot: "bg-emerald-400", text: "text-emerald-300", label: "در حال اجرا" }
    case "queued":
      return { dot: "bg-sky-400", text: "text-sky-300", label: "در صف" }
    case "success":
      return { dot: "bg-indigo-400", text: "text-indigo-300", label: "موفق" }
    case "failure":
      return { dot: "bg-rose-500", text: "text-rose-300", label: "خطا" }
    case "revoked":
      return { dot: "bg-amber-400", text: "text-amber-300", label: "لغو شده" }
  }
}

function clock(iso: string | null): string {
  if (!iso) return "—"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("fa-IR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date)
}

function age(iso: string | null): string {
  if (!iso) return "—"
  const timestamp = new Date(iso).getTime()
  if (Number.isNaN(timestamp)) return "—"
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000))
  if (seconds < 60) return `${faNum(seconds)} ثانیه`
  if (seconds < 3600) return `${faNum(Math.floor(seconds / 60))} دقیقه`
  if (seconds < 86400) return `${faNum(Math.floor(seconds / 3600))} ساعت`
  return `${faNum(Math.floor(seconds / 86400))} روز`
}

function taskRows(snapshot: WorkerMonitorSnapshot | null, issues: DiagnosticIssue[]): MonitorRow[] {
  const rows: MonitorRow[] = []
  const seen = new Set<string>()

  for (const run of snapshot?.recent ?? []) {
    seen.add(run.task_id)
    rows.push({
      key: `run-${run.id}`,
      taskId: run.task_id,
      name: run.name,
      product: run.product,
      status: run.status,
      worker: run.worker || "—",
      startedAt: run.started_at,
      finishedAt: run.finished_at,
      durationMs: run.duration_ms,
      detail: run.status === "failure" ? run.error || "اجرا با خطا متوقف شد" : run.result || "—",
      args: run.args,
      error: run.error,
      queue: run.queue,
    })
  }

  // Live inspect sees tasks that may be too new for the lifecycle log.
  for (const task of snapshot?.live?.tasks ?? []) {
    if (!task.task_id || seen.has(task.task_id)) continue
    seen.add(task.task_id)
    rows.push({
      key: `live-${task.task_id}`,
      taskId: task.task_id,
      name: task.name,
      product: productForTask(task.name),
      status: task.state === "active" ? "running" : "queued",
      worker: task.worker || "—",
      startedAt: task.time_start ? new Date(task.time_start * 1000).toISOString() : null,
      finishedAt: null,
      durationMs: null,
      detail: task.state === "active" ? "در حال اجرا روی ورکر" : "در انتظار ورکر آزاد",
      args: task.args,
      isLive: true,
    })
  }

  // A failed task also appears in the diagnostic issue feed. Keep a row even
  // before the worker writes the final lifecycle row.
  for (const issue of issues) {
    if (!issue.task_name) continue
    const key = `issue-${issue.id}`
    if (rows.some((row) => row.name === issue.task_name && row.status === "failure")) continue
    rows.push({
      key,
      taskId: issue.correlation_id || `issue-${issue.id}`,
      name: issue.task_name,
      product: issue.product,
      status: "failure",
      worker: "—",
      startedAt: issue.created_at,
      finishedAt: null,
      durationMs: null,
      detail: issue.summary,
      error: issue.detail,
    })
  }

  return rows.sort((a, b) => {
    const at = a.startedAt ? new Date(a.startedAt).getTime() : 0
    const bt = b.startedAt ? new Date(b.startedAt).getTime() : 0
    return bt - at
  })
}

function isStuck(row: MonitorRow, snapshot: WorkerMonitorSnapshot | null): boolean {
  if (row.status === "failure") return true
  if (row.status !== "running" || !row.startedAt) return false
  if (Array.isArray(snapshot?.stuck_task_ids)) {
    if (row.taskId && snapshot.stuck_task_ids.includes(row.taskId)) return true
    // Live broker tasks have no durable row yet; keep the age fallback for them.
    if (!row.isLive) return false
  }
  const minutes = Number(snapshot?.stuck_after_minutes ?? 10)
  return Date.now() - new Date(row.startedAt).getTime() > minutes * 60_000
}

function stopReason(row: MonitorRow, snapshot: WorkerMonitorSnapshot | null): string | null {
  if (row.status === "failure") {
    return row.error || row.detail || "اجرای وظیفه با خطا متوقف شد."
  }
  if (row.status === "revoked") {
    return "اجرا پیش از پایان لغو یا منقضی شده است."
  }
  if (isStuck(row, snapshot)) {
    const backendReason = row.taskId ? snapshot?.stuck_reasons?.[row.taskId] : null
    if (backendReason) return backendReason
    return `بیش از ${faNum(Number(snapshot?.stuck_after_minutes ?? 10))} دقیقه در حال اجراست؛ احتمال قفل‌شدن ورکر یا تابع خارجی.`
  }
  return null
}

export function WorkerMonitor({
  snapshot,
  issues,
  error,
  isLoading,
}: {
  snapshot: WorkerMonitorSnapshot | null
  issues: DiagnosticIssue[]
  error?: string | null
  isLoading: boolean
}) {
  const [tab, setTab] = useState<TabKey>("running")
  const [query, setQuery] = useState("")
  const [expanded, setExpanded] = useState<string | null>(null)

  const rows = useMemo(() => taskRows(snapshot, issues), [snapshot, issues])

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (tab === "running" && row.status !== "running") return false
      if (tab === "queued" && row.status !== "queued") return false
      if (tab === "stuck" && !isStuck(row, snapshot)) return false
      if (tab === "done" && row.status !== "success" && row.status !== "revoked") return false
      if (normalized) {
        const haystack = `${row.name} ${labelForTask(row.name)} ${row.worker} ${row.taskId}`.toLowerCase()
        if (!haystack.includes(normalized)) return false
      }
      return true
    })
  }, [query, rows, snapshot, tab])

  const counts = snapshot?.counts
  const liveOk = snapshot?.live?.ok
  const workerCount = snapshot?.live?.workers?.length ?? 0
  const runCount = rows.filter((row) => row.status === "running" || row.status === "queued").length
  const stuckCount = rows.filter((row) => isStuck(row, snapshot)).length
  const taskLog = snapshot?.task_log !== false

  return (
    <section className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#070b16] text-white">
      <div className="flex flex-col gap-3 border-b border-white/[0.08] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-cyan-300">
            <Zap className="h-4 w-4" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[13px] font-semibold tracking-tight">مانیتور زندهٔ ورکرها</h2>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em]",
                  liveOk
                    ? "border-emerald-400/20 bg-emerald-500/[0.07] text-emerald-300"
                    : "border-amber-400/20 bg-amber-500/[0.07] text-amber-300",
                )}
              >
                <span className={cn("h-1 w-1 rounded-full", liveOk ? "bg-emerald-400" : "bg-amber-400")} />
                {liveOk ? "broker online" : "broker offline"}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] text-slate-500">
              {faNum(workerCount)} ورکر · {faNum(runCount)} وظیفهٔ فعال · {faNum(stuckCount)} مورد نیازمند بررسی
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="جست‌وجوی وظیفه یا ورکر…"
              className="h-8 w-56 rounded-md border border-white/[0.08] bg-white/[0.03] pr-8 pl-3 text-[11px] text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan-400/40"
            />
          </div>
          <span className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-slate-500">
            {isLoading ? (
              <span className="flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> syncing</span>
            ) : (
              <span className="flex items-center gap-1.5"><RefreshCw className="h-3 w-3" /> live</span>
            )}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px border-b border-white/[0.08] bg-white/[0.06] sm:grid-cols-4">
        {[
          { label: "در حال اجرا", value: counts?.running ?? rows.filter((r) => r.status === "running").length, tone: "text-emerald-300" },
          { label: "گیرکرده", value: counts?.stuck ?? stuckCount, tone: "text-rose-300" },
          { label: "موفق ۲۴ ساعت", value: taskLog ? (counts?.success_24h ?? 0) : null, tone: "text-indigo-300" },
          { label: "خطا ۲۴ ساعت", value: counts?.failure_24h ?? 0, tone: "text-amber-300" },
        ].map((item) => (
          <div key={item.label} className="bg-[#070b16] px-4 py-2.5">
            <p className="text-[9px] text-slate-500">{item.label}</p>
            <p className={cn("mt-1 font-mono text-[15px] font-medium tabular-nums leading-none", item.tone)}>
              {item.value === null ? "—" : faNum(item.value)}
            </p>
          </div>
        ))}
      </div>

      {!taskLog ? (
        <div className="border-b border-white/[0.08] bg-amber-500/[0.04] px-4 py-2 text-[10px] leading-5 text-amber-200/80">
          تاریخچهٔ دائمی تسک‌ها هنوز فعال نیست؛ این جدول از وضعیت زندهٔ بروکر و خطاهای ثبت‌شده در جدول Issue تغذیه می‌شود.
          برای نمایش تسک‌های انجام‌شده و گیرکردهٔ تاریخی، به جدول لاگ تسک نیاز است.
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-1 border-b border-white/[0.08] px-3 py-2">
        {TABS.map((item) => {
          const Icon = item.icon
          const active = tab === item.key
          const count =
            item.key === "running"
              ? rows.filter((row) => row.status === "running").length
              : item.key === "queued"
                ? rows.filter((row) => row.status === "queued").length
                : item.key === "stuck"
                  ? stuckCount
                  : rows.filter((row) => row.status === "success" || row.status === "revoked").length
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] transition",
                active
                  ? "bg-white/10 text-white"
                  : "text-slate-500 hover:bg-white/5 hover:text-slate-300",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
              <span className={cn("rounded-full px-1.5 text-[9px]", active ? "bg-white/10 text-slate-300" : "bg-white/5 text-slate-600")}>
                {faNum(count)}
              </span>
            </button>
          )
        })}
        {error ? <span className="mr-auto text-[10px] text-rose-300/80">{error}</span> : null}
      </div>

      <div className="max-h-[420px] overflow-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-slate-500">
            <TimerOff className="h-6 w-6 text-slate-600" />
            <p className="text-xs">در این دسته وظیفه‌ای ثبت نشده است.</p>
            <p className="text-[10px] text-slate-600">
              داده‌های اجرای تسک پس از اتصال ورکرها و اولین اجرای زمان‌بند پر می‌شود.
            </p>
          </div>
        ) : (
          <table className="w-full text-right text-[11px]">
            <thead className="sticky top-0 z-10 bg-[#080d1a] text-[10px] text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">وضعیت</th>
                <th className="px-3 py-2 font-medium">وظیفه</th>
                <th className="px-3 py-2 font-medium">محصول</th>
                <th className="px-3 py-2 font-medium">ورکر</th>
                <th className="px-3 py-2 font-medium">شروع</th>
                <th className="px-3 py-2 font-medium">مدت</th>
                <th className="px-3 py-2 font-medium">جزئیات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const tone = statusTone(row.status)
                const product = PRODUCT_BY_KEY[normalizeProductKey(row.product)]
                const isOpen = expanded === row.key
                const reason = stopReason(row, snapshot)
                const stuck = isStuck(row, snapshot)
                const stages = [
                  {
                    label: "دریافت / صف",
                    value: row.status === "queued" ? "در انتظار ورکر" : row.startedAt ? "پذیرفته شد" : "—",
                    tone: row.status === "queued" ? "text-sky-300" : "text-slate-300",
                  },
                  {
                    label: "شروع اجرا",
                    value: row.startedAt ? clock(row.startedAt) : "—",
                    tone: row.startedAt ? "text-slate-300" : "text-slate-600",
                  },
                  {
                    label: "پایان",
                    value:
                      row.status === "running"
                        ? "در جریان"
                        : row.finishedAt
                          ? clock(row.finishedAt)
                          : row.status === "queued"
                            ? "—"
                            : "ثبت نشده",
                    tone:
                      row.status === "failure"
                        ? "text-rose-300"
                        : row.status === "success" || row.status === "revoked"
                          ? "text-emerald-300"
                          : "text-amber-300",
                  },
                ]
                return (
                  <tr
                    key={row.key}
                    className="cursor-pointer border-t border-white/5 align-top transition hover:bg-white/[0.025]"
                    onClick={() => setExpanded(isOpen ? null : row.key)}
                  >
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <span className="inline-flex items-center gap-1.5">
                        <span className={cn("h-1.5 w-1.5 rounded-full", stuck && row.status === "running" ? "bg-rose-400" : tone.dot)} />
                        <span className={cn("text-[10px]", stuck && row.status === "running" ? "text-rose-300" : tone.text)}>
                          {stuck && row.status === "running" ? "گیرکرده" : tone.label}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-slate-200">{labelForTask(row.name)}</p>
                      <p className="mt-0.5 font-mono text-[9px] text-slate-600" dir="ltr">
                        {row.name}
                      </p>
                      {isOpen ? (
                        <div className="mt-2 space-y-2">
                          <div className="grid grid-cols-3 gap-px overflow-hidden rounded border border-white/10 bg-white/10" dir="rtl">
                            {stages.map((stage) => (
                              <div key={stage.label} className="bg-black/40 px-2 py-1.5">
                                <p className="text-[8px] text-slate-500">{stage.label}</p>
                                <p className={cn("mt-0.5 font-mono text-[9px]", stage.tone)}>{stage.value}</p>
                              </div>
                            ))}
                          </div>
                          {reason ? (
                            <p className="rounded border border-rose-400/20 bg-rose-500/[0.06] px-2 py-1.5 text-[9px] leading-4 text-rose-200/80">
                              علت توقف: {reason}
                            </p>
                          ) : null}
                          <div className="space-y-1 rounded-lg border border-white/10 bg-black/30 p-2 font-mono text-[9px] text-slate-400" dir="ltr">
                            <p>id: {row.taskId}</p>
                            {row.queue ? <p>queue: {row.queue}</p> : null}
                            {row.args ? <p className="line-clamp-3 whitespace-pre-wrap break-all">args: {row.args}</p> : null}
                            {row.error ? <p className="line-clamp-4 whitespace-pre-wrap break-all text-rose-300/80">{row.error}</p> : null}
                          </div>
                        </div>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: product.color }} />
                        <span className="text-slate-300">{product.label}</span>
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <span className="block max-w-[160px] truncate font-mono text-[9px] text-slate-500" dir="ltr">
                        {row.worker}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-400" title={row.startedAt ?? ""}>
                      {clock(row.startedAt)}
                      <span className="mr-1 text-[9px] text-slate-600">({age(row.startedAt)})</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-400">
                      {row.status === "running" ? age(row.startedAt) : formatDuration(row.durationMs)}
                    </td>
                    <td className="max-w-[300px] px-3 py-2.5 text-slate-500">
                      <span className="line-clamp-2">
                        {stuck && row.status === "running" ? `گیرکرده: ${reason ?? row.detail}` : row.detail}
                      </span>
                      <ChevronDown className={cn("mt-1 h-3 w-3 text-slate-600 transition", isOpen && "rotate-180")} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
