"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Activity,
  AlertTriangle,
  Boxes,
  CircleDot,
  Cpu,
  Gauge,
  Globe,
  Loader2,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  TrendingUp,
} from "lucide-react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type Status = "up" | "down" | "degraded" | "pending" | "paused" | "unknown"

interface OrgRef {
  id: number
  name: string | null
}

interface Overview {
  projects: number
  monitors: {
    total: number
    enabled: number
    up: number
    degraded: number
    down: number
    paused: number
    pending: number
    agent: number
  }
  servers: { total: number; online: number }
  clusters: { total: number; ok: number; warn: number; critical: number }
  incidents: { open: number; last_24h: number }
  notifications: { rules: number; period: string; sms: number; bale: number }
  plan_mix: { slug: string; name: string; total: number }[]
  top_organizations: { id: number; name: string | null; monitors: number }[]
  plans: {
    slug: string
    name: string
    price_monthly: number
    price_yearly: number
    max_monitors: number
    min_interval_seconds: number
    max_sms_recipients: number
    max_sms_messages_monthly: number
    max_bale_messages_monthly: number
    is_active: boolean
  }[]
  refreshed_at: string
}

interface ProjectRow {
  id: string
  name: string
  slug: string
  is_archived: boolean
  is_default: boolean
  organization: OrgRef | null
  owner_mobile: string | null
  plan: string | null
  plan_slug: string | null
  subscription_status: string | null
  billing_mode: string | null
  next_billing_date: string | null
  monitors: number
  servers: number
  created_at: string
}

interface MonitorRow {
  id: string
  name: string
  target: string
  type: string
  checks: string[]
  status: Status
  is_enabled: boolean
  interval_seconds: number
  last_checked_at: string | null
  last_latency_ms: number | null
  last_error_code: string
  project: { id: string; name: string | null }
  organization: OrgRef | null
  created_at: string
}

interface ServerRow {
  id: string
  name: string
  hostname: string
  os: string
  agent_version: string
  is_online: boolean
  is_enabled: boolean
  last_report_at: string | null
  last_ip: string | null
  cluster: { id: string; name: string } | null
  project: { id: string; name: string } | null
  organization: OrgRef | null
  monitor: { id: string; status: Status | null }
  metrics: Record<string, { value: number | null; level: string | null }>
}

interface ClusterRow {
  id: string
  name: string
  state_level: string
  state_at: string | null
  last_report_at: string | null
  is_enabled: boolean
  nodes: { total: number; online: number }
  stats: Record<string, number | null>
  project: { id: string; name: string | null } | null
  organization: OrgRef | null
}

interface IncidentRow {
  id: string
  status: string
  cause: string
  started_at: string
  resolved_at: string | null
  duration_seconds: number | null
  failure_count: number
  monitor: { id: string; name: string; target: string; type: string; project: string | null }
  organization: OrgRef | null
}

interface UsageRow {
  organization: OrgRef | null
  channel: string
  count: number
  period: string
  updated_at: string
}

const TABS = [
  { key: "overview", label: "کلیات", icon: Gauge },
  { key: "projects", label: "پروژه‌ها", icon: Globe },
  { key: "monitors", label: "مانیتورها", icon: Activity },
  { key: "servers", label: "سرورها", icon: Server },
  { key: "clusters", label: "کلاسترها", icon: Boxes },
  { key: "incidents", label: "Incidentها", icon: AlertTriangle },
  { key: "plans", label: "پلن‌ها و مصرف", icon: TrendingUp },
] as const

type TabKey = (typeof TABS)[number]["key"]

const STATUS_STYLES: Record<string, string> = {
  up: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400",
  degraded: "bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-400",
  down: "bg-rose-500/10 text-rose-600 ring-rose-500/20 dark:text-rose-400",
  paused: "bg-slate-500/10 text-slate-600 ring-slate-500/20 dark:text-slate-400",
  pending: "bg-sky-500/10 text-sky-600 ring-sky-500/20 dark:text-sky-400",
  unknown: "bg-slate-500/10 text-slate-600 ring-slate-500/20 dark:text-slate-400",
  ok: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400",
  warn: "bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-400",
  critical: "bg-rose-500/10 text-rose-600 ring-rose-500/20 dark:text-rose-400",
}

const STATUS_LABELS: Record<string, string> = {
  up: "بالا",
  degraded: "هشدار",
  down: "قطع",
  paused: "متوقف",
  pending: "در انتظار",
  unknown: "نامعلوم",
  ok: "سالم",
  warn: "هشدار",
  critical: "بحرانی",
  open: "باز",
  resolved: "بسته",
}

const CHANNEL_LABELS: Record<string, string> = {
  sms: "پیامک",
  bale: "بله",
  email: "ایمیل",
}

const CHECK_LABELS: Record<string, string> = {
  ping: "پینگ",
  http: "HTTP",
  ssl: "SSL",
  keyword: "کلمهٔ کلیدی",
  port: "پورت",
  cpu: "CPU",
  ram: "RAM",
  disk: "دیسک",
  swap: "سواپ",
  all: "همه",
  agent: "ایجنت",
}

function StatusPill({ value }: { value: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        STATUS_STYLES[value] ?? STATUS_STYLES.unknown,
      )}
    >
      <CircleDot className="h-3 w-3" />
      {STATUS_LABELS[value] ?? value}
    </span>
  )
}

function number(value: number | null | undefined, digits = 0) {
  if (value === null || value === undefined) return "—"
  return value.toLocaleString("fa-IR", { maximumFractionDigits: digits })
}

function percent(value: number | null | undefined) {
  if (value === null || value === undefined) return "—"
  return `${value.toFixed(1)}%`
}

function money(value: number | null | undefined) {
  if (!value) return "—"
  return `${value.toLocaleString("fa-IR")} تومان`
}

function relative(iso: string | null | undefined) {
  if (!iso) return "—"
  const then = new Date(iso).getTime()
  const diff = Math.round((Date.now() - then) / 1000)
  if (Number.isNaN(diff)) return "—"
  if (diff < 0) return "لحظه‌ای پیش"
  if (diff < 60) return `${number(diff)} ثانیه پیش`
  if (diff < 3600) return `${number(Math.floor(diff / 60))} دقیقه پیش`
  if (diff < 86400) return `${number(Math.floor(diff / 3600))} ساعت پیش`
  return `${number(Math.floor(diff / 86400))} روز پیش`
}

function duration(seconds: number | null | undefined) {
  if (!seconds) return "—"
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h) return `${number(h)} ساعت و ${number(m)} دقیقه`
  return `${number(m)} دقیقه`
}

const CACHE_TTL_MS = 30_000

export default function DidbanPanelPage() {
  const [tab, setTab] = useState<TabKey>("overview")
  const [overview, setOverview] = useState<Overview | null>(null)
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [monitors, setMonitors] = useState<MonitorRow[]>([])
  const [servers, setServers] = useState<ServerRow[]>([])
  const [clusters, setClusters] = useState<ClusterRow[]>([])
  const [incidents, setIncidents] = useState<IncidentRow[]>([])
  const [usage, setUsage] = useState<UsageRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [loadedAt, setLoadedAt] = useState<Record<string, number>>({})

  const load = useCallback(
    async (key: TabKey, force = false) => {
      const fresh = Date.now() - (loadedAt[key] ?? 0) < CACHE_TTL_MS
      if (fresh && !force) return
      setLoading(true)
      setError(null)
      try {
        if (key === "overview" || key === "plans") {
          const { data } = await api.get<Overview>("/staff/didban/overview/")
          setOverview(data)
          if (key === "plans") {
            const usageResp = await api.get<{ results: UsageRow[] }>("/staff/didban/usage/")
            setUsage(usageResp.data.results)
          }
        }
        if (key === "projects") {
          const { data } = await api.get<{ results: ProjectRow[] }>(
            "/staff/didban/projects/",
            { params: query ? { q: query } : undefined },
          )
          setProjects(data.results)
        }
        if (key === "monitors") {
          const { data } = await api.get<{ results: MonitorRow[] }>(
            "/staff/didban/monitors/",
            { params: { ...(query ? { q: query } : {}), ...(statusFilter ? { status: statusFilter } : {}) } },
          )
          setMonitors(data.results)
        }
        if (key === "servers") {
          const { data } = await api.get<{ results: ServerRow[] }>("/staff/didban/servers/", {
            params: query ? { q: query } : undefined,
          })
          setServers(data.results)
        }
        if (key === "clusters") {
          const { data } = await api.get<{ results: ClusterRow[] }>("/staff/didban/clusters/", {
            params: query ? { q: query } : undefined,
          })
          setClusters(data.results)
        }
        if (key === "incidents") {
          const { data } = await api.get<{ results: IncidentRow[] }>(
            "/staff/didban/incidents/",
            { params: { status: statusFilter || "open" } },
          )
          setIncidents(data.results)
        }
        setLoadedAt((current) => ({ ...current, [key]: Date.now() }))
      } catch {
        setError("دریافت داده‌های دیدبان انجام نشد. دسترسی یا اتصال به سرور را بررسی کنید.")
      } finally {
        setLoading(false)
      }
    },
    [loadedAt, query, statusFilter],
  )

  useEffect(() => {
    void load(tab)
  }, [tab, load])

  const search = () => {
    void load(tab, true)
  }

  const stats = useMemo(() => {
    if (!overview) return []
    return [
      {
        label: "مانیتور فعال",
        value: number(overview.monitors.enabled),
        hint: `از ${number(overview.monitors.total)} مانیتور`,
        tone: "text-sky-600 dark:text-sky-400",
        icon: Activity,
      },
      {
        label: "قطع",
        value: number(overview.monitors.down),
        hint: `${number(overview.incidents.open)} Incident باز`,
        tone: "text-rose-600 dark:text-rose-400",
        icon: AlertTriangle,
      },
      {
        label: "هشدار (SSL/آستانه)",
        value: number(overview.monitors.degraded),
        hint: "سرویس بالاست",
        tone: "text-amber-600 dark:text-amber-400",
        icon: ShieldCheck,
      },
      {
        label: "سرور (ایجنت)",
        value: `${number(overview.servers.online)} / ${number(overview.servers.total)}`,
        hint: "آنلاین / کل",
        tone: "text-emerald-600 dark:text-emerald-400",
        icon: Server,
      },
      {
        label: "کلاستر",
        value: number(overview.clusters.total),
        hint: `${number(overview.clusters.critical)} بحرانی · ${number(overview.clusters.warn)} هشدار`,
        tone: "text-violet-600 dark:text-violet-400",
        icon: Boxes,
      },
      {
        label: "پیام این ماه",
        value: `${number(overview.notifications.sms)} / ${number(overview.notifications.bale)}`,
        hint: "پیامک / بله",
        tone: "text-slate-600 dark:text-slate-300",
        icon: Cpu,
      },
    ]
  }, [overview])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <Gauge className="h-5 w-5 text-sky-500" />
            دیدبان
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            نمای کامل همهٔ سازمان‌ها: پروژه‌ها، مانیتورها، سرورها، کلاسترها، Incidentها و مصرف پیام
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load(tab, true)} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ms-2">به‌روزرسانی</span>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setTab(item.key)
                setQuery("")
                setStatusFilter("")
              }}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition",
                tab === item.key
                  ? "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300"
                  : "border-border bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          )
        })}
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {(tab === "projects" || tab === "monitors" || tab === "servers" || tab === "clusters") && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute start-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") search()
              }}
              placeholder="جست‌وجو: نام، دامنه، سازمان…"
              className="w-72 ps-8"
            />
          </div>
          {tab === "monitors" && (
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value)
                setTimeout(() => void load("monitors", true), 0)
              }}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">همهٔ وضعیت‌ها</option>
              <option value="up">بالا</option>
              <option value="degraded">هشدار</option>
              <option value="down">قطع</option>
              <option value="paused">متوقف</option>
            </select>
          )}
          <Button size="sm" onClick={search} disabled={loading}>
            جست‌وجو
          </Button>
        </div>
      )}

      {tab === "overview" && overview && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {stats.map((item) => {
              const Icon = item.icon
              return (
                <div key={item.label} className="rounded-xl border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                    <Icon className={cn("h-4 w-4", item.tone)} />
                  </div>
                  <div className={cn("mt-2 text-2xl font-semibold", item.tone)}>{item.value}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{item.hint}</div>
                </div>
              )
            })}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border bg-card p-4">
              <h2 className="mb-3 text-sm font-semibold">ترکیب پلن‌ها</h2>
              {overview.plan_mix.length === 0 ? (
                <p className="text-sm text-muted-foreground">اشتراک فعالی ثبت نشده است.</p>
              ) : (
                <ul className="space-y-2">
                  {overview.plan_mix.map((row) => (
                    <li key={row.slug} className="flex items-center justify-between text-sm">
                      <span>{row.name}</span>
                      <span className="text-muted-foreground">{number(row.total)} پروژه</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-xl border bg-card p-4">
              <h2 className="mb-3 text-sm font-semibold">سازمان‌های پرمانیتور</h2>
              {overview.top_organizations.length === 0 ? (
                <p className="text-sm text-muted-foreground">داده‌ای نیست.</p>
              ) : (
                <ul className="space-y-2">
                  {overview.top_organizations.map((row) => (
                    <li key={row.id} className="flex items-center justify-between text-sm">
                      <span>{row.name ?? `سازمان ${row.id}`}</span>
                      <span className="text-muted-foreground">{number(row.monitors)} مانیتور</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            آخرین به‌روزرسانی: {relative(overview.refreshed_at)}
          </p>
        </>
      )}

      {tab === "projects" && (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="p-2 text-start">پروژه</th>
                <th className="p-2 text-start">سازمان</th>
                <th className="p-2 text-start">پلن</th>
                <th className="p-2 text-start">مانیتور</th>
                <th className="p-2 text-start">سرور</th>
                <th className="p-2 text-start">وضعیت اشتراک</th>
                <th className="p-2 text-start">ایجاد</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="p-2">
                    <div className="font-medium">{row.name}</div>
                    <div className="text-xs text-muted-foreground" dir="ltr">
                      {row.slug}
                    </div>
                  </td>
                  <td className="p-2">
                    <div>{row.organization?.name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground" dir="ltr">
                      {row.owner_mobile ?? "—"}
                    </div>
                  </td>
                  <td className="p-2">{row.plan ?? "—"}</td>
                  <td className="p-2">{number(row.monitors)}</td>
                  <td className="p-2">{number(row.servers)}</td>
                  <td className="p-2">{row.subscription_status ?? "—"}</td>
                  <td className="p-2 text-xs text-muted-foreground">{relative(row.created_at)}</td>
                </tr>
              ))}
              {projects.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-sm text-muted-foreground">
                    پروژه‌ای یافت نشد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "monitors" && (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="p-2 text-start">مانیتور</th>
                <th className="p-2 text-start">سازمان / پروژه</th>
                <th className="p-2 text-start">بررسی‌ها</th>
                <th className="p-2 text-start">وضعیت</th>
                <th className="p-2 text-start">بازه</th>
                <th className="p-2 text-start">آخرین بررسی</th>
              </tr>
            </thead>
            <tbody>
              {monitors.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="p-2">
                    <div className="font-medium">{row.name}</div>
                    <div className="text-xs text-muted-foreground" dir="ltr">
                      {row.target}
                    </div>
                  </td>
                  <td className="p-2">
                    <div>{row.organization?.name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{row.project?.name ?? "—"}</div>
                  </td>
                  <td className="p-2 text-xs">
                    {(row.checks?.length ? row.checks : [row.type])
                      .map((check) => CHECK_LABELS[check] ?? check)
                      .join(" · ")}
                  </td>
                  <td className="p-2">
                    <StatusPill value={row.status} />
                    {row.last_error_code && (
                      <div className="mt-1 text-xs text-muted-foreground" dir="ltr">
                        {row.last_error_code}
                      </div>
                    )}
                  </td>
                  <td className="p-2 text-xs">{number(row.interval_seconds)}s</td>
                  <td className="p-2 text-xs text-muted-foreground">
                    {relative(row.last_checked_at)}
                    {row.last_latency_ms ? ` · ${number(row.last_latency_ms)}ms` : ""}
                  </td>
                </tr>
              ))}
              {monitors.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-sm text-muted-foreground">
                    مانیتوری یافت نشد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "servers" && (
        <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {servers.map((row) => (
            <div key={row.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 font-medium">
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        row.is_online ? "bg-emerald-500" : "bg-rose-500",
                      )}
                    />
                    {row.name}
                  </div>
                  <div className="text-xs text-muted-foreground" dir="ltr">
                    {row.hostname} · {row.os || "—"} · v{row.agent_version || "?"}
                  </div>
                </div>
                <StatusPill value={row.monitor.status ?? "unknown"} />
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                {Object.entries(row.metrics).map(([metric, data]) => (
                  <div key={metric} className="rounded-lg bg-muted/50 p-2">
                    <div className="text-[11px] text-muted-foreground">
                      {CHECK_LABELS[metric] ?? metric}
                    </div>
                    <div
                      className={cn(
                        "text-sm font-semibold",
                        data.level === "critical"
                          ? "text-rose-600 dark:text-rose-400"
                          : data.level === "warn"
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-emerald-600 dark:text-emerald-400",
                      )}
                    >
                      {percent(data.value)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{row.organization?.name ?? "—"}</span>
                <span dir="ltr">{row.last_ip ?? "—"}</span>
                <span>گزارش: {relative(row.last_report_at)}</span>
              </div>
            </div>
          ))}
          {servers.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground">سروری ثبت نشده است.</p>
          )}
        </div>
      )}

      {tab === "clusters" && (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="p-2 text-start">کلاستر</th>
                <th className="p-2 text-start">سازمان</th>
                <th className="p-2 text-start">سلامت</th>
                <th className="p-2 text-start">نودها</th>
                <th className="p-2 text-start">پادها</th>
                <th className="p-2 text-start">دیپلوی‌منت</th>
                <th className="p-2 text-start">آخرین گزارش</th>
              </tr>
            </thead>
            <tbody>
              {clusters.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="p-2 font-medium">{row.name}</td>
                  <td className="p-2">{row.organization?.name ?? "—"}</td>
                  <td className="p-2">
                    <StatusPill value={row.state_level} />
                  </td>
                  <td className="p-2 text-xs">
                    {number(row.stats.nodes_ready)} / {number(row.stats.nodes_total)} آماده
                    <div className="text-muted-foreground">
                      {number(row.nodes.online)} / {number(row.nodes.total)} ایجنت آنلاین
                    </div>
                  </td>
                  <td className="p-2 text-xs">
                    {number(row.stats.pods_running)} / {number(row.stats.pods_total)}
                    {row.stats.pods_failed ? (
                      <span className="ms-1 text-rose-600 dark:text-rose-400">
                        ({number(row.stats.pods_failed)} ناموفق)
                      </span>
                    ) : null}
                  </td>
                  <td className="p-2 text-xs">
                    {number(row.stats.deployments_total)}
                    {row.stats.deployments_unavailable ? (
                      <span className="ms-1 text-amber-600 dark:text-amber-400">
                        ({number(row.stats.deployments_unavailable)} ناقص)
                      </span>
                    ) : null}
                  </td>
                  <td className="p-2 text-xs text-muted-foreground">{relative(row.last_report_at)}</td>
                </tr>
              ))}
              {clusters.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-sm text-muted-foreground">
                    کلاستری ثبت نشده است.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "incidents" && (
        <>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter || "open"}
              onChange={(event) => {
                setStatusFilter(event.target.value)
                setTimeout(() => void load("incidents", true), 0)
              }}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="open">باز</option>
              <option value="resolved">بسته</option>
              <option value="">همه</option>
            </select>
          </div>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="p-2 text-start">مانیتور</th>
                  <th className="p-2 text-start">سازمان</th>
                  <th className="p-2 text-start">علت</th>
                  <th className="p-2 text-start">وضعیت</th>
                  <th className="p-2 text-start">شروع</th>
                  <th className="p-2 text-start">مدت</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="p-2">
                      <div className="font-medium">{row.monitor.name}</div>
                      <div className="text-xs text-muted-foreground" dir="ltr">
                        {row.monitor.target}
                      </div>
                    </td>
                    <td className="p-2">{row.organization?.name ?? "—"}</td>
                    <td className="p-2 text-xs" dir="ltr">
                      {row.cause}
                    </td>
                    <td className="p-2">
                      <StatusPill value={row.status} />
                    </td>
                    <td className="p-2 text-xs text-muted-foreground">{relative(row.started_at)}</td>
                    <td className="p-2 text-xs">{duration(row.duration_seconds)}</td>
                  </tr>
                ))}
                {incidents.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-sm text-muted-foreground">
                      Incidentی یافت نشد.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "plans" && overview && (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="p-2 text-start">پلن</th>
                  <th className="p-2 text-start">ماهانه</th>
                  <th className="p-2 text-start">سالانه</th>
                  <th className="p-2 text-start">مانیتور</th>
                  <th className="p-2 text-start">بازه</th>
                  <th className="p-2 text-start">مقصد پیامک</th>
                  <th className="p-2 text-start">سقف پیام ماهانه</th>
                </tr>
              </thead>
              <tbody>
                {overview.plans.map((plan) => (
                  <tr key={plan.slug} className="border-t">
                    <td className="p-2 font-medium">
                      {plan.name}
                      {!plan.is_active && (
                        <span className="ms-1 text-xs text-muted-foreground">(غیرفعال)</span>
                      )}
                    </td>
                    <td className="p-2">{money(plan.price_monthly)}</td>
                    <td className="p-2">{money(plan.price_yearly)}</td>
                    <td className="p-2">{number(plan.max_monitors)}</td>
                    <td className="p-2 text-xs">{number(plan.min_interval_seconds)}s</td>
                    <td className="p-2">{number(plan.max_sms_recipients)}</td>
                    <td className="p-2 text-xs">
                      {number(plan.max_sms_messages_monthly)} پیامک ·{" "}
                      {number(plan.max_bale_messages_monthly)} بله
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold">
              مصرف پیام این ماه ({overview.notifications.period})
            </h2>
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="p-2 text-start">سازمان</th>
                    <th className="p-2 text-start">کانال</th>
                    <th className="p-2 text-start">تعداد</th>
                    <th className="p-2 text-start">آخرین به‌روزرسانی</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.map((row, index) => (
                    <tr key={`${row.organization?.id}-${row.channel}-${index}`} className="border-t">
                      <td className="p-2">{row.organization?.name ?? "—"}</td>
                      <td className="p-2">{CHANNEL_LABELS[row.channel] ?? row.channel}</td>
                      <td className="p-2">{number(row.count)}</td>
                      <td className="p-2 text-xs text-muted-foreground">
                        {relative(row.updated_at)}
                      </td>
                    </tr>
                  ))}
                  {usage.length === 0 && !loading && (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-sm text-muted-foreground">
                        در این ماه پیامی مصرف نشده است.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> در حال دریافت…
        </div>
      )}
    </div>
  )
}
