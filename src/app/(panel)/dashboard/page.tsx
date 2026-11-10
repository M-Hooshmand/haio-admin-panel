"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Activity,
  BadgeCheck,
  CircleDollarSign,
  CircleDashed,
  Megaphone,
  ReceiptText,
  RefreshCw,
  Server,
  ShieldCheck,
  Ticket,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react"
import { api } from "@/lib/api"
import { useAuthStore } from "@/stores/auth-store"
import { PANEL_ROLE_LABELS } from "@/lib/roles"
import { cn } from "@/lib/utils"
import {
  Funnel,
  GroupedBarChart,
  HBarList,
  StackedBarChart,
  faCompact,
  faDay,
  faMonth,
  faNum,
  faToman,
  type ChartBand,
} from "@/components/dashboard-charts"

interface Kpis {
  signups: number
  verified: number
  verification_rate: number
  paid_count: number
  paid_amount: number
  pending_count: number
  pending_amount: number
  inflow_amount: number
  gateway_inflow_amount: number
  wallet_inflow_amount: number
  manual_inflow_amount?: number
  open_tickets: number
  logins_today: number
  users_today: number
  logins_unique: number
  logins_returning: number
  page_views_today: number
  page_view_users_today: number
  active_users_today?: number
  campaigns: number
  active_services: number
  admin_services: number
}

interface DailySignup {
  date: string
  signups: number
  verified: number
}

interface DailyLogin {
  date: string
  logins: number
  users: number
}

interface DailyPageViews {
  date: string
  views: number
  users: number
  sections: Record<string, { views: number; users: number }>
}

interface PageSectionRow {
  key: string
  label: string
  views: number
  users: number
}

interface DailyRevenue {
  date: string
  paid_count: number
  paid_amount: number
  pending_count: number
  pending_amount: number
}

interface MonthlyRevenue {
  month: string
  paid_count: number
  paid_amount: number
  pending_count: number
  pending_amount: number
}

interface RevenueProduct {
  key: string
  label: string
  count: number
  amount: number
  gateway_amount?: number
  wallet_amount?: number
  manual_amount?: number
}

interface InflowPeriod {
  key: string
  label: string
  days: number
  count: number
  amount: number
  gateway_amount: number
  wallet_amount: number
  manual_amount?: number
}

interface InflowPurpose {
  key: string
  label: string
  count: number
  amount: number
  gateway_amount: number
  wallet_amount: number
  manual_amount?: number
}

interface ServiceRow {
  key: string
  label: string
  available: boolean
  total: number | null
  active: number | null
  deleted: number
}

interface AdminServiceUser {
  id: number
  name: string
  email: string
  role: string
  total: number
  active: number
}

interface Money {
  count: number
  amount: number
}

interface ProductRow {
  key: string
  label: string
  available: boolean
  total: number | null
  daily: { date: string; count: number }[]
}

interface TicketRow {
  key: string
  label: string
  count: number
  open: number
  closed: number
}

interface CampaignRow {
  id: number
  name: string
  channel: string
  product: string
  product_key: string
  product_label: string
  start_date: string | null
  end_date: string | null
  active_days: number
  sent: number
  conversions: number
  signups: number
  paid_count: number
  paid_amount: number
  purchases: number | null
}

interface DashboardData {
  generated_at: string
  range: { days: number; from: string; to: string }
  kpis: Kpis
  signups_daily: DailySignup[]
  logins_daily: DailyLogin[]
  page_views_daily: DailyPageViews[]
  page_sections: PageSectionRow[]
  revenue_daily: DailyRevenue[]
  revenue_monthly: MonthlyRevenue[]
  revenue_by_product: RevenueProduct[]
  revenue_by_product_monthly: { month: string; products: RevenueProduct[] }[]
  inflow_by_month: { month: string; products: RevenueProduct[] }[]
  revenue_by_product_daily: { date: string; products: RevenueProduct[] }[]
  inflow_periods: InflowPeriod[]
  inflow_by_purpose: InflowPurpose[]
  products: ProductRow[]
  services: ServiceRow[]
  admin_services: {
    total: number
    active: number
    by_product: ServiceRow[]
    users: AdminServiceUser[]
  }
  invoices: {
    issued: Money
    attempted: Money
    paid: Money
    pending: Money
    pending_attempted: Money
    pending_untouched: Money
    canceled: Money
    refunded: Money
    failed_payments: Money
    conversion_rate: number
  }
  tickets: { total: number; open: number; by_product: TicketRow[] }
  campaigns: CampaignRow[]
  campaign_days: string[]
}

const RANGES = [1, 7, 14, 30, 90, 180]
const RANGE_LABELS: Record<number, string> = { 1: "روزانه", 7: "۷ روز", 14: "۱۴ روز", 30: "۳۰ روز", 90: "۹۰ روز", 180: "۱۸۰ روز" }
const CHANNEL_LABELS: Record<string, string> = {
  email: "ایمیل",
  bale: "بله",
  sms: "پیامک",
  both: "ایمیل + بله",
}

const PRODUCT_COLORS: Record<string, string> = {
  paas: "#6366f1",
  haioflash: "#0ea5e9",
  haiogate: "#f59e0b",
  desktop: "#10b981",
  cdn: "#ec4899",
  dedicated: "#8b5cf6",
  wordpress: "#0d9488",
  android: "#22c55e",
}

const PAGE_COLORS = [
  "#6366f1",
  "#0ea5e9",
  "#f59e0b",
  "#10b981",
  "#ec4899",
  "#8b5cf6",
  "#14b8a6",
  "#ef4444",
  "#64748b",
]

function tomanCompact(value: number): string {
  return `${faCompact(value)} تومان`
}

export default function DashboardPage() {
  const { user, role } = useAuthStore()
  const [days, setDays] = useState(90)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revenueMode, setRevenueMode] = useState<"daily" | "monthly">("daily")
  const [productMonth, setProductMonth] = useState<string>("latest")

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      setError(null)
      try {
        const { data: payload } = await api.get<DashboardData>("/panel/dashboard/", {
          params: { days },
        })
        setData(payload)
      } catch (err) {
        const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        setError(detail || "دریافت آمار داشبورد ناموفق بود.")
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [days]
  )

  useEffect(() => {
    void load()
  }, [load])

  // Money figures are read live: refresh quietly every minute so a new
  // gateway payment or wallet settlement shows up without a page reload.
  useEffect(() => {
    const timer = window.setInterval(() => {
      void load(true)
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [load])

  const labels = useMemo(() => data?.signups_daily.map((row) => row.date) ?? [], [data])
  const indexByDate = useMemo(() => {
    const map = new Map<string, number>()
    labels.forEach((date, index) => map.set(date, index))
    return map
  }, [labels])

  const activeCampaigns = useMemo(
    () => (data?.campaigns ?? []).filter((campaign) => campaign.sent > 0),
    [data]
  )

  const bands: ChartBand[] = useMemo(() => {
    if (!data) return []
    // Many campaigns share the same send day — merge them into one band so the
    // shaded area does not stack its opacity 40 times.
    const grouped = new Map<string, { start: number; end: number; names: string[] }>()
    for (const campaign of activeCampaigns) {
      if (!campaign.start_date || !campaign.end_date) continue
      const start = indexByDate.get(campaign.start_date)
      const end = indexByDate.get(campaign.end_date)
      if (start === undefined || end === undefined || end < start) continue
      const key = `${start}-${end}`
      const bucket = grouped.get(key) ?? { start, end, names: [] }
      bucket.names.push(campaign.name)
      grouped.set(key, bucket)
    }
    return [...grouped.values()].map((band) => ({
      start: band.start,
      end: band.end,
      label: band.names.join(" · "),
    }))
  }, [data, indexByDate, activeCampaigns])

  const monthOptions = useMemo(
    () => (data?.revenue_by_product_monthly ?? []).map((row) => row.month),
    [data]
  )
  const latestMonth = monthOptions[monthOptions.length - 1]
  const activeMonth =
    productMonth === "all"
      ? "all"
      : monthOptions.includes(productMonth)
        ? productMonth
        : latestMonth
  const productRevenue =
    activeMonth === "all"
      ? data?.revenue_by_product ?? []
      : data?.revenue_by_product_monthly.find((row) => row.month === activeMonth)?.products ?? []

  const dailyProductSeries = useMemo(() => {
    const rows = data?.revenue_by_product_daily ?? []
    if (!rows.length) return []
    return rows[0].products.map((product) => ({
      key: product.key,
      label: product.label,
      color: PRODUCT_COLORS[product.key] ?? "#64748b",
      values: rows.map((row) => row.products.find((item) => item.key === product.key)?.amount ?? 0),
    }))
  }, [data])

  const monthlyProductSeries = useMemo(() => {
    const rows = data?.inflow_by_month ?? data?.revenue_by_product_monthly ?? []
    if (!rows.length) return []
    // Only products that actually have a revenue source in this range — the
    // backend product catalogue also lists placeholder lines (Pass, Iraj)
    // that never carry money and would show up as empty legend entries.
    const allowed = new Set((data?.revenue_by_product ?? []).map((row) => row.key))
    const products = allowed.size
      ? rows[0].products.filter((product) => allowed.has(product.key))
      : rows[0].products
    return products.map((product) => ({
      key: product.key,
      label: product.label,
      color: PRODUCT_COLORS[product.key] ?? "#64748b",
      values: rows.map((row) => row.products.find((item) => item.key === product.key)?.amount ?? 0),
    }))
  }, [data])

  // Page traffic: the chart shows the six busiest sections plus «سایر صفحات»,
  // while the table below lists every section with its unique-user count.
  const pageViewSeries = useMemo(() => {
    const rows = data?.page_views_daily ?? []
    if (!rows.length) return []
    const ordered = [...(data?.page_sections ?? [])].sort((a, b) => b.views - a.views)
    const top = ordered.slice(0, 6)
    const rest = ordered.slice(6).map((row) => row.key)
    const series = top.map((row, index) => ({
      key: row.key,
      label: row.label,
      color: PAGE_COLORS[index % PAGE_COLORS.length],
      values: rows.map((day) => day.sections[row.key]?.views ?? 0),
    }))
    if (rest.length) {
      series.push({
        key: "other_pages",
        label: "سایر صفحات",
        color: "#64748b",
        values: rows.map((day) =>
          rest.reduce((sum, key) => sum + (day.sections[key]?.views ?? 0), 0)
        ),
      })
    }
    return series
  }, [data])

  const pageViewTotal = useMemo(
    () => (data?.page_sections ?? []).reduce((sum, row) => sum + row.views, 0),
    [data]
  )

  // Day-by-day view: "who came and where they went" per day, newest first.
  const pageDays = useMemo(() => {
    const rows = data?.page_views_daily ?? []
    const labelsByKey = new Map((data?.page_sections ?? []).map((row) => [row.key, row.label]))
    return [...rows]
      .filter((row) => row.views > 0)
      .reverse()
      .map((row) => ({
        date: row.date,
        views: row.views,
        users: row.users,
        top: Object.entries(row.sections)
          .sort((a, b) => b[1].views - a[1].views)
          .slice(0, 3)
          .map(([key, value]) => `${labelsByKey.get(key) ?? key} (${faNum(value.views)})`),
      }))
  }, [data])

  const displayName =
    user?.display_name ||
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
    user?.username ||
    "کاربر"

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-2xl bg-gradient-to-l from-indigo-600 to-violet-600 p-5 text-white md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs text-indigo-100">داشبورد مدیریت</p>
            <h2 className="mt-1 text-xl font-bold md:text-2xl">{displayName}</h2>
            <p className="mt-2 text-xs leading-6 text-indigo-100">
              تصویر کامل {days === 1 ? "امروز" : `${faNum(days)} روز گذشته`} از ثبت‌نام، احراز هویت، محصولات،
              فاکتورها، تیکت‌ها، کمپین‌ها و ورود کاربران به پنل. آمار فقط شامل
              مشتریان واقعی است و حساب‌های ادمین/پشتیبانی جدا شده‌اند.
              {role ? ` دسترسی شما: ${PANEL_ROLE_LABELS[role]}.` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl bg-white/10 p-1">
              {RANGES.map((range) => (
                <button
                  key={range}
                  onClick={() => setDays(range)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                    days === range ? "bg-white text-indigo-700" : "text-indigo-100 hover:bg-white/10"
                  )}
                >
                  {RANGE_LABELS[range] ?? `${faNum(range)} روز`}
                </button>
              ))}
            </div>
            <button
              onClick={() => void load()}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/20 disabled:opacity-60"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              به‌روزرسانی
            </button>
          </div>
        </div>
        {data ? (
          <p className="mt-3 text-[10px] text-indigo-200">
            بازه: {faDay(data.range.from)} تا {faDay(data.range.to)} · آخرین محاسبه:{" "}
            {new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit" }).format(
              new Date(data.generated_at)
            )}
          </p>
        ) : null}
      </section>

      {error ? (
        <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <span>{error}</span>
          <button onClick={() => void load()} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs text-white">
            تلاش دوباره
          </button>
        </div>
      ) : null}

      {loading && !data ? <DashboardSkeleton /> : null}

      {data ? (
        <>
          {/* KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title={days === 1 ? "ثبت‌نام امروز" : `ثبت‌نام ${faNum(days)} روز`}
              value={faNum(data.kpis.signups)}
              hint={`${faNum(data.kpis.verified)} احراز هویت · نرخ ${faNum(data.kpis.verification_rate)}٪`}
              icon={UserPlus}
              tone="text-indigo-600"
            />
            <KpiCard
              title="ورودی مالی (درگاه + کیف پول + کارت‌به‌کارت)"
              value={tomanCompact(data.kpis.inflow_amount)}
              hint={`درگاه: ${tomanCompact(data.kpis.gateway_inflow_amount)} · کیف پول: ${tomanCompact(
                data.kpis.wallet_inflow_amount
              )}${
                (data.kpis.manual_inflow_amount ?? 0) > 0
                  ? ` · کارت‌به‌کارت: ${tomanCompact(data.kpis.manual_inflow_amount ?? 0)}`
                  : ""
              }`}
              icon={CircleDollarSign}
              tone="text-emerald-600"
            />
            <KpiCard
              title="فاکتور در انتظار"
              value={faNum(data.kpis.pending_count)}
              hint={tomanCompact(data.kpis.pending_amount)}
              icon={ReceiptText}
              tone="text-amber-600"
            />
            <KpiCard
              title="ورود امروز به پنل"
              value={faNum(data.kpis.logins_today)}
              hint={`${faNum(data.kpis.users_today)} کاربر یکتا`}
              icon={Activity}
              tone="text-sky-600"
            />
            <KpiCard
              title="بازدید امروز از پنل"
              value={faNum(data.kpis.page_views_today ?? 0)}
              hint={`${faNum(data.kpis.page_view_users_today ?? 0)} کاربر یکتا`}
              icon={Activity}
              tone="text-cyan-600"
            />
            <KpiCard
              title="تیکت باز"
              value={faNum(data.kpis.open_tickets)}
              hint={`${faNum(data.tickets.total)} تیکت در بازه`}
              icon={Ticket}
              tone="text-rose-600"
            />
            <KpiCard
              title="نرخ تبدیل فاکتور"
              value={`${faNum(data.invoices.conversion_rate)}٪`}
              hint={`${faNum(data.invoices.paid.count)} پرداخت از ${faNum(data.invoices.issued.count)} فاکتور`}
              icon={TrendingUp}
              tone="text-violet-600"
            />
            <KpiCard
              title="کمپین‌های بازه"
              value={faNum(activeCampaigns.length)}
              hint={`${faNum(data.campaign_days.length)} روز ارسال · ${faNum(data.kpis.campaigns)} کمپین ثبت‌شده`}
              icon={Megaphone}
              tone="text-fuchsia-600"
            />
            <KpiCard
              title="احراز هویت‌شده"
              value={faNum(data.kpis.verified)}
              hint={`نرخ احراز ${faNum(data.kpis.verification_rate)}٪`}
              icon={BadgeCheck}
              tone="text-teal-600"
            />
            <KpiCard
              title="سرویس فعال مشتریان"
              value={faNum(data.kpis.active_services)}
              hint="پاس، فلش، تحریم‌شکن، دسکتاپ و CDN"
              icon={Server}
              tone="text-cyan-600"
            />
            <KpiCard
              title="سرویس‌های ادمین‌ها"
              value={faNum(data.kpis.admin_services)}
              hint={`${faNum(data.admin_services.active)} سرویس فعال`}
              icon={ShieldCheck}
              tone="text-slate-600"
            />
          </div>

          {/* Inflow by fixed period */}
          <ChartCard
            title="ورودی مالی در بازه‌های مختلف"
            subtitle="همان پول واقعی (درگاه + کیف پول + دریافت مستقیم سرور اختصاصی) در بازه‌های ثابت، مستقل از انتخاب بازه نمودارها. فقط مشتریان واقعی؛ ولت و فاکتور ادمین‌ها حذف شده است."
            icon={CircleDollarSign}
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {(data.inflow_periods ?? []).map((period) => (
                <div
                  key={period.key}
                  className="rounded-xl border border-slate-200 bg-slate-50/60 p-3"
                >
                  <div className="text-xs font-medium text-slate-500">
                    {period.days === 1 ? `امروز (${faDay(data.range.to)})` : period.label}
                  </div>
                  <div className="mt-1 text-lg font-bold text-slate-800">
                    {tomanCompact(period.amount)}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    درگاه {tomanCompact(period.gateway_amount)} · کیف پول{" "}
                    {tomanCompact(period.wallet_amount)}
                    {(period.manual_amount ?? 0) > 0
                      ? ` · کارت‌به‌کارت ${tomanCompact(period.manual_amount ?? 0)}`
                      : ""}
                  </div>
                </div>
              ))}
            </div>
          </ChartCard>

          {/* Inflow split: product + purpose, gateway vs wallet */}
          <ChartCard
            title="تفکیک ورودی مالی: درگاه و کیف پول"
            subtitle="هر ریال ورودی به تفکیک منبع پرداخت (درگاه یا کیف پول)، محصول و نوع خرید در بازه انتخاب‌شده. فقط مشتریان واقعی."
            icon={CircleDollarSign}
          >
            <div className="grid gap-6 xl:grid-cols-2">
              <div>
                <h4 className="mb-2 text-sm font-semibold text-slate-700">به تفکیک محصول</h4>
                {(() => {
                  const showManual = data.revenue_by_product.some(
                    (row) => (row.manual_amount ?? 0) > 0
                  )
                  return (
                <table className="w-full text-right text-sm">
                  <thead>
                    <tr className="text-xs text-slate-500">
                      <th className="py-1 font-medium">محصول</th>
                      <th className="py-1 font-medium">تعداد</th>
                      <th className="py-1 font-medium">درگاه</th>
                      <th className="py-1 font-medium">کیف پول</th>
                      {showManual ? <th className="py-1 font-medium">کارت‌به‌کارت</th> : null}
                      <th className="py-1 font-medium">جمع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.revenue_by_product.map((row) => (
                      <tr key={row.key} className="border-t border-slate-100">
                        <td className="py-1.5">{row.label}</td>
                        <td className="py-1.5 text-slate-500">{faNum(row.count)}</td>
                        <td className="py-1.5">{tomanCompact(row.gateway_amount ?? 0)}</td>
                        <td className="py-1.5">{tomanCompact(row.wallet_amount ?? 0)}</td>
                        {showManual ? (
                          <td className="py-1.5">{tomanCompact(row.manual_amount ?? 0)}</td>
                        ) : null}
                        <td className="py-1.5 font-semibold">{tomanCompact(row.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                  )
                })()}
              </div>
              <div>
                <h4 className="mb-2 text-sm font-semibold text-slate-700">بابت چه کاری</h4>
                {(() => {
                  const showManual = (data.inflow_by_purpose ?? []).some(
                    (row) => (row.manual_amount ?? 0) > 0
                  )
                  return (
                <table className="w-full text-right text-sm">
                  <thead>
                    <tr className="text-xs text-slate-500">
                      <th className="py-1 font-medium">نوع خرید</th>
                      <th className="py-1 font-medium">تعداد</th>
                      <th className="py-1 font-medium">درگاه</th>
                      <th className="py-1 font-medium">کیف پول</th>
                      {showManual ? <th className="py-1 font-medium">کارت‌به‌کارت</th> : null}
                      <th className="py-1 font-medium">جمع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.inflow_by_purpose ?? []).map((row) => (
                      <tr key={row.key} className="border-t border-slate-100">
                        <td className="py-1.5">{row.label}</td>
                        <td className="py-1.5 text-slate-500">{faNum(row.count)}</td>
                        <td className="py-1.5">{tomanCompact(row.gateway_amount)}</td>
                        <td className="py-1.5">{tomanCompact(row.wallet_amount)}</td>
                        {showManual ? (
                          <td className="py-1.5">{tomanCompact(row.manual_amount ?? 0)}</td>
                        ) : null}
                        <td className="py-1.5 font-semibold">{tomanCompact(row.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                  )
                })()}
              </div>
            </div>
          </ChartCard>

          {/* Signups + verification */}
          <ChartCard
            title="ثبت‌نام و احراز هویت روزانه"
            subtitle="ثبت‌نام‌های جدید مشتریان و تعداد نفراتی از همان ثبت‌نام‌ها که احراز هویت (شاهکار) کرده‌اند — نوارهای بنفش، روزهای کمپین هستند. حساب‌های ادمین در این آمار نیستند."
            icon={Users}
          >
            <GroupedBarChart
              labels={labels}
              bands={bands}
              series={[
                {
                  key: "signups",
                  label: "ثبت‌نام",
                  color: "#4f46e5",
                  values: data.signups_daily.map((row) => row.signups),
                },
                {
                  key: "verified",
                  label: "احراز‌شده از ثبت‌نام‌ها",
                  color: "#0d9488",
                  values: data.signups_daily.map((row) => row.verified),
                },
              ]}
            />
          </ChartCard>

          <div className="grid gap-4 xl:grid-cols-3">
            {/* Revenue */}
            <ChartCard
              className="xl:col-span-2"
              title="ورودی مالی به تفکیک محصول"
              subtitle="پرداخت موفق درگاه + تسویه با کیف پول، فقط برای مشتریان واقعی (ولت و فاکتور ادمین‌ها حذف شده). هر رنگ یک محصول است؛ روزانه یا ماهانه — با نگه‌داشتن موس سهم هر محصول را ببینید."
              icon={CircleDollarSign}
            >
              <div className="mb-3 flex w-fit items-center gap-1 rounded-xl bg-slate-100 p-1 text-[11px]">
                <button
                  onClick={() => setRevenueMode("daily")}
                  className={cn(
                    "rounded-lg px-3 py-1 font-medium transition",
                    revenueMode === "daily"
                      ? "bg-white text-slate-800 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  روزانه
                </button>
                <button
                  onClick={() => setRevenueMode("monthly")}
                  className={cn(
                    "rounded-lg px-3 py-1 font-medium transition",
                    revenueMode === "monthly"
                      ? "bg-white text-slate-800 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  ماهانه
                </button>
              </div>
              {revenueMode === "daily" ? (
                <StackedBarChart
                  labels={labels}
                  bands={bands}
                  series={dailyProductSeries}
                  formatValue={faToman}
                />
              ) : (
                <StackedBarChart
                  labels={(data.inflow_by_month ?? data.revenue_monthly.map((row) => ({ month: row.month }))).map((row) => row.month)}
                  series={monthlyProductSeries}
                  labelFormat={faMonth}
                  formatValue={faToman}
                />
              )}
            </ChartCard>

            {/* Invoice funnel */}
            <ChartCard
              title="قیف پرداخت فاکتورها"
              subtitle="از صدور فاکتور تا تلاش پرداخت و پرداخت موفق."
              icon={ReceiptText}
            >
              <Funnel
                stages={[
                  {
                    label: "فاکتور صادرشده",
                    value: data.invoices.issued.count,
                    hint: faToman(data.invoices.issued.amount),
                    color: "#6366f1",
                  },
                  {
                    label: "تلاش پرداخت",
                    value: data.invoices.attempted.count,
                    hint: faToman(data.invoices.attempted.amount),
                    color: "#8b5cf6",
                  },
                  {
                    label: "پرداخت موفق",
                    value: data.invoices.paid.count,
                    hint: faToman(data.invoices.paid.amount),
                    color: "#10b981",
                  },
                ]}
              />
              <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
                <MiniStat
                  label="در انتظار بدون تلاش"
                  value={faNum(data.invoices.pending_untouched.count)}
                  hint={faToman(data.invoices.pending_untouched.amount)}
                  tone="text-amber-600"
                />
                <MiniStat
                  label="در انتظار با تلاش"
                  value={faNum(data.invoices.pending_attempted.count)}
                  hint={faToman(data.invoices.pending_attempted.amount)}
                  tone="text-rose-600"
                />
                <MiniStat
                  label="پرداخت ناموفق"
                  value={faNum(data.invoices.failed_payments.count)}
                  hint={faToman(data.invoices.failed_payments.amount)}
                  tone="text-slate-600"
                />
                <MiniStat
                  label="لغو‌شده"
                  value={faNum(data.invoices.canceled.count)}
                  hint={faToman(data.invoices.canceled.amount)}
                  tone="text-slate-500"
                />
              </div>
            </ChartCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {/* Products */}
            <ChartCard
              title="محصولات ساخته‌شده توسط مشتریان"
              subtitle={`تعداد محصول جدید مشتریان در ${faNum(days)} روز گذشته، بدون داده‌های مهاجرت و بدون سرویس‌های ادمین (آن‌ها در کارت پایین هستند). تاریخچه واقعی محصولات از نیمه مهر ۱۴۰۵ شروع شده است.`}
              icon={CircleDashed}
            >
              <HBarList
                items={data.products.map((product) => {
                  const live = data.services.find((service) => service.key === product.key)
                  return {
                    key: product.key,
                    label: product.label,
                    value: product.total,
                    hint: product.available
                      ? `${faNum(product.daily.reduce((sum, row) => sum + row.count, 0))} مورد در بازه · موجود: ${faNum(
                          live?.total ?? 0
                        )} · فعال: ${faNum(live?.active ?? 0)}`
                      : "این محصول در دیتابیس پنل منبع داده ندارد",
                  }
                })}
              />
            </ChartCard>

            {/* Tickets by product */}
            <ChartCard
              title="تیکت‌ها به تفکیک محصول"
              subtitle="کدام محصول بیشترین تیکت را دارد (سبز: بسته‌شده، نارنجی: باز)."
              icon={Ticket}
            >
              <HBarList
                items={data.tickets.by_product.map((row) => ({
                  key: row.key,
                  label: row.label,
                  value: row.count,
                  hint: `باز: ${faNum(row.open)} · بسته: ${faNum(row.closed)}`,
                  segments: [
                    { value: row.open, color: "#f59e0b", label: "باز" },
                    { value: row.closed, color: "#10b981", label: "بسته" },
                  ],
                }))}
                emptyLabel="در این بازه تیکتی ثبت نشده است."
              />
              <div className="mt-3 flex gap-4 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500" /> باز
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> بسته‌شده
                </span>
              </div>
            </ChartCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {/* Active customer services */}
            <ChartCard
              title="سرویس‌های فعال مشتریان"
              subtitle="تعداد سرویس‌هایی که همین حالا فعال هستند (به تفکیک محصول)؛ فقط مشتریان، بدون سرویس‌های ادمین."
              icon={Server}
            >
              <HBarList
                items={data.services.map((service) => ({
                  key: service.key,
                  label: service.label,
                  value: service.active,
                  hint: service.available
                    ? `از ${faNum(service.total)} سرویس موجود${
                        service.deleted ? ` · ${faNum(service.deleted)} حذف‌شده` : ""
                      }`
                    : "این محصول در دیتابیس پنل منبع داده ندارد",
                }))}
              />
            </ChartCard>

            {/* Admin-created services */}
            <ChartCard
              title="سرویس‌های ساخته‌شده توسط ادمین‌ها"
              subtitle="تعداد سرویس‌های موجود که حساب‌های ادمین/پشتیبانی ساخته‌اند — از جمله دسکتاپ مجازی. این سرویس‌ها در آمار مشتریان شمرده نمی‌شوند."
              icon={ShieldCheck}
            >
              <HBarList
                items={data.admin_services.by_product.map((service) => ({
                  key: service.key,
                  label: service.label,
                  value: service.total,
                  hint: service.available
                    ? `فعال: ${faNum(service.active)}${
                        service.deleted ? ` · ${faNum(service.deleted)} حذف‌شده` : ""
                      }`
                    : "منبع داده ثبت نشده",
                }))}
              />
              {data.admin_services.users.length ? (
                <div className="mt-4 overflow-hidden rounded-xl border border-slate-100">
                  <table className="w-full text-right text-[11px]">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-2 py-1.5 font-medium">ادمین</th>
                        <th className="px-2 py-1.5 font-medium">نقش</th>
                        <th className="px-2 py-1.5 font-medium">سرویس</th>
                        <th className="px-2 py-1.5 font-medium">فعال</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.admin_services.users.map((adminUser) => (
                        <tr key={adminUser.id} className="border-t border-slate-100">
                          <td className="px-2 py-1.5">
                            <p className="font-medium text-slate-700">{adminUser.name}</p>
                            <p className="text-[9px] text-slate-400">{adminUser.email}</p>
                          </td>
                          <td className="px-2 py-1.5 text-slate-500">{adminUser.role}</td>
                          <td className="px-2 py-1.5 font-bold text-slate-700">{faNum(adminUser.total)}</td>
                          <td className="px-2 py-1.5 text-emerald-600">{faNum(adminUser.active)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </ChartCard>
          </div>

          {/* Logins */}
          <ChartCard
            title="ورود کاربران به پنل"
            subtitle="تعداد ورود موفق و کاربران یکتا در هر روز؛ فقط مشتریان. داده‌های پیش از فعال‌سازی ثبت رویداد، از آخرین ورود کاربران بازسازی شده است."
            icon={Activity}
          >
            <GroupedBarChart
              labels={labels}
              bands={bands}
              series={[
                {
                  key: "logins",
                  label: "ورود",
                  color: "#0ea5e9",
                  values: data.logins_daily.map((row) => row.logins),
                },
                {
                  key: "users",
                  label: "کاربر یکتا",
                  color: "#6366f1",
                  values: data.logins_daily.map((row) => row.users),
                },
              ]}
            />
            <p className="mt-3 rounded-xl bg-slate-50 p-3 text-[11px] leading-5 text-slate-500">
              در این بازه {faNum(data.kpis.logins_unique)} مشتری یکتا وارد پنل شده‌اند؛
              {faNum(data.kpis.logins_returning)} نفرشان قبل از این بازه ثبت‌نام کرده
              بودند. به همین دلیل «کاربر یکتا» با «ثبت‌نام روزانه» برابر نیست: هر
              ثبت‌نام جدید قطعاً یک ورود است، اما ورودها شامل مشتریان قدیمی هم می‌شود.
            </p>
          </ChartCard>

          {/* Page traffic */}
          <ChartCard
            title="بازدید روزانه از پنل (به تفکیک صفحه)"
            subtitle="تاریخچه بازدید صفحات پنل مشتری (my.haio.ir) — امروز و روزهای گذشته. هر کاربر در هر روز برای هر صفحه‌ای که باز کند یک بار شمرده می‌شود؛ آمار لحظه‌ای در تب «مونیتورینگ کاربران» است. فقط مشتریان واقعی."
            icon={Activity}
          >
            <StackedBarChart labels={labels} bands={bands} series={pageViewSeries} />

            <h3 className="mb-2 mt-5 text-xs font-bold text-slate-700">روز به روز — کجا رفتند</h3>
            <div className="max-h-[280px] overflow-auto rounded-xl border border-slate-100">
              <table className="w-full text-right text-xs">
                <thead className="sticky top-0 bg-slate-50 text-[11px] text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">تاریخ</th>
                    <th className="px-3 py-2 font-medium">بازدید</th>
                    <th className="px-3 py-2 font-medium">کاربر یکتا</th>
                    <th className="px-3 py-2 font-medium">پرترددترین صفحات</th>
                  </tr>
                </thead>
                <tbody>
                  {pageDays.length ? (
                    pageDays.map((row) => (
                      <tr key={row.date} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-medium text-slate-700">{faDay(row.date)}</td>
                        <td className="px-3 py-2 text-slate-600">{faNum(row.views)}</td>
                        <td className="px-3 py-2 text-slate-600">{faNum(row.users)}</td>
                        <td className="px-3 py-2 text-slate-500">{row.top.join(" · ")}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                        هنوز بازدیدی ثبت نشده است.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <h3 className="mb-2 mt-5 text-xs font-bold text-slate-700">جمع بازه — به تفکیک صفحه</h3>
            <div className="max-h-[340px] overflow-auto rounded-xl border border-slate-100">
              <table className="w-full text-right text-xs">
                <thead className="sticky top-0 bg-slate-50 text-[11px] text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">صفحه</th>
                    <th className="px-3 py-2 font-medium">بازدید</th>
                    <th className="px-3 py-2 font-medium">کاربر یکتا</th>
                    <th className="px-3 py-2 font-medium">سهم</th>
                  </tr>
                </thead>
                <tbody>
                  {data.page_sections.length ? (
                    data.page_sections.map((row) => (
                      <tr key={row.key} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-medium text-slate-700">{row.label}</td>
                        <td className="px-3 py-2 text-slate-600">{faNum(row.views)}</td>
                        <td className="px-3 py-2 text-slate-600">{faNum(row.users)}</td>
                        <td className="px-3 py-2 text-slate-500">
                          {faNum(
                            pageViewTotal
                              ? Math.round((row.views / pageViewTotal) * 1000) / 10
                              : 0
                          )}
                          ٪
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                        هنوز بازدیدی ثبت نشده است.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-3 rounded-xl bg-slate-50 p-3 text-[11px] leading-5 text-slate-500">
              در این بازه {faNum(pageViewTotal)} بازدید از {faNum(data.page_sections.length)} صفحه ثبت شده است.
            </p>
          </ChartCard>

          {/* Campaign comparison */}
          <ChartCard
            title="کمپین‌ها و اثرشان"
            subtitle="همه اعداد فقط مربوط به گیرندگان همان کمپین است (تطبیق با موبایل/کاربر)، بعد از اولین ارسال. «خرید محصول (پرداخت‌شده)» = تعداد فاکتورهای پرداخت‌شده‌ی همان محصول توسط گیرندگان؛ «فاکتور پرداختی» = همه فاکتورهای پرداخت‌شده‌ی گیرندگان (هر محصول) و «درآمد» = مبلغ همان‌ها. اعداد کل پلتفرم اینجا نمی‌آید."
            icon={Megaphone}
          >
            {activeCampaigns.length ? (
              <div className="max-h-[460px] overflow-auto rounded-xl border border-slate-100">
                <table className="w-full min-w-[820px] text-right text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] text-slate-500">
                      <th className="py-2 font-medium">کمپین</th>
                      <th className="py-2 font-medium">محصول</th>
                      <th className="py-2 font-medium">کانال</th>
                      <th className="py-2 font-medium">روزهای ارسال</th>
                      <th className="py-2 font-medium">ارسال</th>
                      <th className="py-2 font-medium">ثبت‌نام</th>
                      <th className="py-2 font-medium">خرید محصول (پرداخت‌شده)</th>
                      <th className="py-2 font-medium">فاکتور پرداختی</th>
                      <th className="py-2 font-medium">درآمد</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeCampaigns.map((campaign) => (
                      <tr key={campaign.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                        <td className="max-w-[220px] truncate py-2.5 font-medium text-slate-800" title={campaign.name}>
                          {campaign.name}
                        </td>
                        <td className="py-2.5 text-slate-600">{campaign.product_label}</td>
                        <td className="py-2.5 text-slate-500">
                          {CHANNEL_LABELS[campaign.channel] ?? campaign.channel}
                        </td>
                        <td className="py-2.5 text-slate-500">
                          {campaign.start_date ? (
                            <span className="whitespace-nowrap">
                              {faDay(campaign.start_date)}
                              {campaign.end_date && campaign.end_date !== campaign.start_date
                                ? ` – ${faDay(campaign.end_date)}`
                                : ""}
                              <span className="mr-1 text-[10px] text-slate-400">
                                ({faNum(campaign.active_days)} روز)
                              </span>
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-2.5 text-slate-700">{faNum(campaign.sent)}</td>
                        <td className="py-2.5 font-bold text-indigo-600">{faNum(campaign.signups)}</td>
                        <td className="py-2.5 text-slate-700">
                          {campaign.purchases === null ? "—" : faNum(campaign.purchases)}
                        </td>
                        <td className="py-2.5 text-slate-700">{faNum(campaign.paid_count)}</td>
                        <td className="py-2.5 font-medium text-emerald-600">
                          {tomanCompact(campaign.paid_amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="py-8 text-center text-xs text-slate-400">
                در این بازه کمپینی ارسال نشده است.
              </p>
            )}
          </ChartCard>

          {/* Revenue by product */}
          <ChartCard
            title="درآمد به تفکیک محصول"
            subtitle={
              activeMonth === "all"
                ? "سهم هر محصول از مبلغ فاکتورهای پرداخت‌شده در کل بازه انتخاب‌شده."
                : `سهم هر محصول از مبلغ فاکتورهای پرداخت‌شده در ${faMonth(activeMonth)}.`
            }
            icon={CircleDollarSign}
          >
            <div className="mb-4 flex flex-wrap gap-1.5">
              <button
                onClick={() => setProductMonth("all")}
                className={cn(
                  "rounded-lg border px-2.5 py-1 text-[11px] font-medium transition",
                  activeMonth === "all"
                    ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                )}
              >
                کل بازه
              </button>
              {[...monthOptions].reverse().map((month) => (
                <button
                  key={month}
                  onClick={() => setProductMonth(month)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-[11px] font-medium transition",
                    activeMonth === month
                      ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                      : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                  )}
                >
                  {faMonth(month)}
                </button>
              ))}
            </div>
            <HBarList
              items={productRevenue.map((row) => ({
                key: row.key,
                label: row.label,
                value: row.amount,
                hint: `${faNum(row.count)} فاکتور پرداخت‌شده`,
              }))}
            />
          </ChartCard>
        </>
      ) : null}
    </div>
  )
}

function KpiCard({
  title,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  title: string
  value: string
  hint: string
  icon: React.ComponentType<{ className?: string }>
  tone: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-slate-500">{title}</p>
        <Icon className={cn("h-4 w-4", tone)} />
      </div>
      <p className="mt-2 text-xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-[10px] text-slate-400">{hint}</p>
    </div>
  )
}

function ChartCard({
  title,
  subtitle,
  icon: Icon,
  children,
  className,
}: {
  title: string
  subtitle: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn("rounded-2xl border border-slate-200 bg-white p-4 md:p-5", className)}>
      <div className="mb-4 flex items-start gap-2">
        <span className="rounded-lg bg-indigo-50 p-1.5 text-indigo-600">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

function MiniStat({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint: string
  tone: string
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className={cn("mt-1 text-sm font-bold", tone)}>{value}</p>
      <p className="mt-0.5 text-[9px] text-slate-400">{hint}</p>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white xl:col-span-2" />
        <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      </div>
    </div>
  )
}
