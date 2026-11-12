"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  Database,
  Gauge,
  Loader2,
  RefreshCw,
  Users,
  Waypoints,
  Zap,
} from "lucide-react"
import { BrainMap } from "@/components/brain-map"
import { WorkerMonitor } from "@/components/worker-monitor"
import { api } from "@/lib/api"
import { cn, formatNumber } from "@/lib/utils"
import {
  PRODUCTS,
  buildWorkerTasks,
  countWorkers,
  issuesByProductKey,
  pulsesPerMinute,
  type ActivitySnapshot,
  type DiagnosticIssue,
  type IssuesResponse,
  type SystemSnapshot,
  type BrainTopology,
  type WorkerMonitorSnapshot,
} from "@/lib/brain"

const ACTIVITY_INTERVAL_MS = 6_000
const DIAGNOSTICS_INTERVAL_MS = 20_000
const WORKERS_INTERVAL_MS = 6_000

const TONES = {
  emerald: { value: "text-emerald-300" },
  indigo: { value: "text-indigo-300" },
  sky: { value: "text-sky-300" },
  rose: { value: "text-rose-300" },
  amber: { value: "text-amber-300" },
  slate: { value: "text-slate-200" },
} as const

type Tone = keyof typeof TONES

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  tone = "slate",
}: {
  label: string
  value: React.ReactNode
  hint: React.ReactNode
  icon: React.ComponentType<{ className?: string }>
  tone?: Tone
}) {
  const styles = TONES[tone]
  return (
    <div className="bg-[#070c18] px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[9px] text-slate-500">{label}</p>
        <Icon className="h-3 w-3 shrink-0 text-slate-600" />
      </div>
      <p className={cn("mt-1 font-mono text-[15px] font-medium tabular-nums leading-none", styles.value)}>{value}</p>
      <p className="mt-1.5 truncate text-[8.5px] text-slate-600">{hint}</p>
    </div>
  )
}

function TopologyStrip({ topology }: { topology: BrainTopology | null }) {
  const nodes = topology?.nodes ?? []
  const reachable = nodes.filter((node) => node.reachable === true).length
  const mcp = topology?.mcp ?? []
  const mcpOk = mcp.filter((entry) => entry.ok).length
  const tools = mcp.reduce((total, entry) => total + (entry.tools ?? 0), 0)
  const agents = topology?.agents
  const skills = topology?.skills
  const items = [
    {
      key: "mcp",
      label: "MCP",
      value: topology ? `${formatNumber(mcpOk)}/${formatNumber(mcp.length)}` : "—",
      hint: topology ? `${formatNumber(tools)} ابزار متصل` : "در انتظار داده",
      ok: Boolean(topology && mcpOk === mcp.length && mcpOk > 0),
      title: mcp.map((entry) => `${entry.label}: ${entry.ok ? `${entry.tools ?? 0} tool` : entry.error || "down"}`).join("\n"),
    },
    {
      key: "agents",
      label: "AGENTS",
      value: topology ? `${formatNumber(agents?.active ?? 0)}/${formatNumber(agents?.total ?? 0)}` : "—",
      hint: topology ? `${formatNumber(agents?.mcp_tokens_active ?? 0)} توکن فعال · ${formatNumber(agents?.keys_active ?? 0)} کلید` : "در انتظار داده",
      ok: Boolean(agents && agents.active > 0),
      title: agents ? `Guest agents: ${agents.guest_agents.online}/${agents.guest_agents.total}` : "",
    },
    {
      key: "skills",
      label: "SKILLS",
      value: skills?.configured ? formatNumber(skills.count) : "—",
      hint: skills?.configured ? "مهارت ثبت‌شده" : "مسیر مهارت‌ها تنظیم نشده",
      ok: Boolean(skills?.configured && skills.count > 0),
      title: skills?.skills?.map((skill) => skill.name).join("\n") ?? "",
    },
    {
      key: "nodes",
      label: "NODES",
      value: topology ? `${formatNumber(reachable)}/${formatNumber(nodes.length)}` : "—",
      hint: topology ? `${formatNumber(nodes.length - reachable)} بدون پاسخ` : "در انتظار داده",
      ok: Boolean(nodes.length > 0 && reachable === nodes.length),
      title: nodes.map((node) => `${node.code || node.label}: ${node.reachable === true ? `${node.latency_ms ?? 0}ms` : "down"}`).join("\n"),
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.06] sm:grid-cols-4" dir="ltr">
      {items.map((item) => (
        <div key={item.key} className="bg-[#070c18] px-3 py-2.5" title={item.title || undefined}>
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[9px] tracking-[0.18em] text-slate-500">{item.label}</span>
            <span className={cn("h-1.5 w-1.5 rounded-full", item.ok ? "bg-emerald-400" : "bg-slate-600")} />
          </div>
          <p className="mt-1 font-mono text-[15px] font-medium tabular-nums leading-none text-slate-100">{item.value}</p>
          <p className="mt-1.5 truncate text-[9.5px] text-slate-400">{item.hint}</p>
        </div>
      ))}
    </div>
  )
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
  return message || "خطا در دریافت داده‌های زنده"
}

function formatClock(date: Date | null): string {
  if (!date) return "—"
  return new Intl.DateTimeFormat("fa-IR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date)
}

export default function InfrastructureBrainPage() {
  const [activity, setActivity] = useState<ActivitySnapshot | null>(null)
  const [system, setSystem] = useState<SystemSnapshot | null>(null)
  const [issues, setIssues] = useState<DiagnosticIssue[]>([])
  const [workers, setWorkers] = useState<WorkerMonitorSnapshot | null>(null)
  const [topology, setTopology] = useState<BrainTopology | null>(null)
  const [history, setHistory] = useState<Array<{ t: number; online: number }>>([])
  const [activityError, setActivityError] = useState<string | null>(null)
  const [diagnosticsError, setDiagnosticsError] = useState<string | null>(null)
  const [workersError, setWorkersError] = useState<string | null>(null)
  const [topologyError, setTopologyError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [auto, setAuto] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const loadActivity = useCallback(async () => {
    try {
      const { data } = await api.get<ActivitySnapshot>("/staff/monitoring/activity/")
      setActivity(data)
      setHistory((previous) => [...previous, { t: Date.now(), online: data.online_count }].slice(-48))
      setActivityError(null)
      setLastUpdated(new Date())
    } catch (error) {
      setActivityError(extractError(error))
    }
  }, [])

  const loadDiagnostics = useCallback(async () => {
    const [systemResult, issuesResult] = await Promise.allSettled([
      api.get<SystemSnapshot>("/staff/diagnostics/system/"),
      api.get<IssuesResponse>("/staff/diagnostics/issues/", { params: { limit: 12 } }),
    ])

    if (systemResult.status === "fulfilled") {
      setSystem(systemResult.value.data)
    }
    if (issuesResult.status === "fulfilled") {
      setIssues(issuesResult.value.data.results ?? [])
    }

    const failure =
      systemResult.status === "rejected"
        ? systemResult.reason
        : issuesResult.status === "rejected"
          ? issuesResult.reason
          : null

    if (failure) {
      setDiagnosticsError(extractError(failure))
    } else {
      setDiagnosticsError(null)
      setLastUpdated(new Date())
    }
  }, [])

  const loadWorkers = useCallback(async () => {    try {
      const { data } = await api.get<WorkerMonitorSnapshot>("/staff/diagnostics/workers/", {
        params: { limit: 80 },
      })
      setWorkers(data)
      setWorkersError(null)
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status
      if (status === 404) {
        setWorkersError("مانیتور زندهٔ ورکر روی این نسخهٔ بک‌اند فعال نیست؛ فهرست از رخدادها ساخته می‌شود.")
      } else {
        setWorkersError(extractError(error))
      }
    }
  }, [])

  const loadTopology = useCallback(async () => {
    try {
      const { data } = await api.get<BrainTopology>("/staff/diagnostics/brain/")
      setTopology(data)
      setTopologyError(null)
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status
      if (status === 404) {
        setTopologyError("توپولوژی نودها، MCP و ایجنت‌ها روی این نسخهٔ بک‌اند فعال نیست.")
      } else {
        setTopologyError(extractError(error))
      }
    }
  }, [])

  const refreshAll = useCallback(async () => {
    setIsRefreshing(true)
    await Promise.allSettled([loadActivity(), loadDiagnostics(), loadWorkers(), loadTopology()])
    setIsLoading(false)
    setIsRefreshing(false)
  }, [loadActivity, loadDiagnostics, loadWorkers, loadTopology])

  useEffect(() => {
    void refreshAll()
  }, [refreshAll])

  useEffect(() => {
    if (!auto) return
    const activityTimer = window.setInterval(() => void loadActivity(), ACTIVITY_INTERVAL_MS)
    const diagnosticsTimer = window.setInterval(
      () => void loadDiagnostics(),
      DIAGNOSTICS_INTERVAL_MS,
    )
    const workersTimer = window.setInterval(() => void loadWorkers(), WORKERS_INTERVAL_MS)
    const topologyTimer = window.setInterval(() => void loadTopology(), 60_000)
    return () => {
      window.clearInterval(activityTimer)
      window.clearInterval(diagnosticsTimer)
      window.clearInterval(workersTimer)
      window.clearInterval(topologyTimer)
    }
  }, [auto, loadActivity, loadDiagnostics, loadWorkers, loadTopology])

  const tasksByProduct = useMemo(() => buildWorkerTasks(system?.scheduler), [system])
  const issueCounts = useMemo(() => issuesByProductKey(system), [system])
  const online = activity?.online ?? []
  const workerCount = countWorkers(tasksByProduct)
  const pulses = pulsesPerMinute(tasksByProduct)
  const coreHealthy = Boolean(system?.database?.ok && system?.cache?.ok)
  const coreValue = !system ? "در انتظار" : coreHealthy ? "سالم" : "هشدار"
  const coreTone: Tone = !system ? "slate" : coreHealthy ? "emerald" : "amber"
  const errors = [activityError, diagnosticsError, topologyError].filter(Boolean) as string[]

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#070b16] p-4 text-white md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-indigo-300">
              <BrainCircuit className="h-[18px] w-[18px]" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight text-white">مغز زندهٔ زیرساخت</h2>
              <p className="mt-1.5 max-w-2xl text-[11px] leading-5 text-slate-500">
                هر نورون یک وظیفهٔ واقعی از زمان‌بند Celery است. درخواست کلاینت‌ها روی سیم‌ها به
                ورکر محصول می‌رسد و پاسخ از هستهٔ مرکزی به نود محصول برمی‌گردد. موس را روی هر
                نقطه ببرید تا جزئیات وظیفه، محصول و کلاینت را ببینید.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 font-mono text-[9px] text-slate-500">
              <Activity className="h-3 w-3 text-slate-500" />
              sync {formatClock(lastUpdated)}
            </span>
            <button
              type="button"
              onClick={() => setAuto((value) => !value)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[10px] font-medium transition-colors",
                auto
                  ? "border-emerald-400/20 bg-emerald-500/[0.07] text-emerald-300"
                  : "border-white/[0.08] bg-white/[0.03] text-slate-400 hover:text-slate-200",
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", auto ? "bg-emerald-400" : "bg-slate-600")} />
              {auto ? "پایش زنده" : "پایش متوقف"}
            </button>
            <button
              type="button"
              onClick={() => void refreshAll()}
              disabled={isRefreshing}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 text-[10px] font-medium text-slate-300 transition-colors hover:bg-white/[0.06] disabled:opacity-60"
            >
              <RefreshCw className={cn("h-3 w-3", isRefreshing && "animate-spin")} />
              بروزرسانی
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.06] sm:grid-cols-3 xl:grid-cols-6">
          <Kpi
            label="کلاینت آنلاین"
            value={formatNumber(activity?.online_count ?? online.length)}
            hint={`از ${formatNumber(activity?.today_count ?? 0)} فعال امروز`}
            icon={Users}
            tone="emerald"
          />
          <Kpi
            label="نورون‌های وظیفه"
            value={formatNumber(workerCount)}
            hint={`در ${formatNumber(PRODUCTS.length)} خوشهٔ محصول`}
            icon={Waypoints}
            tone="indigo"
          />
          <Kpi
            label="پالس زمان‌بند / دقیقه"
            value={formatNumber(pulses)}
            hint="اجرای مورد انتظار تسک‌ها"
            icon={Zap}
            tone="sky"
          />
          <Kpi
            label="رخداد ۲۴ ساعت"
            value={system ? formatNumber(system.issues_24h) : "—"}
            hint={`${formatNumber(system?.critical_24h ?? 0)} بحرانی · ${formatNumber(issues.length)} تازه`}
            icon={AlertTriangle}
            tone="rose"
          />
          <Kpi
            label="وضعیت هسته"
            value={coreValue}
            hint={`DB ${system?.database?.ok ? "✓" : "…"} · Cache ${system?.cache?.ok ? "✓" : "…"}`}
            icon={Database}
            tone={coreTone}
          />
          <Kpi
            label="آخرین همگام‌سازی"
            value={formatClock(lastUpdated)}
            hint={auto ? `کلاینت هر ۶ ثانیه` : "به‌روزرسانی دستی"}
            icon={Gauge}
            tone="slate"
          />
        </div>
      </section>

      <TopologyStrip topology={topology} />

      {errors.length > 0 ? (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{errors.join(" · ")}</span>
        </div>
      ) : null}

      <BrainMap
        tasksByProduct={tasksByProduct}
        online={online}
        onlineCount={activity?.online_count ?? online.length}
        issues={issues}
        issuesByProduct={issueCounts}
        system={system}
        monitor={workers}
        history={history}
        isLoading={isLoading}
      />

      <WorkerMonitor
        snapshot={workers}
        issues={issues}
        error={workersError}
        isLoading={isRefreshing}
      />

      <p className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
        <Loader2 className={cn("h-3 w-3", isLoading && "animate-spin")} />
        داده‌ها از فعالیت زندهٔ کلاینت‌ها، رجیستری زمان‌بند Celery، چرخهٔ اجرای وظیفه‌ها و
        رخدادهای سلامت بک‌اند گرفته می‌شود؛ هیچ سیگنال ساختگی روی نقشه نیست.
      </p>
    </div>
  )
}
