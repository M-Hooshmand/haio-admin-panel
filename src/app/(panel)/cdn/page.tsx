"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  CloudCog,
  Cpu,
  Database,
  DollarSign,
  Globe2,
  Loader2,
  Network,
  ReceiptText,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Signal,
  TriangleAlert,
  Users,
  Wallet,
  X,
} from "lucide-react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatJalali, formatJalaliShort } from "@/lib/jalali"
import { cn } from "@/lib/utils"
import {
  HBarList,
  TimeSeriesChart,
  faDay,
  faNum,
  faToman,
} from "@/components/dashboard-charts"

// ---------------------------------------------------------------------------
// API shapes
// ---------------------------------------------------------------------------

interface SummaryPlan {
  id: string
  name: string
  slug: string
  description: string
  tier: string
  tier_display: string
  price_monthly: number
  price_is_starting: boolean
  max_domains: number
  max_records: number | null
  unlimited_records: boolean
  traffic_gb_month: number | null
  traffic_bytes_month: number | null
  features: Record<string, unknown>
  fair_use_policy: string
  is_custom_quote: boolean
  cdn_enabled: boolean
  dns_management: boolean
  is_free: boolean
  is_active: boolean
  sort_order: number
  subscribers?: number
  active_subscribers?: number
  mrr?: number
}

interface Subscription {
  id: string
  organization: number
  organization_name: string
  organization_slug?: string
  owner_email?: string
  plan: SummaryPlan
  plan_name: string
  plan_slug: string
  status: string
  status_display: string
  billing_mode: string
  billing_mode_display: string
  started_at: string | null
  current_period_start: string | null
  current_period_end: string | null
  next_billing_date: string | null
  grace_until: string | null
  canceled_at: string | null
  auto_renew: boolean
  domain_count: number
  max_records: number | null
  traffic_used_bytes: number
  traffic_limit_bytes: number | null
  usage_percent: number | null
  traffic_overage_allowed: boolean
  price_monthly?: number
  monthly_value?: number
  created_at: string
  updated_at: string
}

interface Domain {
  id: string
  organization: number
  organization_name: string
  subscription: string | null
  plan_name: string | null
  plan_slug: string | null
  subscription_status: string | null
  name: string
  external_domain_id: string | null
  origin_ip: string | null
  origin_protocol: string
  cdn_type: string
  cdn_type_display: string
  status: string
  status_display: string
  ns_configured: boolean
  ownership_verified: boolean
  ssl_status: string
  ssl_expires_at?: string | null
  deployed_at: string | null
  last_synced_at: string | null
  last_error: string
  is_legacy: boolean
  records_count: number
  snapshots_count: number
  nameservers: string[]
  created_at: string
  updated_at: string
}

interface Invoice {
  id: string
  reference: string
  organization: string
  amount: number
  credit_applied: number
  status: string
  kind: string
  description: string
  due_date: string | null
  paid_at: string | null
  fulfilled_at: string | null
  subscription: string | null
  domain: string | null
  created_at: string
}

interface Node {
  id: string
  name: string
  slug: string
  external_node_id: number | null
  role: string
  role_display: string
  region: string
  ip: string | null
  is_active: boolean
  health_status: string
  nginx_status: string
  pdns_status: string
  last_check_at: string | null
  created_at: string
  updated_at: string
}

interface Summary {
  generated_at: string
  range: { days: number; start: string; end: string }
  subscriptions: {
    total: number
    active: number
    pending_payment: number
    suspended: number
    canceled: number
    expired: number
    trialing: number
    past_due: number
    mrr: number
    arr: number
    new_in_range: number
    churned_in_range: number
    by_status: { key: string; label: string; count: number }[]
  }
  domains: {
    total: number
    active: number
    errors: number
    records: number
    ssl_active: number
    ns_configured: number
    by_status: { key: string; count: number }[]
    by_type: { key: string; count: number }[]
  }
  traffic: {
    bytes: number
    requests: number
    cache_hits: number
    cache_misses: number
    hit_ratio: number
    errors_4xx: number
    errors_5xx: number
    daily: { date: string; bytes: number; requests: number; cache_hits: number; cache_misses: number }[]
  }
  revenue: {
    paid_count: number
    paid_amount: number
    credit_applied: number
    by_status: { key: string; label: string; count: number; amount: number }[]
    by_kind: { key: string; label: string; count: number; amount: number }[]
    daily: { date: string; amount: number }[]
    monthly: { month: string; amount: number; count: number }[]
  }
  plans: SummaryPlan[]
  top_customers: Subscription[]
  recent_invoices: Invoice[]
  recent_subscriptions: Subscription[]
  nodes: Node[]
}

interface DomainDetail {
  domain: Domain
  records: {
    id: string
    name: string
    type: string
    value: string
    ttl: number
    tag: string
    tag_display: string
    proxied: boolean
    enabled: boolean
    region: string
  }[]
  traffic: {
    date: string
    requests: number
    bytes: number
    cache_hits: number
    cache_misses: number
    status_4xx: number
    status_5xx: number
  }[]
  snapshots: {
    id: string
    status: string
    status_display: string
    source_url: string
    size_bytes: number
    page_count: number
    created_at: string
  }[]
  cache_stats: {
    id: string
    collected_at: string
    hits: number
    misses: number
    hit_ratio: number
    bytes_served: number
  }[]
}

interface SubscriptionDetail {
  matched: string
  organizations: { id: string; slug: string; name: string; owner_email: string }[]
  subscriptions: Subscription[]
  domains: Domain[]
  invoices: Invoice[]
  nodes: Node[]
}

// ---------------------------------------------------------------------------
// formatting helpers
// ---------------------------------------------------------------------------

const RANGES = [7, 30, 90, 365]

function faBytes(value: number | null | undefined): string {
  const n = Number(value || 0)
  if (n <= 0) return "۰"
  const units = ["بایت", "کیلوبایت", "مگابایت", "گیگابایت", "ترابایت"]
  let index = 0
  let size = n
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024
    index += 1
  }
  const digits = size >= 100 ? 0 : size >= 10 ? 1 : 2
  return `${new Intl.NumberFormat("fa-IR", { maximumFractionDigits: digits }).format(size)} ${units[index]}`
}

const STATUS_TONES: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  paid: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  trialing: "bg-sky-50 text-sky-700 ring-sky-200",
  pending_payment: "bg-amber-50 text-amber-700 ring-amber-200",
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  pending_ns: "bg-amber-50 text-amber-700 ring-amber-200",
  deploying: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  suspended: "bg-rose-50 text-rose-700 ring-rose-200",
  past_due: "bg-rose-50 text-rose-700 ring-rose-200",
  expired: "bg-slate-100 text-slate-600 ring-slate-200",
  canceled: "bg-slate-100 text-slate-600 ring-slate-200",
  refunded: "bg-slate-100 text-slate-600 ring-slate-200",
  error: "bg-rose-50 text-rose-700 ring-rose-200",
  ok: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  unknown: "bg-slate-100 text-slate-600 ring-slate-200",
}

const STATUS_LABELS: Record<string, string> = {
  active: "فعال",
  trialing: "آزمایشی",
  pending_payment: "در انتظار پرداخت",
  pending: "در انتظار",
  pending_ns: "در انتظار NS",
  deploying: "در حال استقرار",
  suspended: "معلق",
  past_due: "معوق",
  expired: "منقضی",
  canceled: "لغو‌شده",
  refunded: "بازگشت وجه",
  paid: "پرداخت‌شده",
  error: "خطا",
  deleted: "حذف‌شده",
  ok: "سالم",
  unknown: "نامشخص",
}

function statusLabel(key: string): string {
  return STATUS_LABELS[key] ?? key
}

function Badge({ status, label }: { status: string; label?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        STATUS_TONES[status] ?? "bg-slate-100 text-slate-600 ring-slate-200"
      )}
    >
      {label ?? statusLabel(status)}
    </span>
  )
}

function Stat({
  label,
  value,
  hint,
  icon: Icon,
  tone = "text-slate-900",
}: {
  label: string
  value: string
  hint?: string
  icon: React.ComponentType<{ className?: string }>
  tone?: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <Icon className="h-4 w-4 text-slate-300" />
      </div>
      <p className={cn("mt-2 text-xl font-bold tracking-tight", tone)}>{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-slate-400">{hint}</p> : null}
    </div>
  )
}

function Panel({
  title,
  subtitle,
  icon: Icon,
  action,
  children,
  className,
}: {
  title: string
  subtitle?: string
  icon?: React.ComponentType<{ className?: string }>
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn("rounded-2xl border border-slate-200 bg-white p-4 shadow-sm", className)}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            {Icon ? <Icon className="h-4 w-4 text-indigo-500" /> : null}
            {title}
          </h3>
          {subtitle ? <p className="mt-0.5 text-[11px] text-slate-400">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="py-8 text-center text-xs text-slate-400">{text}</p>
}

function UsageBar({ percent }: { percent: number | null }) {
  if (percent === null || percent === undefined) {
    return <span className="text-[11px] text-slate-400">—</span>
  }
  const clamped = Math.max(0, Math.min(100, percent))
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn(
            "h-full rounded-full",
            clamped >= 90 ? "bg-rose-500" : clamped >= 70 ? "bg-amber-500" : "bg-emerald-500"
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="text-[11px] text-slate-500">{faNum(clamped)}٪</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// page
// ---------------------------------------------------------------------------

type TabKey = "overview" | "subscriptions" | "domains" | "invoices" | "plans" | "nodes"

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "overview", label: "نمای کلی", icon: Activity },
  { key: "subscriptions", label: "اشتراک‌ها", icon: Wallet },
  { key: "domains", label: "دامنه‌ها", icon: Globe2 },
  { key: "invoices", label: "فاکتورها", icon: ReceiptText },
  { key: "plans", label: "پلن‌ها", icon: Database },
  { key: "nodes", label: "نودها", icon: Server },
]

export default function CDNPage() {
  const [tab, setTab] = useState<TabKey>("overview")
  const [days, setDays] = useState(30)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [refreshing, setRefreshing] = useState(false)

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [subscriptionsCount, setSubscriptionsCount] = useState(0)
  const [subStatus, setSubStatus] = useState("")
  const [subSearch, setSubSearch] = useState("")
  const [subLoading, setSubLoading] = useState(false)

  const [domains, setDomains] = useState<Domain[]>([])
  const [domainsCount, setDomainsCount] = useState(0)
  const [domainStatus, setDomainStatus] = useState("")
  const [domainSearch, setDomainSearch] = useState("")
  const [domainsLoading, setDomainsLoading] = useState(false)

  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [invoiceStatus, setInvoiceStatus] = useState("")
  const [invoiceKind, setInvoiceKind] = useState("")
  const [invoicesLoading, setInvoicesLoading] = useState(false)

  const [plans, setPlans] = useState<SummaryPlan[]>([])
  const [nodes, setNodes] = useState<Node[]>([])

  const [detail, setDetail] = useState<SubscriptionDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [domainDetail, setDomainDetail] = useState<DomainDetail | null>(null)
  const [domainDetailLoading, setDomainDetailLoading] = useState(false)

  const loadSummary = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    setError("")
    try {
      const { data } = await api.get<Summary>("/staff/cdn/summary/", { params: { days } })
      setSummary(data)
      setPlans(data.plans)
      setNodes(data.nodes)
    } catch (err) {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "دریافت اطلاعات CDN ناموفق بود."
      setError(message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [days])

  useEffect(() => {
    void loadSummary()
  }, [loadSummary])

  const loadSubscriptions = useCallback(async () => {
    setSubLoading(true)
    try {
      const { data } = await api.get<{ count: number; results: Subscription[] }>(
        "/staff/cdn/subscriptions/",
        { params: { status: subStatus || undefined, search: subSearch || undefined, limit: 200 } }
      )
      setSubscriptions(data.results)
      setSubscriptionsCount(data.count)
    } catch {
      setSubscriptions([])
      setSubscriptionsCount(0)
    } finally {
      setSubLoading(false)
    }
  }, [subStatus, subSearch])

  useEffect(() => {
    if (tab === "subscriptions") void loadSubscriptions()
  }, [tab, loadSubscriptions])

  const loadDomains = useCallback(async () => {
    setDomainsLoading(true)
    try {
      const { data } = await api.get<{ count: number; results: Domain[] }>("/staff/cdn/domains/", {
        params: { status: domainStatus || undefined, search: domainSearch || undefined, limit: 200 },
      })
      setDomains(data.results)
      setDomainsCount(data.count)
    } catch {
      setDomains([])
      setDomainsCount(0)
    } finally {
      setDomainsLoading(false)
    }
  }, [domainStatus, domainSearch])

  useEffect(() => {
    if (tab === "domains") void loadDomains()
  }, [tab, loadDomains])

  const loadInvoices = useCallback(async () => {
    setInvoicesLoading(true)
    try {
      const { data } = await api.get<{ count: number; results: Invoice[] }>("/staff/cdn/invoices/", {
        params: {
          status: invoiceStatus || undefined,
          kind: invoiceKind || undefined,
          days: 3650,
          limit: 300,
        },
      })
      setInvoices(data.results)
    } catch {
      setInvoices([])
    } finally {
      setInvoicesLoading(false)
    }
  }, [invoiceStatus, invoiceKind])

  useEffect(() => {
    if (tab === "invoices") void loadInvoices()
  }, [tab, loadInvoices])

  useEffect(() => {
    if (tab === "plans" && !plans.length) {
      api
        .get<{ results: SummaryPlan[] }>("/staff/cdn/plans/")
        .then(({ data }) => setPlans(data.results))
        .catch(() => undefined)
    }
    if (tab === "nodes" && !nodes.length) {
      api
        .get<{ results: Node[] }>("/staff/cdn/nodes/")
        .then(({ data }) => setNodes(data.results))
        .catch(() => undefined)
    }
  }, [tab, plans.length, nodes.length])

  const openSubscription = async (id: string) => {
    setDetailLoading(true)
    setDetail(null)
    try {
      const { data } = await api.get<SubscriptionDetail>("/staff/cdn/overview/", {
        params: { identifier: id },
      })
      setDetail(data)
    } catch {
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  const openDomain = async (id: string) => {
    setDomainDetailLoading(true)
    setDomainDetail(null)
    try {
      const { data } = await api.get<DomainDetail>(`/staff/cdn/domains/${id}/`)
      setDomainDetail(data)
    } catch {
      setDomainDetail(null)
    } finally {
      setDomainDetailLoading(false)
    }
  }

  const revenueSeries = useMemo(() => {
    const rows = summary?.revenue.daily ?? []
    return {
      labels: rows.map((row) => faDay(row.date)),
      series: [
        {
          key: "revenue",
          label: "درآمد CDN",
          color: "#ec4899",
          values: rows.map((row) => row.amount),
          type: "area" as const,
        },
      ],
    }
  }, [summary])

  const trafficSeries = useMemo(() => {
    const rows = summary?.traffic.daily ?? []
    return {
      labels: rows.map((row) => faDay(row.date)),
      series: [
        {
          key: "bytes",
          label: "ترافیک",
          color: "#6366f1",
          values: rows.map((row) => row.bytes),
          type: "area" as const,
        },
      ],
    }
  }, [summary])

  const planDistribution = useMemo(
    () =>
      (summary?.plans ?? [])
        .filter((plan) => (plan.subscribers ?? 0) > 0)
        .map((plan) => ({
          key: plan.slug,
          label: plan.name,
          value: plan.subscribers ?? 0,
          hint: `${faNum(plan.active_subscribers ?? 0)} فعال · ${faToman(plan.price_monthly)} ماهانه`,
        })),
    [summary]
  )

  const domainStatusRows = useMemo(
    () =>
      (summary?.domains.by_status ?? []).map((row) => ({
        key: row.key,
        label: statusLabel(row.key),
        value: row.count,
      })),
    [summary]
  )

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 lg:p-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <CloudCog className="h-6 w-6 text-pink-500" />
            CDN
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            اشتراک‌ها، دامنه‌ها، درآمد، ترافیک، پلن‌ها و نودهای لبه — همه در یک تب.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white text-xs">
            {RANGES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setDays(value)}
                className={cn(
                  "px-3 py-1.5 transition-colors",
                  days === value
                    ? "bg-indigo-500 text-white"
                    : "text-slate-600 hover:bg-slate-50"
                )}
              >
                {value === 365 ? "۱ سال" : `${faNum(value)} روز`}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadSummary(true)}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            </Button>
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          <TriangleAlert className="h-4 w-4" />
          {error}
        </div>
      ) : null}

      {loading && !summary ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
        </div>
      ) : summary ? (
        <>
          {/* KPI grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <Stat
              label="درآمد ماهانه (MRR)"
              value={faToman(summary.subscriptions.mrr)}
              hint={`سالانه ${faToman(summary.subscriptions.arr)}`}
              icon={DollarSign}
              tone="text-pink-600"
            />
            <Stat
              label="اشتراک فعال"
              value={faNum(summary.subscriptions.active)}
              hint={`از ${faNum(summary.subscriptions.total)} اشتراک · ${faNum(
                summary.subscriptions.pending_payment
              )} در انتظار پرداخت`}
              icon={Users}
              tone="text-emerald-600"
            />
            <Stat
              label={`درآمد ${faNum(summary.range.days)} روز`}
              value={faToman(summary.revenue.paid_amount)}
              hint={`${faNum(summary.revenue.paid_count)} فاکتور پرداخت‌شده`}
              icon={ReceiptText}
              tone="text-indigo-600"
            />
            <Stat
              label="دامنه‌ها"
              value={faNum(summary.domains.total)}
              hint={`${faNum(summary.domains.active)} فعال · ${faNum(
                summary.domains.records
              )} رکورد DNS`}
              icon={Globe2}
              tone="text-sky-600"
            />
            <Stat
              label={`ترافیک ${faNum(summary.range.days)} روز`}
              value={faBytes(summary.traffic.bytes)}
              hint={`${faNum(summary.traffic.requests)} درخواست · ${faNum(
                Math.round(summary.traffic.hit_ratio * 100)
              )}٪ کش`}
              icon={Signal}
              tone="text-violet-600"
            />
            <Stat
              label="سلامت نودها"
              value={`${faNum(
                summary.nodes.filter(
                  (node) => node.is_active && node.health_status === "ok"
                ).length
              )} / ${faNum(summary.nodes.length)}`}
              hint={summary.nodes.map((node) => node.name).join(" · ")}
              icon={Network}
              tone="text-emerald-600"
            />
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
            {TABS.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors",
                    tab === item.key
                      ? "bg-indigo-500 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              )
            })}
          </div>

          {tab === "overview" ? (
            <div className="space-y-4">
              <div className="grid gap-4 xl:grid-cols-2">
                <Panel
                  title="روند درآمد"
                  subtitle={`فاکتورهای پرداخت‌شده CDN در ${faNum(summary.range.days)} روز گذشته`}
                  icon={DollarSign}
                >
                  {revenueSeries.labels.length ? (
                    <TimeSeriesChart
                      labels={revenueSeries.labels}
                      series={revenueSeries.series}
                      formatValue={(value) => faToman(value)}
                    />
                  ) : (
                    <Empty text="در این بازه درآمدی ثبت نشده است." />
                  )}
                </Panel>
                <Panel
                  title="ترافیک و کش"
                  subtitle="حجم عبوری و نسبت کش موفق در بازه انتخاب‌شده"
                  icon={Signal}
                >
                  {trafficSeries.labels.length ? (
                    <TimeSeriesChart
                      labels={trafficSeries.labels}
                      series={trafficSeries.series}
                      formatValue={(value) => faBytes(value)}
                    />
                  ) : (
                    <Empty text="آمار ترافیکی در این بازه ثبت نشده است." />
                  )}
                  <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center text-[11px]">
                    <div>
                      <p className="text-slate-400">کش موفق</p>
                      <p className="font-bold text-slate-700">{faNum(summary.traffic.cache_hits)}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">نسبت کش</p>
                      <p className="font-bold text-slate-700">
                        {faNum(Math.round(summary.traffic.hit_ratio * 100))}٪
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">خطای ۵xx</p>
                      <p className="font-bold text-slate-700">{faNum(summary.traffic.errors_5xx)}</p>
                    </div>
                  </div>
                </Panel>
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                <Panel title="توزیع اشتراک‌ها روی پلن‌ها" icon={Database}>
                  <HBarList items={planDistribution} emptyLabel="هنوز اشتراکی ثبت نشده است." />
                </Panel>
                <Panel title="وضعیت دامنه‌ها" icon={Globe2}>
                  <HBarList items={domainStatusRows} emptyLabel="دامنه‌ای ثبت نشده است." />
                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-[11px]">
                    <span className="text-slate-500">
                      SSL فعال: <b className="text-slate-700">{faNum(summary.domains.ssl_active)}</b>
                    </span>
                    <span className="text-slate-500">
                      NS تنظیم‌شده: <b className="text-slate-700">{faNum(summary.domains.ns_configured)}</b>
                    </span>
                  </div>
                </Panel>
                <Panel title="درآمد به تفکیک نوع خرید" icon={Wallet}>
                  {summary.revenue.by_kind.length ? (
                    <HBarList
                      items={summary.revenue.by_kind.map((row) => ({
                        key: row.key,
                        label: row.label,
                        value: row.count,
                        hint: faToman(row.amount),
                      }))}
                    />
                  ) : (
                    <Empty text="در این بازه خریدی ثبت نشده است." />
                  )}
                </Panel>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <Panel title="مشتریان برتر" subtitle="اشتراک‌های فعال" icon={Users}>
                  {summary.top_customers.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-xs">
                        <thead className="text-slate-400">
                          <tr>
                            <th className="pb-2 font-medium">مشتری</th>
                            <th className="pb-2 font-medium">پلن</th>
                            <th className="pb-2 font-medium">دامنه</th>
                            <th className="pb-2 font-medium">مصرف ترافیک</th>
                            <th className="pb-2 font-medium">مبلغ ماهانه</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summary.top_customers.map((row) => (
                            <tr
                              key={row.id}
                              className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                              onClick={() => void openSubscription(row.id)}
                            >
                              <td className="py-2">
                                <p className="font-medium text-slate-700">{row.organization_name}</p>
                                <p className="text-[10px] text-slate-400">{row.owner_email || row.organization_slug}</p>
                              </td>
                              <td className="py-2">
                                <Badge status={row.status} label={row.plan_name} />
                              </td>
                              <td className="py-2 text-slate-600">{faNum(row.domain_count)}</td>
                              <td className="py-2"><UsageBar percent={row.usage_percent} /></td>
                              <td className="py-2 font-medium text-slate-700">
                                {faToman(row.price_monthly ?? row.plan.price_monthly)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Empty text="مشتری فعالی وجود ندارد." />
                  )}
                </Panel>

                <Panel title="آخرین فاکتورها" subtitle="همه وضعیت‌ها" icon={ReceiptText}>
                  {summary.recent_invoices.length ? (
                    <div className="space-y-2">
                      {summary.recent_invoices.slice(0, 6).map((invoice) => (
                        <div
                          key={invoice.id}
                          className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-slate-700">
                              {invoice.reference} · {invoice.organization}
                            </p>
                            <p className="truncate text-[10px] text-slate-400">
                              {invoice.description || invoice.kind}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="text-xs font-bold text-slate-700">{faToman(invoice.amount)}</span>
                            <Badge status={invoice.status} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty text="فاکتوری ثبت نشده است." />
                  )}
                </Panel>
              </div>
            </div>
          ) : null}

          {tab === "subscriptions" ? (
            <Panel
              title="اشتراک‌های CDN"
              subtitle={`${faNum(subscriptionsCount)} اشتراک · برای دیدن جزئیات روی هر ردیف کلیک کنید`}
              icon={Wallet}
              action={
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute right-2 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      value={subSearch}
                      onChange={(event) => setSubSearch(event.target.value)}
                      placeholder="سازمان، ایمیل یا پلن"
                      className="h-8 w-48 pr-7 text-xs"
                    />
                  </div>
                  <select
                    value={subStatus}
                    onChange={(event) => setSubStatus(event.target.value)}
                    className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-600"
                  >
                    <option value="">همه وضعیت‌ها</option>
                    <option value="active">فعال</option>
                    <option value="pending_payment">در انتظار پرداخت</option>
                    <option value="suspended">معلق</option>
                    <option value="canceled">لغو‌شده</option>
                    <option value="expired">منقضی</option>
                  </select>
                </div>
              }
            >
              {subLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
                </div>
              ) : subscriptions.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="text-slate-400">
                      <tr>
                        <th className="pb-2 font-medium">مشتری</th>
                        <th className="pb-2 font-medium">پلن</th>
                        <th className="pb-2 font-medium">وضعیت</th>
                        <th className="pb-2 font-medium">دامنه</th>
                        <th className="pb-2 font-medium">ترافیک</th>
                        <th className="pb-2 font-medium">دوره جاری</th>
                        <th className="pb-2 font-medium">تمدید بعدی</th>
                        <th className="pb-2 font-medium">مبلغ ماهانه</th>
                        <th className="pb-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {subscriptions.map((row) => (
                        <tr
                          key={row.id}
                          className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                          onClick={() => void openSubscription(row.id)}
                        >
                          <td className="py-2">
                            <p className="font-medium text-slate-700">{row.organization_name}</p>
                            <p className="text-[10px] text-slate-400">
                              {row.owner_email || row.organization_slug}
                            </p>
                          </td>
                          <td className="py-2 text-slate-600">{row.plan_name}</td>
                          <td className="py-2"><Badge status={row.status} /></td>
                          <td className="py-2 text-slate-600">
                            {faNum(row.domain_count)}
                            <span className="text-slate-400"> / {faNum(row.plan.max_domains)}</span>
                          </td>
                          <td className="py-2"><UsageBar percent={row.usage_percent} /></td>
                          <td className="py-2 text-slate-600">
                            {formatJalaliShort(row.current_period_start)} تا{" "}
                            {formatJalaliShort(row.current_period_end)}
                          </td>
                          <td className="py-2 text-slate-600">
                            {formatJalali(row.next_billing_date)}
                            {row.auto_renew ? null : (
                              <span className="mr-1 text-[10px] text-rose-500">بدون تمدید</span>
                            )}
                          </td>
                          <td className="py-2 font-medium text-slate-700">
                            {faToman(row.price_monthly ?? row.plan.price_monthly)}
                          </td>
                          <td className="py-2 text-slate-300">
                            <ChevronLeft className="h-4 w-4" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty text="اشتراکی با این فیلتر پیدا نشد." />
              )}
            </Panel>
          ) : null}

          {tab === "domains" ? (
            <Panel
              title="دامنه‌های CDN"
              subtitle={`${faNum(domainsCount)} دامنه · برای دیدن رکوردها، ترافیک و کش کلیک کنید`}
              icon={Globe2}
              action={
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute right-2 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      value={domainSearch}
                      onChange={(event) => setDomainSearch(event.target.value)}
                      placeholder="جست‌وجوی دامنه"
                      className="h-8 w-44 pr-7 text-xs"
                    />
                  </div>
                  <select
                    value={domainStatus}
                    onChange={(event) => setDomainStatus(event.target.value)}
                    className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-600"
                  >
                    <option value="">همه وضعیت‌ها</option>
                    <option value="active">فعال</option>
                    <option value="pending_ns">در انتظار NS</option>
                    <option value="pending_payment">در انتظار پرداخت</option>
                    <option value="error">خطا</option>
                    <option value="suspended">معلق</option>
                  </select>
                </div>
              }
            >
              {domainsLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
                </div>
              ) : domains.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="text-slate-400">
                      <tr>
                        <th className="pb-2 font-medium">دامنه</th>
                        <th className="pb-2 font-medium">مشتری</th>
                        <th className="pb-2 font-medium">پلن</th>
                        <th className="pb-2 font-medium">نوع</th>
                        <th className="pb-2 font-medium">وضعیت</th>
                        <th className="pb-2 font-medium">NS</th>
                        <th className="pb-2 font-medium">SSL</th>
                        <th className="pb-2 font-medium">رکورد</th>
                        <th className="pb-2 font-medium">استقرار</th>
                        <th className="pb-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {domains.map((row) => (
                        <tr
                          key={row.id}
                          className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                          onClick={() => void openDomain(row.id)}
                        >
                          <td className="py-2">
                            <p className="font-medium text-slate-700" dir="ltr">{row.name}</p>
                            {row.last_error ? (
                              <p className="max-w-[220px] truncate text-[10px] text-rose-500">{row.last_error}</p>
                            ) : null}
                          </td>
                          <td className="py-2 text-slate-600">{row.organization_name}</td>
                          <td className="py-2 text-slate-600">
                            {row.plan_name || "—"}
                            <span className="text-[10px] text-slate-400">
                              {row.subscription_status ? ` · ${statusLabel(row.subscription_status)}` : ""}
                            </span>
                          </td>
                          <td className="py-2">
                            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                              {row.cdn_type_display}
                            </span>
                          </td>
                          <td className="py-2"><Badge status={row.status} /></td>
                          <td className="py-2">
                            <span className={row.ns_configured ? "text-emerald-600" : "text-amber-600"}>
                              {row.ns_configured ? "تنظیم‌شده" : "در انتظار"}
                            </span>
                          </td>
                          <td className="py-2">
                            <Badge status={row.ssl_status} label={row.ssl_status === "active" ? "فعال" : row.ssl_status} />
                          </td>
                          <td className="py-2 text-slate-600">{faNum(row.records_count)}</td>
                          <td className="py-2 text-slate-500">{formatJalaliShort(row.deployed_at)}</td>
                          <td className="py-2 text-slate-300"><ChevronLeft className="h-4 w-4" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty text="دامنه‌ای با این فیلتر پیدا نشد." />
              )}
            </Panel>
          ) : null}

          {tab === "invoices" ? (
            <Panel
              title="فاکتورهای CDN"
              subtitle="خرید، تمدید، تغییر پلن و مصرف مازاد"
              icon={ReceiptText}
              action={
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={invoiceStatus}
                    onChange={(event) => setInvoiceStatus(event.target.value)}
                    className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-600"
                  >
                    <option value="">همه وضعیت‌ها</option>
                    <option value="paid">پرداخت‌شده</option>
                    <option value="pending">در انتظار</option>
                    <option value="canceled">لغو‌شده</option>
                    <option value="refunded">بازگشت وجه</option>
                  </select>
                  <select
                    value={invoiceKind}
                    onChange={(event) => setInvoiceKind(event.target.value)}
                    className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-600"
                  >
                    <option value="">همه انواع</option>
                    <option value="subscription_purchase">خرید اشتراک</option>
                    <option value="renewal">تمدید</option>
                    <option value="plan_change">تغییر پلن</option>
                    <option value="static_addon">افزودنی استاتیک</option>
                    <option value="overage">مصرف مازاد</option>
                  </select>
                </div>
              }
            >
              {invoicesLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
                </div>
              ) : invoices.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="text-slate-400">
                      <tr>
                        <th className="pb-2 font-medium">شماره</th>
                        <th className="pb-2 font-medium">مشتری</th>
                        <th className="pb-2 font-medium">دامنه</th>
                        <th className="pb-2 font-medium">نوع</th>
                        <th className="pb-2 font-medium">مبلغ</th>
                        <th className="pb-2 font-medium">اعتبار کیف پول</th>
                        <th className="pb-2 font-medium">وضعیت</th>
                        <th className="pb-2 font-medium">تاریخ پرداخت</th>
                        <th className="pb-2 font-medium">توضیح</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((invoice) => (
                        <tr key={invoice.id} className="border-t border-slate-100">
                          <td className="py-2 font-mono text-[11px] text-slate-600" dir="ltr">
                            {invoice.reference}
                          </td>
                          <td className="py-2 text-slate-600">{invoice.organization}</td>
                          <td className="py-2 text-slate-600" dir="ltr">{invoice.domain || "—"}</td>
                          <td className="py-2 text-slate-600">
                            {summary.revenue.by_kind.find((row) => row.key === invoice.kind)?.label ??
                              invoice.kind}
                          </td>
                          <td className="py-2 font-medium text-slate-700">{faToman(invoice.amount)}</td>
                          <td className="py-2 text-slate-500">{faToman(invoice.credit_applied)}</td>
                          <td className="py-2"><Badge status={invoice.status} /></td>
                          <td className="py-2 text-slate-500">{formatJalaliShort(invoice.paid_at)}</td>
                          <td className="max-w-[260px] truncate py-2 text-[10px] text-slate-400">
                            {invoice.description}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty text="فاکتوری با این فیلتر پیدا نشد." />
              )}
            </Panel>
          ) : null}

          {tab === "plans" ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className={cn(
                    "rounded-2xl border bg-white p-4 shadow-sm",
                    plan.is_active ? "border-slate-200" : "border-dashed border-slate-300 opacity-70"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">{plan.name}</h3>
                      <p className="text-[11px] text-slate-400">{plan.tier_display}</p>
                    </div>
                    <Badge status={plan.is_active ? "active" : "expired"} label={plan.is_active ? "فعال" : "غیرفعال"} />
                  </div>
                  <p className="mt-3 text-lg font-bold text-pink-600">
                    {plan.is_free ? "رایگان" : faToman(plan.price_monthly)}
                    {plan.is_free ? null : <span className="text-[11px] font-normal text-slate-400"> / ماه</span>}
                  </p>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                    <div className="rounded-lg bg-slate-50 p-2">
                      <dt className="text-slate-400">دامنه</dt>
                      <dd className="font-semibold text-slate-700">{faNum(plan.max_domains)}</dd>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2">
                      <dt className="text-slate-400">رکورد DNS</dt>
                      <dd className="font-semibold text-slate-700">
                        {plan.unlimited_records ? "نامحدود" : faNum(plan.max_records ?? 0)}
                      </dd>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2">
                      <dt className="text-slate-400">ترافیک ماهانه</dt>
                      <dd className="font-semibold text-slate-700">
                        {plan.traffic_gb_month ? `${faNum(plan.traffic_gb_month)} گیگ` : "سفارشی"}
                      </dd>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2">
                      <dt className="text-slate-400">اشتراک فعال</dt>
                      <dd className="font-semibold text-slate-700">{faNum(plan.active_subscribers ?? 0)}</dd>
                    </div>
                  </dl>
                  <div className="mt-3 flex flex-wrap gap-1 text-[10px]">
                    {plan.cdn_enabled ? <Badge status="ok" label="CDN" /> : null}
                    {plan.dns_management ? <Badge status="ok" label="DNS" /> : null}
                    {plan.is_custom_quote ? <Badge status="pending" label="استعلامی" /> : null}
                    {plan.features?.waf ? <Badge status="ok" label="WAF" /> : null}
                    {plan.features?.advanced_cache ? <Badge status="ok" label="کش پیشرفته" /> : null}
                  </div>
                  <p className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                    <span>درآمد ماهانه پلن</span>
                    <b className="text-slate-700">{faToman(plan.mrr ?? 0)}</b>
                  </p>
                </div>
              ))}
              {!plans.length ? <Empty text="پلنی ثبت نشده است." /> : null}
            </div>
          ) : null}

          {tab === "nodes" ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {nodes.map((node) => (
                <div key={node.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
                        <Server className="h-4 w-4 text-slate-400" />
                        {node.name}
                      </h3>
                      <p className="text-[11px] text-slate-400" dir="ltr">{node.ip}</p>
                    </div>
                    <Badge status={node.health_status} label={node.is_active ? "فعال" : "غیرفعال"} />
                  </div>
                  <div className="mt-3 space-y-2 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">نقش / منطقه</span>
                      <span className="font-medium text-slate-700">
                        {node.role_display} · {node.region}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Nginx</span>
                      <Badge status={node.nginx_status} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">PowerDNS</span>
                      <Badge status={node.pdns_status} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">آخرین بررسی</span>
                      <span className="text-slate-600">{formatJalaliShort(node.last_check_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
              {!nodes.length ? <Empty text="نودی ثبت نشده است." /> : null}
            </div>
          ) : null}
        </>
      ) : null}

      {/* Subscription drawer */}
      {detailLoading || detail ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm"
          onClick={() => setDetail(null)}
        >
          <div
            className="my-6 w-full max-w-5xl rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <h3 className="text-sm font-bold text-slate-800">جزئیات اشتراک CDN</h3>
              <button type="button" onClick={() => setDetail(null)} className="text-slate-400 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            {detailLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
              </div>
            ) : detail ? (
              <div className="space-y-4 p-5">
                {detail.subscriptions.map((subscription) => (
                  <div key={subscription.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-slate-800">{subscription.organization_name}</p>
                        <p className="text-[11px] text-slate-400">
                          {detail.organizations[0]?.owner_email} · {subscription.organization_slug}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge status={subscription.status} />
                        <Badge status={subscription.plan_slug} label={subscription.plan_name} />
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 text-[11px] sm:grid-cols-3 lg:grid-cols-4">
                      <div className="rounded-lg bg-slate-50 p-2">
                        <p className="text-slate-400">مبلغ ماهانه</p>
                        <p className="font-semibold text-slate-700">
                          {faToman(subscription.plan.price_monthly)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2">
                        <p className="text-slate-400">دوره جاری</p>
                        <p className="font-semibold text-slate-700">
                          {formatJalaliShort(subscription.current_period_start)} —{" "}
                          {formatJalaliShort(subscription.current_period_end)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2">
                        <p className="text-slate-400">تمدید بعدی</p>
                        <p className="font-semibold text-slate-700">
                          {formatJalali(subscription.next_billing_date)}
                          {subscription.auto_renew ? " (خودکار)" : " (دستی)"}
                        </p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2">
                        <p className="text-slate-400">شروع</p>
                        <p className="font-semibold text-slate-700">{formatJalali(subscription.started_at)}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2">
                        <p className="text-slate-400">دامنه</p>
                        <p className="font-semibold text-slate-700">
                          {faNum(subscription.domain_count)} / {faNum(subscription.plan.max_domains)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2">
                        <p className="text-slate-400">ترافیک</p>
                        <p className="font-semibold text-slate-700">
                          {faBytes(subscription.traffic_used_bytes)} /{" "}
                          {faBytes(subscription.traffic_limit_bytes)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2">
                        <p className="text-slate-400">رکورد</p>
                        <p className="font-semibold text-slate-700">
                          {subscription.plan.unlimited_records
                            ? "نامحدود"
                            : faNum(subscription.max_records ?? subscription.plan.max_records ?? 0)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2">
                        <p className="text-slate-400">حالت پرداخت</p>
                        <p className="font-semibold text-slate-700">{subscription.billing_mode_display}</p>
                      </div>
                    </div>
                    <div className="mt-3">
                      <p className="mb-1 text-[11px] text-slate-400">مصرف ترافیک دوره</p>
                      <UsageBar percent={subscription.usage_percent} />
                    </div>
                  </div>
                ))}

                <div>
                  <h4 className="mb-2 text-xs font-semibold text-slate-700">دامنه‌های این مشتری</h4>
                  {detail.domains.length ? (
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-right text-[11px]">
                        <thead className="bg-slate-50 text-slate-400">
                          <tr>
                            <th className="px-3 py-2 font-medium">دامنه</th>
                            <th className="px-3 py-2 font-medium">نوع</th>
                            <th className="px-3 py-2 font-medium">وضعیت</th>
                            <th className="px-3 py-2 font-medium">SSL</th>
                            <th className="px-3 py-2 font-medium">رکورد</th>
                            <th className="px-3 py-2 font-medium">مصرف</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.domains.map((domain) => (
                            <tr key={domain.id} className="border-t border-slate-100">
                              <td className="px-3 py-2 font-medium text-slate-700" dir="ltr">{domain.name}</td>
                              <td className="px-3 py-2 text-slate-600">{domain.cdn_type_display}</td>
                              <td className="px-3 py-2"><Badge status={domain.status} /></td>
                              <td className="px-3 py-2"><Badge status={domain.ssl_status} /></td>
                              <td className="px-3 py-2 text-slate-600">{faNum(domain.records_count)}</td>
                              <td className="px-3 py-2 text-slate-500">
                                {formatJalaliShort(domain.last_synced_at)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Empty text="دامنه‌ای ثبت نشده است." />
                  )}
                </div>

                <div>
                  <h4 className="mb-2 text-xs font-semibold text-slate-700">فاکتورها</h4>
                  {detail.invoices.length ? (
                    <div className="space-y-1.5">
                      {detail.invoices.map((invoice) => (
                        <div
                          key={invoice.id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 text-[11px]"
                        >
                          <span className="font-mono text-slate-500" dir="ltr">{invoice.reference}</span>
                          <span className="flex-1 truncate px-2 text-slate-400">{invoice.description}</span>
                          <span className="font-semibold text-slate-700">{faToman(invoice.amount)}</span>
                          <Badge status={invoice.status} />
                          <span className="text-slate-400">{formatJalaliShort(invoice.paid_at)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty text="فاکتوری ثبت نشده است." />
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Domain drawer */}
      {domainDetailLoading || domainDetail ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm"
          onClick={() => setDomainDetail(null)}
        >
          <div
            className="my-6 w-full max-w-5xl rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <Globe2 className="h-4 w-4 text-sky-500" />
                {domainDetail?.domain.name || "جزئیات دامنه"}
              </h3>
              <button type="button" onClick={() => setDomainDetail(null)} className="text-slate-400 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            {domainDetailLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
              </div>
            ) : domainDetail ? (
              <div className="space-y-4 p-5">
                <div className="grid gap-2 text-[11px] sm:grid-cols-3 lg:grid-cols-4">
                  <div className="rounded-lg bg-slate-50 p-2">
                    <p className="text-slate-400">مشتری / پلن</p>
                    <p className="font-semibold text-slate-700">
                      {domainDetail.domain.organization_name} · {domainDetail.domain.plan_name || "—"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <p className="text-slate-400">وضعیت</p>
                    <Badge status={domainDetail.domain.status} />
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <p className="text-slate-400">نوع</p>
                    <p className="font-semibold text-slate-700">{domainDetail.domain.cdn_type_display}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <p className="text-slate-400">SSL</p>
                    <Badge status={domainDetail.domain.ssl_status} />
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <p className="text-slate-400">Origin</p>
                    <p className="font-semibold text-slate-700" dir="ltr">
                      {domainDetail.domain.origin_ip || "از رکورد CDN"} · {domainDetail.domain.origin_protocol}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <p className="text-slate-400">NS</p>
                    <p className="font-semibold text-slate-700" dir="ltr">
                      {domainDetail.domain.nameservers.join(" · ") || "—"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <p className="text-slate-400">استقرار</p>
                    <p className="font-semibold text-slate-700">{formatJalali(domainDetail.domain.deployed_at)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <p className="text-slate-400">همگام‌سازی</p>
                    <p className="font-semibold text-slate-700">{formatJalali(domainDetail.domain.last_synced_at)}</p>
                  </div>
                </div>

                {domainDetail.domain.last_error ? (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-700">
                    {domainDetail.domain.last_error}
                  </div>
                ) : null}

                <div>
                  <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <Network className="h-4 w-4 text-slate-400" />
                    رکوردهای DNS ({faNum(domainDetail.records.length)})
                  </h4>
                  {domainDetail.records.length ? (
                    <div className="max-h-72 overflow-auto rounded-xl border border-slate-200">
                      <table className="w-full text-right text-[11px]">
                        <thead className="sticky top-0 bg-slate-50 text-slate-400">
                          <tr>
                            <th className="px-3 py-2 font-medium">نام</th>
                            <th className="px-3 py-2 font-medium">نوع</th>
                            <th className="px-3 py-2 font-medium">مقدار</th>
                            <th className="px-3 py-2 font-medium">TTL</th>
                            <th className="px-3 py-2 font-medium">برچسب</th>
                            <th className="px-3 py-2 font-medium">پروکسی</th>
                          </tr>
                        </thead>
                        <tbody>
                          {domainDetail.records.map((record) => (
                            <tr key={record.id} className="border-t border-slate-100">
                              <td className="px-3 py-1.5 text-slate-600" dir="ltr">{record.name}</td>
                              <td className="px-3 py-1.5 font-mono text-slate-500">{record.type}</td>
                              <td className="max-w-[280px] truncate px-3 py-1.5 text-slate-600" dir="ltr">
                                {record.value}
                              </td>
                              <td className="px-3 py-1.5 text-slate-500">{faNum(record.ttl)}</td>
                              <td className="px-3 py-1.5">
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                                  {record.tag_display || record.tag}
                                </span>
                              </td>
                              <td className="px-3 py-1.5">
                                {record.proxied ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-600">
                                    <CheckCircle2 className="h-3 w-3" /> CDN
                                  </span>
                                ) : (
                                  <span className="text-slate-400">DNS</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Empty text="رکوردی ثبت نشده است." />
                  )}
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                      <Signal className="h-4 w-4 text-slate-400" />
                      ترافیک ۳۰ روز
                    </h4>
                    {domainDetail.traffic.length ? (
                      <div className="max-h-56 overflow-auto rounded-xl border border-slate-200">
                        <table className="w-full text-right text-[11px]">
                          <tbody>
                            {domainDetail.traffic.map((row) => (
                              <tr key={row.date} className="border-t border-slate-100 first:border-0">
                                <td className="px-3 py-1.5 text-slate-500">{formatJalaliShort(row.date)}</td>
                                <td className="px-3 py-1.5 text-slate-600">{faNum(row.requests)} درخواست</td>
                                <td className="px-3 py-1.5 text-slate-600">{faBytes(row.bytes)}</td>
                                <td className="px-3 py-1.5 text-rose-500">
                                  {faNum(row.status_5xx)} × ۵xx
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <Empty text="آمار ترافیکی ثبت نشده است." />
                    )}
                  </div>
                  <div>
                    <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                      <Cpu className="h-4 w-4 text-slate-400" />
                      وضعیت کش و اسنپ‌شات
                    </h4>
                    {domainDetail.cache_stats.length ? (
                      <div className="space-y-1.5">
                        {domainDetail.cache_stats.slice(0, 4).map((row) => (
                          <div
                            key={row.id}
                            className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-1.5 text-[11px]"
                          >
                            <span className="text-slate-500">{formatJalaliShort(row.collected_at)}</span>
                            <span className="text-slate-600">
                              {faNum(row.hits)} / {faNum(row.hits + row.misses)} کش
                            </span>
                            <b className="text-slate-700">{faNum(Math.round(row.hit_ratio * 100))}٪</b>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-lg bg-slate-50 p-3 text-[11px] text-slate-400">
                        آمار کش ثبت نشده است.
                      </p>
                    )}
                    <div className="mt-3 space-y-1.5">
                      {domainDetail.snapshots.map((snapshot) => (
                        <div
                          key={snapshot.id}
                          className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-1.5 text-[11px]"
                        >
                          <span className="truncate text-slate-600" dir="ltr">{snapshot.source_url}</span>
                          <span className="text-slate-500">{faNum(snapshot.page_count)} صفحه</span>
                          <Badge status={snapshot.status} label={snapshot.status_display} />
                        </div>
                      ))}
                      {!domainDetail.snapshots.length ? (
                        <p className="rounded-lg bg-slate-50 p-3 text-[11px] text-slate-400">
                          اسنپ‌شات استاتیکی ثبت نشده است.
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between text-[10px] text-slate-400">
        <span>
          بازه: {formatJalali(summary?.range.start)} تا {formatJalali(summary?.range.end)}
        </span>
        <span className="flex items-center gap-1">
          <ArrowUpRight className="h-3 w-3" />
          {summary ? `به‌روزرسانی ${formatJalali(summary.generated_at)}` : ""}
        </span>
      </div>
    </div>
  )
}
