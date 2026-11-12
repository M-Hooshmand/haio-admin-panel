"use client"

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react"
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  CircleDashed,
  Clock3,
  Eye,
  Filter,
  FlaskConical,
  Lightbulb,
  Loader2,
  MailOpen,
  Megaphone,
  MessageSquareText,
  MousePointerClick,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  Target,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Users,
  X,
} from "lucide-react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/* ─────────────────────────────── types ─────────────────────────────── */

interface Feedback {
  responses: number
  interested: number
  question: number
  not_interested: number
  no_reply: number
  trials: number
  trials_success: number
  lost_reasons: number
  lost_reason_breakdown: Record<string, number>
  nps_count: number
  nps_avg: number | null
  referrals: number
  referrals_converted: number
  improvement_tasks: number
}

interface CampaignRow {
  id: number
  name: string
  channel: string
  product: string
  product_label: string
  is_paused: boolean
  approved_at: string | null
  approved_by_name: string
  created_at: string
  updated_at: string
  total: number
  sent: number
  failed: number
  queued: number
  success_rate: number
  opens: number
  unique_opens: number
  clicks: number
  unique_clicks: number
  unsub: number
  unique_unsub: number
  open_rate: number
  unique_open_rate: number
  click_rate: number
  unique_click_rate: number
  unsub_rate: number
  first_sent_at: string | null
  last_sent_at: string | null
  subject: string
  theme: string
  message: string
  message_excerpt: string
  has_feedback: boolean
  feedback: Feedback
  feedback_note: string
}

interface CampaignSendRow {
  id: number
  mobile: string
  first_name: string
  status: string
  error_code: string
  sent_at: string | null
  message_text: string
}

interface CampaignResponseRow {
  id: number
  mobile: string
  response_type: string
  response_type_label: string
  response_text: string
  handled: boolean
  received_at: string | null
  created_at: string
}

interface LostReasonRow {
  id: number
  mobile: string
  reason_text: string
  reason_category: string
  reason_category_label: string
  created_at: string
}

interface NpsRow {
  id: number
  mobile: string
  score: number | null
  raw_reply: string
  satisfaction: string
  collected_at: string
}

interface TrialRow {
  id: number
  mobile: string
  product: string
  success: boolean | null
  started_at: string | null
  completed_at: string | null
}

interface CampaignDetail extends CampaignRow {
  sends: CampaignSendRow[]
  responses: CampaignResponseRow[]
  lost_reasons: LostReasonRow[]
  nps_scores: NpsRow[]
  trials: TrialRow[]
  referrals: { id: number; mobile: string; status: string; created_at: string }[]
  text_for_test: string
}

interface Suggestion {
  key: string
  priority: "high" | "medium" | "low"
  title: string
  description: string
  reason: string
  product: string
  product_label: string
  channel: string
  audience: string
  suggested_name: string
  suggested_subject: string
  suggested_text: string
  action: { type: "create" | "retry_failed"; campaign_id?: number }
}

interface Summary {
  campaigns: number
  total: number
  sent: number
  failed: number
  queued: number
  success_rate: number
  opens: number
  unique_opens: number
  clicks: number
  unique_clicks: number
  unsub: number
  unique_unsub: number
  open_rate: number
  unique_open_rate: number
  click_rate: number
  unique_click_rate: number
  unsub_rate: number
  active_audience: number
  feedback_total: number
  last_sent_at: string | null
  bale_ready: boolean
  require_approval: boolean
}

interface Overview {
  summary: Summary
  results: CampaignRow[]
  suggestions: Suggestion[]
}

interface Meta {
  active_audience: number
  total_audience: number
  bale_ready: boolean
  require_approval: boolean
  cap: number
  dedup_days: number
  products: { value: string; label: string }[]
  response_types: { value: string; label: string }[]
  lost_reason_categories: { value: string; label: string }[]
}

interface Prefill {
  name: string
  product: string
  subject: string
  message: string
}

interface LaunchResult {
  campaign?: string
  channel?: string
  mode?: string
  dry_run?: boolean
  requested?: number
  eligible?: number
  created?: number
  would_create?: number
  requeued?: number
  skipped_recent?: number
  skipped_existing?: number
  skipped_noaddr?: number
  dedup_days?: number
  cap?: number
  approved?: boolean
  dispatched?: number
  detail?: string
  error?: string
}

/* ────────────────────────────── helpers ────────────────────────────── */

const STATUS_STYLES: Record<string, string> = {
  sent: "border-emerald-200 bg-emerald-50 text-emerald-700",
  failed: "border-rose-200 bg-rose-50 text-rose-700",
  queued: "border-amber-200 bg-amber-50 text-amber-700",
  soft_bounce: "border-orange-200 bg-orange-50 text-orange-700",
  hard_bounce: "border-rose-200 bg-rose-50 text-rose-700",
}

const STATUS_LABELS: Record<string, string> = {
  sent: "ارسال شد",
  failed: "ناموفق",
  queued: "در صف",
  soft_bounce: "بازگشت نرم",
  hard_bounce: "بازگشت سخت",
}

const PRIORITY_STYLES: Record<string, string> = {
  high: "border-rose-200 bg-rose-50 text-rose-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  low: "border-slate-200 bg-slate-50 text-slate-600",
}

const PRIORITY_LABELS: Record<string, string> = {
  high: "اولویت بالا",
  medium: "اولویت متوسط",
  low: "پیشنهاد مکمل",
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

function formatNumber(value: number | null | undefined): string {
  return (value ?? 0).toLocaleString("fa-IR")
}

function formatDateTime(value?: string | null): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString("fa-IR", { dateStyle: "short", timeStyle: "short" })
}

function formatDate(value?: string | null): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("fa-IR", { dateStyle: "medium" })
}

function feedbackTone(row: CampaignRow): string {
  if (row.feedback.responses > 0) return "border-emerald-200 bg-emerald-50 text-emerald-700"
  return "border-slate-200 bg-slate-50 text-slate-500"
}

/* ─────────────────────────────── page ─────────────────────────────── */

export default function CampaignsPage() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [meta, setMeta] = useState<Meta | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [product, setProduct] = useState("")
  const [ordering, setOrdering] = useState("last_sent")

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [prefill, setPrefill] = useState<Prefill | null>(null)
  const [launchTarget, setLaunchTarget] = useState<{
    campaignId: number
    name: string
    mode: "launch" | "retry"
  } | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 350)
    return () => clearTimeout(timer)
  }, [searchInput])

  const fetchOverview = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const params: Record<string, string> = { ordering }
      if (search) params.search = search
      if (product) params.product = product
      const { data } = await api.get<Overview>("/panel/campaigns/", { params })
      setOverview(data)
    } catch (err) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }, [ordering, product, search])

  const fetchMeta = useCallback(async () => {
    try {
      const { data } = await api.get<Meta>("/panel/campaigns/meta/")
      setMeta(data)
    } catch {
      /* meta is optional chrome */
    }
  }, [])

  useEffect(() => {
    fetchMeta()
  }, [fetchMeta])

  useEffect(() => {
    fetchOverview()
  }, [fetchOverview])

  const refresh = () => {
    fetchOverview()
    fetchMeta()
  }

  const summary = overview?.summary
  const rows = overview?.results ?? []
  const suggestions = overview?.suggestions ?? []

  const productOptions = meta?.products ?? [
    { value: "paas", label: "پلتفرم (PaaS)" },
    { value: "anti_sanction", label: "تحریم‌شکن" },
    { value: "haioflash", label: "هایوفلش" },
    { value: "haiogate", label: "هایوگیت" },
  ]

  const openCreate = (suggestion?: Suggestion) => {
    if (suggestion) {
      setPrefill({
        name: suggestion.suggested_name,
        product: suggestion.product,
        subject: suggestion.suggested_subject,
        message: suggestion.suggested_text,
      })
    } else {
      setPrefill(null)
    }
    setCreateOpen(true)
  }

  const startSuggestion = (suggestion: Suggestion) => {
    if (suggestion.action.type === "retry_failed" && suggestion.action.campaign_id) {
      setLaunchTarget({
        campaignId: suggestion.action.campaign_id,
        name: suggestion.title,
        mode: "retry",
      })
      return
    }
    openCreate(suggestion)
  }

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Megaphone className="h-4 w-4 text-indigo-600" />
          <span>
            {summary
              ? `${formatNumber(summary.campaigns)} کمپین · ${formatNumber(
                  summary.sent,
                )} پیام موفق · ${formatNumber(summary.unique_opens)} باز‌شدن یکتا`
              : "در حال دریافت نتایج کمپین‌ها…"}
          </span>
          {summary && summary.queued > 0 ? (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
              {formatNumber(summary.queued)} در صف
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            بروزرسانی
          </Button>
          <Button size="sm" onClick={() => openCreate()}>
            <Plus className="h-4 w-4" />
            کمپین جدید
          </Button>
        </div>
      </div>

      {summary && !summary.bale_ready ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <p className="font-bold">اتصال بله روی سرور تنظیم نشده است</p>
            <p className="mt-1 text-xs leading-6">
              متغیرهای <code className="rounded bg-white/70 px-1">BALE_SAFIR_API_KEY</code> و{" "}
              <code className="rounded bg-white/70 px-1">BALE_SAFIR_BOT_ID</code> را در تنظیمات
              بک‌اند قرار دهید. مشاهده نتایج و ساخت پیش‌نویس کار می‌کند، اما ارسال واقعی انجام
              نمی‌شود.
            </p>
          </div>
        </div>
      ) : null}

      {notice ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            {notice}
          </span>
          <button onClick={() => setNotice("")} className="rounded p-1 hover:bg-white/60">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {/* summary cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="کمپین‌ها"
          value={summary ? formatNumber(summary.campaigns) : "—"}
          hint={`آخرین ارسال: ${formatDateTime(summary?.last_sent_at)}`}
          icon={Megaphone}
          tone="text-indigo-600 bg-indigo-50"
        />
        <SummaryCard
          title="پیام موفق"
          value={summary ? formatNumber(summary.sent) : "—"}
          hint={`نرخ موفقیت ${summary ? summary.success_rate : 0}%`}
          icon={CheckCircle2}
          tone="text-emerald-600 bg-emerald-50"
        />
        <SummaryCard
          title="پیام ناموفق"
          value={summary ? formatNumber(summary.failed) : "—"}
          hint={summary?.failed ? "قابل پیگیری با تلاش مجدد" : "بدون خطای ثبت‌شده"}
          icon={AlertTriangle}
          tone="text-rose-600 bg-rose-50"
        />
        <SummaryCard
          title="ایمیل باز‌شده (یکتا)"
          value={summary ? formatNumber(summary.unique_opens) : "—"}
          hint={
            summary
              ? `نرخ یکتا ${summary.unique_open_rate}% · ${formatNumber(summary.opens)} بار باز شدن`
              : "از رویدادهای ایمیل"
          }
          icon={MailOpen}
          tone="text-sky-600 bg-sky-50"
        />
        <SummaryCard
          title="کلیک ایمیل (یکتا)"
          value={summary ? formatNumber(summary.unique_clicks) : "—"}
          hint={
            summary
              ? `نرخ یکتا ${summary.unique_click_rate}% · ${formatNumber(summary.clicks)} کلیک`
              : "از رویدادهای ایمیل"
          }
          icon={MousePointerClick}
          tone="text-blue-600 bg-blue-50"
        />
        <SummaryCard
          title="لغو اشتراک (یکتا)"
          value={summary ? formatNumber(summary.unique_unsub) : "—"}
          hint={`نرخ ${summary ? summary.unsub_rate : 0}% از ارسال‌ها`}
          icon={ThumbsDown}
          tone="text-amber-600 bg-amber-50"
        />
        <SummaryCard
          title="مخاطب فعال"
          value={summary ? formatNumber(summary.active_audience) : "—"}
          hint="لیست مجاز ارسال (allowlist)"
          icon={Users}
          tone="text-violet-600 bg-violet-50"
        />
        <SummaryCard
          title="بازخورد ثبت‌شده"
          value={summary ? formatNumber(summary.feedback_total) : "—"}
          hint={
            summary?.feedback_total
              ? "در حال دریافت بازخورد مخاطبان"
              : "هنوز پاسخ/بازخوردی ثبت نشده"
          }
          icon={MessageSquareText}
          tone="text-sky-600 bg-sky-50"
        />
      </div>

      {/* filters */}
      <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 md:grid-cols-[1fr_180px_200px]">
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="جستجو در نام کمپین، موضوع پیام یا محصول…"
            className="pr-9"
          />
        </div>
        <select
          value={product}
          onChange={(event) => setProduct(event.target.value)}
          className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100"
        >
          <option value="">همه محصولات</option>
          {productOptions.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <select
          value={ordering}
          onChange={(event) => setOrdering(event.target.value)}
          className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100"
        >
          <option value="last_sent">مرتب‌سازی: آخرین ارسال</option>
          <option value="sent">مرتب‌سازی: بیشترین ارسال موفق</option>
          <option value="failed">مرتب‌سازی: بیشترین ناموفق</option>
          <option value="success">مرتب‌سازی: بالاترین نرخ موفقیت</option>
          <option value="created">مرتب‌سازی: جدیدترین ساخته‌شده</option>
          <option value="name">مرتب‌سازی: نام کمپین</option>
        </select>
      </div>

      {/* results table */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <BarChart3 className="h-4 w-4 text-indigo-600" />
              نتیجه کمپین‌ها — ارسال، باز شدن و کلیک
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              آمار تحویل از رکوردهای واقعی ارسال (CampaignSend) و آمار باز شدن/کلیک/لغو از
              رویدادهای ایمیل (EmailEvent) محاسبه می‌شود؛ نرخ‌ها بر مبنای کل ارسال موفق کمپین است.
            </p>
          </div>
          <span className="rounded-lg bg-slate-50 px-2.5 py-1 text-[11px] text-slate-500">
            {formatNumber(rows.length)} کمپین
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1240px] text-right text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">کمپین / محصول</th>
                <th className="px-4 py-3 font-medium">ارسال موفق</th>
                <th className="px-4 py-3 font-medium">ناموفق</th>
                <th className="px-4 py-3 font-medium">در صف</th>
                <th className="px-4 py-3 font-medium">باز شد (یکتا)</th>
                <th className="px-4 py-3 font-medium">نرخ باز شدن</th>
                <th className="px-4 py-3 font-medium">کلیک (یکتا)</th>
                <th className="px-4 py-3 font-medium">لغو اشتراک</th>
                <th className="px-4 py-3 font-medium">نرخ موفقیت</th>
                <th className="px-4 py-3 font-medium">بازخورد</th>
                <th className="px-4 py-3 font-medium">آخرین ارسال</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-16 text-center text-slate-400">
                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                    در حال دریافت نتایج کمپین‌ها…
                  </td>
                </tr>
              ) : null}

              {!loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-16 text-center text-slate-400">
                    کمپینی با این فیلترها پیدا نشد.
                  </td>
                </tr>
              ) : null}

              {rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => setSelectedId(row.id)}
                  className="cursor-pointer transition-colors hover:bg-slate-50/80"
                >
                  <td className="max-w-[320px] px-4 py-3">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium text-slate-800">{row.name}</p>
                      {row.is_paused ? (
                        <span className="shrink-0 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">
                          متوقف
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
                        {row.channel === "email" ? "ایمیل" : row.channel === "bale" ? "بله" : row.channel}
                      </span>
                      <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-indigo-600">
                        {row.product_label}
                      </span>
                      <span className="truncate" title={row.theme}>
                        {row.theme}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-emerald-700">{formatNumber(row.sent)}</span>
                    <span className="mr-1 text-[11px] text-slate-400">
                      از {formatNumber(row.total)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "font-bold",
                        row.failed ? "text-rose-600" : "text-slate-400",
                      )}
                    >
                      {formatNumber(row.failed)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatNumber(row.queued)}</td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-sky-700">{formatNumber(row.unique_opens)}</span>
                    <span className="mr-1 text-[11px] text-slate-400">
                      از {formatNumber(row.opens)} بار
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div dir="ltr" className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-sky-500"
                          style={{ width: `${Math.min(100, row.unique_open_rate)}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-slate-600">{row.unique_open_rate}%</span>
                    </div>
                    <p className="mt-1 text-[10px] text-slate-400">{row.open_rate}% کل باز شدن‌ها</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-blue-700">{formatNumber(row.unique_clicks)}</span>
                    <span className="mr-1 text-[11px] text-slate-400">
                      از {formatNumber(row.clicks)} کلیک
                    </span>
                    <p className="mt-1 text-[10px] text-slate-400">نرخ یکتا {row.unique_click_rate}%</p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "font-bold",
                        row.unique_unsub ? "text-amber-600" : "text-slate-400",
                      )}
                    >
                      {formatNumber(row.unique_unsub)}
                    </span>
                    <p className="mt-1 text-[10px] text-slate-400">{row.unsub_rate}%</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div dir="ltr" className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            row.success_rate >= 90
                              ? "bg-emerald-500"
                              : row.success_rate >= 60
                                ? "bg-amber-500"
                                : "bg-rose-500",
                          )}
                          style={{ width: `${Math.min(100, row.success_rate)}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-slate-600">
                        {row.success_rate}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px]",
                        feedbackTone(row),
                      )}
                    >
                      <MessageSquareText className="h-3 w-3" />
                      {row.has_feedback
                        ? `${formatNumber(row.feedback.responses)} پاسخ`
                        : "ثبت نشده"}
                    </span>
                    <p className="mt-1 max-w-[190px] truncate text-[10px] text-slate-400" title={row.feedback_note}>
                      {row.feedback_note}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                    {formatDateTime(row.last_sent_at)}
                  </td>
                  <td className="px-4 py-3 text-left">
                    <Eye className="h-4 w-4 text-slate-300" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* next campaign suggestions */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              کمپین بعدی چه باشد؟
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-6 text-slate-500">
              این پیشنهادها از روی داده واقعی کمپین‌های قبلی ساخته شده‌اند: ناموفق‌ها،
              کمپین‌های بزرگ بدون بازخورد و اندازه لیست فعال. هر کارت را می‌توانید مستقیم
              به فرم ساخت کمپین تبدیل کنید.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-[11px] text-amber-700">
            <Sparkles className="h-3 w-3" />
            پیشنهاد خودکار
          </span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {suggestions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400 md:col-span-2">
              برای ساخت پیشنهاد، حداقل یک کمپین بله لازم است.
            </div>
          ) : null}

          {suggestions.map((suggestion) => (
            <SuggestionCard
              key={suggestion.key}
              suggestion={suggestion}
              onStart={() => startSuggestion(suggestion)}
            />
          ))}
        </div>
      </section>

      {selectedId ? (
        <CampaignDrawer
          campaignId={selectedId}
          onClose={() => setSelectedId(null)}
          onChanged={refresh}
          onLaunch={(id, name, mode) => setLaunchTarget({ campaignId: id, name, mode })}
          onNotice={(message) => {
            setNotice(message)
            refresh()
          }}
        />
      ) : null}

      {createOpen ? (
        <CreateCampaignModal
          prefill={prefill}
          meta={meta}
          productOptions={productOptions}
          onClose={() => setCreateOpen(false)}
          onCreated={(campaign, launchNow) => {
            setCreateOpen(false)
            setPrefill(null)
            refresh()
            if (launchNow) {
              setLaunchTarget({
                campaignId: campaign.id,
                name: campaign.name,
                mode: "launch",
              })
            } else {
              setNotice(`پیش‌نویس «${campaign.name}» ذخیره شد.`)
            }
          }}
        />
      ) : null}

      {launchTarget ? (
        <LaunchModal
          campaignId={launchTarget.campaignId}
          name={launchTarget.name}
          mode={launchTarget.mode}
          meta={meta}
          onClose={() => {
            setLaunchTarget(null)
            refresh()
          }}
          onDone={(message) => {
            setLaunchTarget(null)
            setNotice(message)
            refresh()
          }}
        />
      ) : null}
    </div>
  )
}

/* ───────────────────────────── components ───────────────────────────── */

function SummaryCard({
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
        <p className="text-xs text-slate-500">{title}</p>
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-xl", tone)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 truncate text-[11px] text-slate-400" title={hint}>
        {hint}
      </p>
    </div>
  )
}

function SuggestionCard({
  suggestion,
  onStart,
}: {
  suggestion: Suggestion
  onStart: () => void
}) {
  const icon =
    suggestion.key === "retry_failed"
      ? RotateCcw
      : suggestion.key === "feedback_survey"
        ? MessageSquareText
        : suggestion.key === "winback_active"
          ? Target
          : TrendingUp
  const Icon = icon

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-slate-50/40 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-indigo-600 ring-1 ring-slate-200">
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-bold text-slate-900">{suggestion.title}</p>
            <p className="text-[11px] text-slate-400">{suggestion.product_label}</p>
          </div>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-md border px-1.5 py-0.5 text-[10px]",
            PRIORITY_STYLES[suggestion.priority],
          )}
        >
          {PRIORITY_LABELS[suggestion.priority]}
        </span>
      </div>

      <p className="mt-3 flex-1 text-xs leading-6 text-slate-600">{suggestion.description}</p>
      <p className="mt-2 rounded-lg bg-white px-2.5 py-2 text-[11px] leading-5 text-slate-500 ring-1 ring-slate-100">
        <span className="font-medium text-slate-600">چرا؟ </span>
        {suggestion.reason}
      </p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-[11px] text-slate-400">
          <Users className="h-3.5 w-3.5" />
          {suggestion.audience}
        </span>
        <Button size="sm" variant="outline" onClick={onStart}>
          {suggestion.action.type === "retry_failed" ? (
            <>
              <RotateCcw className="h-3.5 w-3.5" />
              پیگیری ناموفق‌ها
            </>
          ) : (
            <>
              <Plus className="h-3.5 w-3.5" />
              ساخت از این پیشنهاد
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

function CampaignDrawer({
  campaignId,
  onClose,
  onChanged,
  onLaunch,
  onNotice,
}: {
  campaignId: number
  onClose: () => void
  onChanged: () => void
  onLaunch: (id: number, name: string, mode: "launch" | "retry") => void
  onNotice: (message: string) => void
}) {
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedbackMobile, setFeedbackMobile] = useState("")
  const [feedbackType, setFeedbackType] = useState("interested")
  const [feedbackText, setFeedbackText] = useState("")
  const [feedbackLost, setFeedbackLost] = useState("")
  const [feedbackNps, setFeedbackNps] = useState("")
  const [feedbackSaving, setFeedbackSaving] = useState(false)

  const [testOpen, setTestOpen] = useState(false)
  const [testMobile, setTestMobile] = useState("")
  const [testSending, setTestSending] = useState(false)
  const [testPreview, setTestPreview] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const { data } = await api.get<CampaignDetail>(`/panel/campaigns/${campaignId}/`)
      setCampaign(data)
    } catch (err) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }, [campaignId])

  useEffect(() => {
    load()
  }, [load])

  const pauseResume = async () => {
    if (!campaign) return
    setBusy(true)
    setError("")
    try {
      await api.post(
        `/panel/campaigns/${campaign.id}/${campaign.is_paused ? "resume" : "pause"}/`,
      )
      await load()
      onChanged()
    } catch (err) {
      setError(extractError(err))
    } finally {
      setBusy(false)
    }
  }

  const submitFeedback = async (event: FormEvent) => {
    event.preventDefault()
    if (!feedbackMobile.trim()) return
    setFeedbackSaving(true)
    setError("")
    try {
      await api.post(`/panel/campaigns/${campaignId}/feedback/`, {
        mobile: feedbackMobile.trim(),
        response_type: feedbackType,
        response_text: feedbackText.trim(),
        lost_reason_category: feedbackLost,
        nps_score: feedbackNps === "" ? null : Number(feedbackNps),
      })
      setFeedbackOpen(false)
      setFeedbackMobile("")
      setFeedbackText("")
      setFeedbackLost("")
      setFeedbackNps("")
      await load()
      onChanged()
    } catch (err) {
      setError(extractError(err))
    } finally {
      setFeedbackSaving(false)
    }
  }

  const sendTest = async () => {
    if (!testMobile.trim()) return
    setTestSending(true)
    setError("")
    try {
      const { data } = await api.post<{ message_id?: string; text?: string }>(
        `/panel/campaigns/${campaignId}/test/`,
        { mobile: testMobile.trim(), confirm: true },
      )
      setTestOpen(false)
      setTestPreview(data.text || "")
      onNotice(`پیام آزمایشی به ${testMobile.trim()} ارسال شد.`)
    } catch (err) {
      setError(extractError(err))
    } finally {
      setTestSending(false)
    }
  }

  const status = campaign?.is_paused
    ? "متوقف"
    : campaign && !campaign.approved_at
      ? "پیش‌نویس"
      : campaign && campaign.queued > 0
        ? "در حال ارسال"
        : "پایان‌یافته"

  return (
    <div
      className="fixed inset-0 z-40 flex justify-start bg-slate-900/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-3xl flex-col bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2 text-[11px] text-slate-400">
              <span className="font-mono">#{campaignId}</span>
              {campaign ? <span>· {formatDate(campaign.created_at)}</span> : null}
            </div>
            <h2 className="truncate text-base font-bold text-slate-900">
              {campaign?.name || "در حال بارگذاری…"}
            </h2>
            {campaign ? (
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                <span className="rounded-lg bg-indigo-50 px-2 py-0.5 text-indigo-600">
                  {campaign.product_label}
                </span>
                <span
                  className={cn(
                    "rounded-lg border px-2 py-0.5",
                    status === "در حال ارسال"
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : status === "پیش‌نویس"
                        ? "border-slate-200 bg-slate-50 text-slate-600"
                        : status === "متوقف"
                          ? "border-orange-200 bg-orange-50 text-orange-700"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700",
                  )}
                >
                  {status}
                </span>
                {campaign.approved_at ? (
                  <span className="text-slate-400">
                    تأیید/راه‌اندازی: {formatDateTime(campaign.approved_at)}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error ? (
          <div className="bg-rose-50 px-4 py-2 text-xs text-rose-700">{error}</div>
        ) : null}

        <div className="flex-1 space-y-4 overflow-y-auto p-4 scrollbar-thin">
          {loading && !campaign ? (
            <div className="flex justify-center py-16 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : null}

          {campaign ? (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <MiniStat label="ارسال موفق" value={formatNumber(campaign.sent)} tone="text-emerald-700" />
                <MiniStat label="ناموفق" value={formatNumber(campaign.failed)} tone="text-rose-600" />
                <MiniStat label="در صف" value={formatNumber(campaign.queued)} tone="text-amber-600" />
                <MiniStat label="نرخ موفقیت" value={`${campaign.success_rate}%`} tone="text-indigo-600" />
                <MiniStat
                  label="باز شدن (یکتا)"
                  value={`${formatNumber(campaign.unique_opens)} / ${formatNumber(campaign.opens)}`}
                  tone="text-sky-700"
                />
                <MiniStat
                  label="نرخ باز شدن (یکتا)"
                  value={`${campaign.unique_open_rate}%`}
                  tone="text-sky-600"
                />
                <MiniStat
                  label="کلیک (یکتا)"
                  value={`${formatNumber(campaign.unique_clicks)} / ${formatNumber(campaign.clicks)}`}
                  tone="text-blue-700"
                />
                <MiniStat
                  label="لغو اشتراک"
                  value={`${formatNumber(campaign.unique_unsub)} · ${campaign.unsub_rate}%`}
                  tone="text-amber-600"
                />
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <MessageSquareText className="h-4 w-4 text-indigo-600" />
                    متن و موضوع پیام
                  </h3>
                  <Button variant="ghost" size="sm" onClick={() => setTestOpen((open) => !open)}>
                    <FlaskConical className="h-3.5 w-3.5" />
                    ارسال آزمایشی
                  </Button>
                </div>
                <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  موضوع: <span className="font-medium text-slate-800">{campaign.subject || "—"}</span>
                </p>
                <p className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm leading-7 text-slate-700">
                  {campaign.message || "متنی برای این کمپین ثبت نشده است."}
                </p>

                {testOpen ? (
                  <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/40 p-3">
                    <div className="min-w-[180px] flex-1">
                      <label className="mb-1 block text-[11px] text-slate-500">
                        شماره موبایل برای تست
                      </label>
                      <Input
                        value={testMobile}
                        onChange={(event) => setTestMobile(event.target.value)}
                        placeholder="0912…"
                        dir="ltr"
                        className="text-left"
                      />
                    </div>
                    <Button size="sm" onClick={sendTest} disabled={testSending || !testMobile.trim()}>
                      {testSending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      ارسال واقعی تست
                    </Button>
                  </div>
                ) : null}
                {testPreview ? (
                  <p className="mt-2 text-[11px] text-emerald-700">
                    پیش‌نمایش ارسال آزمایشی آماده است.
                  </p>
                ) : null}
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <MessageSquareText className="h-4 w-4 text-sky-600" />
                    بازخورد کمپین
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFeedbackOpen((open) => !open)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    ثبت بازخورد
                  </Button>
                </div>

                <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-6 text-slate-600">
                  {campaign.feedback_note}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <FeedbackChip
                    label="علاقه‌مند"
                    value={campaign.feedback.interested}
                    tone="emerald"
                    icon={ThumbsUp}
                  />
                  <FeedbackChip
                    label="سؤال"
                    value={campaign.feedback.question}
                    tone="sky"
                    icon={MessageSquareText}
                  />
                  <FeedbackChip
                    label="عدم تمایل"
                    value={campaign.feedback.not_interested}
                    tone="rose"
                    icon={ThumbsDown}
                  />
                  <FeedbackChip
                    label="بی‌پاسخ"
                    value={campaign.feedback.no_reply}
                    tone="slate"
                    icon={Clock3}
                  />
                  {campaign.feedback.nps_count > 0 ? (
                    <span className="rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] text-indigo-700">
                      NPS: {campaign.feedback.nps_avg} از {campaign.feedback.nps_count} پاسخ
                    </span>
                  ) : null}
                </div>

                {campaign.feedback.lost_reasons > 0 ? (
                  <p className="mt-2 text-[11px] text-slate-500">
                    دلایل عدم تمایل:{" "}
                    {Object.entries(campaign.feedback.lost_reason_breakdown)
                      .map(([key, count]) => `${key}: ${count}`)
                      .join(" · ")}
                  </p>
                ) : null}

                {campaign.responses.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {campaign.responses.map((response) => (
                      <div key={response.id} className="rounded-xl bg-slate-50 p-2.5 text-xs">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                          <span className="font-medium text-slate-700" dir="ltr">
                            {response.mobile}
                          </span>
                          <span className="rounded bg-white px-1.5 py-0.5 text-slate-600">
                            {response.response_type_label}
                          </span>
                          <span>{formatDateTime(response.received_at || response.created_at)}</span>
                        </div>
                        {response.response_text ? (
                          <p className="mt-1 leading-6 text-slate-700">{response.response_text}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                    هنوز پاسخی از مخاطبان این کمپین در سیستم ثبت نشده است. با فرم «ثبت بازخورد»
                    می‌توانید پاسخ‌های دریافتی در بله را دستی ثبت کنید.
                  </div>
                )}

                {feedbackOpen ? (
                  <form onSubmit={submitFeedback} className="mt-3 space-y-2 rounded-xl border border-dashed border-sky-200 bg-sky-50/40 p-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input
                        value={feedbackMobile}
                        onChange={(event) => setFeedbackMobile(event.target.value)}
                        placeholder="شماره موبایل مخاطب"
                        dir="ltr"
                        className="text-left"
                      />
                      <select
                        value={feedbackType}
                        onChange={(event) => setFeedbackType(event.target.value)}
                        className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100"
                      >
                        <option value="interested">علاقه‌مند</option>
                        <option value="question">سؤال</option>
                        <option value="not_interested">عدم تمایل</option>
                        <option value="no_reply">بی‌پاسخ</option>
                      </select>
                    </div>
                    <textarea
                      value={feedbackText}
                      onChange={(event) => setFeedbackText(event.target.value)}
                      rows={2}
                      placeholder="متن پاسخ یا توضیح (اختیاری)"
                      className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <select
                        value={feedbackLost}
                        onChange={(event) => setFeedbackLost(event.target.value)}
                        className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100"
                      >
                        <option value="">دلیل عدم تمایل (اختیاری)</option>
                        <option value="price">قیمت</option>
                        <option value="no_need">نیاز نداشتن</option>
                        <option value="competitor">رقبا</option>
                        <option value="past_experience">تجربه قبلی</option>
                        <option value="other">سایر</option>
                      </select>
                      <Input
                        value={feedbackNps}
                        onChange={(event) => setFeedbackNps(event.target.value)}
                        placeholder="امتیاز NPS از ۰ تا ۱۰ (اختیاری)"
                        type="number"
                        min={0}
                        max={10}
                        dir="ltr"
                        className="text-left"
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        size="sm"
                        disabled={feedbackSaving || !feedbackMobile.trim()}
                      >
                        {feedbackSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        ذخیره بازخورد
                      </Button>
                    </div>
                  </form>
                ) : null}
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <Activity className="h-4 w-4 text-violet-600" />
                  آخرین ارسال‌ها
                </h3>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[520px] text-right text-xs">
                    <thead className="text-[11px] text-slate-400">
                      <tr>
                        <th className="py-1.5 font-medium">موبایل</th>
                        <th className="py-1.5 font-medium">نام</th>
                        <th className="py-1.5 font-medium">وضعیت</th>
                        <th className="py-1.5 font-medium">زمان</th>
                        <th className="py-1.5 font-medium">خطا</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {campaign.sends.map((send) => (
                        <tr key={send.id}>
                          <td className="py-1.5 font-mono text-slate-700" dir="ltr">
                            {send.mobile}
                          </td>
                          <td className="py-1.5 text-slate-600">{send.first_name || "—"}</td>
                          <td className="py-1.5">
                            <span
                              className={cn(
                                "rounded border px-1.5 py-0.5 text-[10px]",
                                STATUS_STYLES[send.status] ??
                                  "border-slate-200 bg-slate-50 text-slate-600",
                              )}
                            >
                              {STATUS_LABELS[send.status] ?? send.status}
                            </span>
                          </td>
                          <td className="whitespace-nowrap py-1.5 text-slate-500">
                            {formatDateTime(send.sent_at)}
                          </td>
                          <td className="max-w-[180px] truncate py-1.5 text-rose-500" title={send.error_code}>
                            {send.error_code || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {campaign.sends.length === 0 ? (
                    <p className="py-4 text-center text-xs text-slate-400">
                      هنوز ارسالی برای این کمپین ثبت نشده است.
                    </p>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 p-4">
          <Button
            size="sm"
            onClick={() => campaign && onLaunch(campaign.id, campaign.name, "launch")}
            disabled={!campaign}
          >
            <Play className="h-3.5 w-3.5" />
            {campaign && !campaign.approved_at ? "راه‌اندازی کمپین" : "ارسال / ادامه ارسال"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onLaunch(campaignId, campaign?.name || "", "retry")}
            disabled={!campaign || campaign.failed === 0}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            تلاش مجدد ناموفق‌ها ({formatNumber(campaign?.failed)})
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={pauseResume}
            disabled={busy || !campaign || (!campaign.approved_at && !campaign.is_paused)}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : campaign?.is_paused ? (
              <Play className="h-3.5 w-3.5" />
            ) : (
              <Pause className="h-3.5 w-3.5" />
            )}
            {campaign?.is_paused ? "ادامه" : "توقف موقت"}
          </Button>
          <span className="ms-auto text-[11px] text-slate-400">
            آخرین ارسال: {formatDateTime(campaign?.last_sent_at)}
          </span>
        </div>
      </div>
    </div>
  )
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className={cn("mt-1 text-lg font-bold", tone)}>{value}</p>
    </div>
  )
}

function FeedbackChip({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string
  value: number
  tone: "emerald" | "sky" | "rose" | "slate"
  icon: React.ComponentType<{ className?: string }>
}) {
  const styles = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    sky: "border-sky-200 bg-sky-50 text-sky-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    slate: "border-slate-200 bg-slate-50 text-slate-600",
  }
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px]", styles[tone])}>
      <Icon className="h-3 w-3" />
      {label}: {formatNumber(value)}
    </span>
  )
}

function CreateCampaignModal({
  prefill,
  meta,
  productOptions,
  onClose,
  onCreated,
}: {
  prefill: Prefill | null
  meta: Meta | null
  productOptions: { value: string; label: string }[]
  onClose: () => void
  onCreated: (campaign: { id: number; name: string }, launchNow: boolean) => void
}) {
  const [name, setName] = useState(prefill?.name ?? "")
  const [product, setProduct] = useState(prefill?.product ?? "paas")
  const [subject, setSubject] = useState(prefill?.subject ?? "")
  const [message, setMessage] = useState(prefill?.message ?? "")
  const [saving, setSaving] = useState(false)
  const [launchNow, setLaunchNow] = useState(true)
  const [error, setError] = useState("")

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!message.trim()) {
      setError("متن پیام بله الزامی است.")
      return
    }
    setSaving(true)
    setError("")
    try {
      const { data } = await api.post<{ id: number; name: string }>("/panel/campaigns/", {
        name: name.trim(),
        product,
        subject: subject.trim(),
        message: message.trim(),
      })
      onCreated(data, launchNow)
    } catch (err) {
      setError(extractError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Megaphone className="h-4 w-4 text-indigo-600" />
              ساخت کمپین بله
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              متن را وارد کنید؛ ارسال فقط به لیست فعال (allowlist) و با تأیید نهایی انجام می‌شود.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4 scrollbar-thin">
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">نام کمپین</label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="مثلاً anti_sanction_winback_nov"
                dir="ltr"
                className="text-left font-mono text-xs"
              />
              <p className="mt-1 text-[10px] text-slate-400">
                خالی بگذارید تا نام خودکار ساخته شود. نام باید یکتا باشد.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">محصول</label>
              <select
                value={product}
                onChange={(event) => setProduct(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100"
              >
                {productOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              موضوع / عنوان پیام (اختیاری)
            </label>
            <Input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="مثلاً پیشنهاد ویژه بازگشت"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-slate-600">متن پیام بله</label>
              <span className="text-[10px] text-slate-400">
                {message.length.toLocaleString("fa-IR")} / ۵٬۰۰۰
              </span>
            </div>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={9}
              placeholder={"سلام {name} 🌟\n..."}
              className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm leading-7 outline-none focus:ring-2 focus:ring-indigo-100"
            />
            <p className="mt-1 text-[10px] text-slate-400">
              از <code className="rounded bg-slate-100 px-1">{"{name}"}</code> برای نام کوچک مخاطب
              استفاده کنید. متن نهایی همان چیزی است که در بله ارسال می‌شود.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <p className="text-xs font-medium text-slate-700">مخاطب این کمپین</p>
            <p className="mt-1 text-[11px] leading-6 text-slate-500">
              فقط اعضای لیست فعال ارسال ({formatNumber(meta?.active_audience)} نفر) انتخاب می‌شوند.
              مخاطبانی که در {meta?.dedup_days ?? 7} روز گذشته پیام گرفته‌اند، به‌صورت خودکار
              کنار گذاشته می‌شوند. سقف هر راه‌اندازی {formatNumber(meta?.cap ?? 5000)} نفر است.
            </p>
          </div>

          <label className="flex items-start gap-2 rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={launchNow}
              onChange={(event) => setLaunchNow(event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-indigo-600"
            />
            <span>
              پس از ذخیره، پیش‌نمایش ارسال را باز کن (تعداد گیرنده، حذف‌شده‌ها و سقف) و سپس
              راه‌اندازی را تأیید کن.
            </span>
          </label>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-100 p-4">
          <span className="text-[11px] text-slate-400">
            کمپین به‌صورت پیش‌نویس ساخته می‌شود و تا تأیید شما ارسالی انجام نمی‌شود.
          </span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              انصراف
            </Button>
            <Button type="submit" size="sm" disabled={saving || !message.trim()}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowLeft className="h-4 w-4" />
              )}
              ذخیره و ادامه
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}

function LaunchModal({
  campaignId,
  name,
  mode,
  meta,
  onClose,
  onDone,
}: {
  campaignId: number
  name: string
  mode: "launch" | "retry"
  meta: Meta | null
  onClose: () => void
  onDone: (message: string) => void
}) {
  const [limit, setLimit] = useState(meta?.cap ?? 5000)
  const [dedupDays, setDedupDays] = useState(meta?.dedup_days ?? 7)
  const [allowOverCap, setAllowOverCap] = useState(false)
  const [batch, setBatch] = useState(20)
  const [preview, setPreview] = useState<LaunchResult | null>(null)
  const [result, setResult] = useState<LaunchResult | null>(null)
  const [checking, setChecking] = useState(true)
  const [launching, setLaunching] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState("")

  const endpoint =
    mode === "retry"
      ? `/panel/campaigns/${campaignId}/retry-failed/`
      : `/panel/campaigns/${campaignId}/launch/`

  const previewLaunch = useCallback(async () => {
    setChecking(true)
    setError("")
    try {
      const { data } = await api.post<LaunchResult>(endpoint, {
        dry_run: true,
        limit,
        dedup_days: dedupDays,
        allow_over_cap: allowOverCap,
        batch,
      })
      setPreview(data)
    } catch (err) {
      setError(extractError(err))
    } finally {
      setChecking(false)
    }
  }, [allowOverCap, batch, dedupDays, endpoint, limit])

  useEffect(() => {
    previewLaunch()
    // Re-run only on mount; the user can press "بررسی مجدد" after edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const launch = async () => {
    setLaunching(true)
    setError("")
    try {
      const { data } = await api.post<LaunchResult>(endpoint, {
        dry_run: false,
        limit,
        dedup_days: dedupDays,
        allow_over_cap: allowOverCap,
        batch,
      })
      setResult(data)
      if (mode === "retry") {
        onDone(`${formatNumber(data.requeued)} پیام ناموفق دوباره در صف ارسال قرار گرفت.`)
      } else {
        onDone(
          `${formatNumber(data.created)} پیام در صف بله قرار گرفت` +
            (data.dispatched ? ` و ${formatNumber(data.dispatched)} ارسال فوری آغاز شد.` : "."),
        )
      }
    } catch (err) {
      setError(extractError(err))
    } finally {
      setLaunching(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
              {mode === "retry" ? (
                <RotateCcw className="h-4 w-4 text-amber-600" />
              ) : (
                <Send className="h-4 w-4 text-indigo-600" />
              )}
              {mode === "retry" ? "تلاش مجدد ارسال‌های ناموفق" : "راه‌اندازی کمپین بله"}
            </h2>
            <p className="mt-1 max-w-md truncate text-xs text-slate-500">{name}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4 scrollbar-thin">
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
              {error}
            </div>
          ) : null}

          {mode === "launch" ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[11px] text-slate-500">حداکثر گیرنده</label>
                  <Input
                    type="number"
                    value={limit}
                    onChange={(event) => setLimit(Number(event.target.value))}
                    dir="ltr"
                    className="text-left"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-slate-500">
                    فاصله از ارسال قبلی (روز)
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={dedupDays}
                    onChange={(event) => setDedupDays(Number(event.target.value))}
                    dir="ltr"
                    className="text-left"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">
                  تعداد ارسال فوری پس از تأیید (حداکثر ۳۰)
                </label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={batch}
                  onChange={(event) => setBatch(Number(event.target.value))}
                  dir="ltr"
                  className="text-left"
                />
                <p className="mt-1 text-[10px] text-slate-400">
                  ارسال ادامه کمپین به‌صورت خودکار هر ۲ دقیقه توسط صف Celery انجام می‌شود.
                </p>
              </div>
              <label className="flex items-center gap-2 text-[11px] text-slate-600">
                <input
                  type="checkbox"
                  checked={allowOverCap}
                  onChange={(event) => setAllowOverCap(event.target.checked)}
                  className="h-4 w-4 accent-indigo-600"
                />
                اجازه ارسال بیش از سقف {formatNumber(meta?.cap ?? 5000)} نفر
              </label>
              <Button variant="outline" size="sm" onClick={previewLaunch} disabled={checking}>
                <RefreshCw className={cn("h-3.5 w-3.5", checking && "animate-spin")} />
                بررسی مجدد
              </Button>
            </>
          ) : (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-800">
              همه پیام‌های ناموفق این کمپین دوباره در صف قرار می‌گیرند و با همان متن قبلی ارسال
              می‌شوند. این عمل فقط روی رکوردهای همین کمپین اثر دارد.
            </p>
          )}

          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            {checking ? (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                در حال محاسبه گیرندگان…
              </div>
            ) : preview ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-700">نتیجه بررسی</span>
                  <span className="rounded bg-white px-2 py-0.5 text-[10px] text-slate-500">
                    پیش‌نمایش — هنوز چیزی ارسال نشده
                  </span>
                </div>
                {mode === "retry" ? (
                  <p className="text-2xl font-bold text-amber-700">
                    {formatNumber(preview.requeued)} پیام
                  </p>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-indigo-700">
                      {formatNumber(preview.would_create ?? preview.eligible)} گیرنده آماده ارسال
                    </p>
                    <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-500 sm:grid-cols-4">
                      <span>کل بررسی: {formatNumber(preview.requested)}</span>
                      <span>تکراری: {formatNumber(preview.skipped_existing)}</span>
                      <span>ارسال اخیر: {formatNumber(preview.skipped_recent)}</span>
                      <span>بدون شماره: {formatNumber(preview.skipped_noaddr)}</span>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400">برای مشاهده نتیجه، بررسی را اجرا کنید.</p>
            )}
          </div>

          {result ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
              <p className="font-bold">عملیات با موفقیت ثبت شد.</p>
              <p className="mt-1">
                {result.requeued !== undefined
                  ? `${formatNumber(result.requeued)} پیام دوباره در صف قرار گرفت.`
                  : `${formatNumber(result.created)} پیام در صف قرار گرفت.`}
              </p>
            </div>
          ) : null}

          {mode === "launch" && meta && !meta.bale_ready ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800">
              اتصال بله روی سرور تنظیم نشده؛ ارسال واقعی انجام نمی‌شود.
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 p-4">
          <label className="flex items-center gap-2 text-[11px] text-slate-600">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="h-4 w-4 accent-indigo-600"
            />
            {mode === "retry"
              ? "تأیید می‌کنم این پیام‌ها دوباره ارسال شوند."
              : "تأیید می‌کنم ارسال به مخاطبان فعال انجام شود."}
          </label>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              انصراف
            </Button>
            <Button
              size="sm"
              onClick={launch}
              disabled={
                launching ||
                checking ||
                !confirmed ||
                !preview ||
                (mode === "launch" && meta?.bale_ready === false)
              }
            >
              {launching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {mode === "retry" ? "شروع تلاش مجدد" : "تأیید و راه‌اندازی"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
