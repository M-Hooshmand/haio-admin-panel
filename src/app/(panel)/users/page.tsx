"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  BadgeCheck,
  Boxes,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Cloud,
  CreditCard,
  Loader2,
  LogIn,
  Mail,
  Phone,
  RefreshCw,
  Search,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from "lucide-react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type VerificationLevel = "full" | "partial" | "none"

interface CustomerRow {
  id: number
  display_name: string
  username?: string | null
  email: string
  mobile: string
  phone: string
  national_id: string
  role: string
  role_label: string
  is_active: boolean
  created_at: string
  last_login: string | null
  last_activity: string
  email_verified: boolean
  mobile_verified: boolean
  shahkar_verified: boolean
  verification_level: VerificationLevel
  wallet_balance: number
  total_paid: number
  last_payment_at: string | null
  organizations_count: number
  services_active: number
  services_total: number
  applications_active: number
  applications_total: number
  subscriptions_active: number
  subscriptions_total: number
  vms_active: number
  vms_total: number
  gate_active: number
  gate_total: number
}

interface CustomerPage {
  count: number
  page: number
  page_size: number
  pages: number
  ordering: string
  results: CustomerRow[]
}

interface CustomerMeta {
  total: number
  verified: number
  new_last_7d: number
  active_last_7d: number
  wallet_total: number
  paid_total: number
  invoice_paid_total: number
}

interface CustomerDetail {
  customer: CustomerRow
  organizations: {
    id: number
    name: string
    slug: string
    role: string
    wallet_balance: number
    created_at: string
  }[]
  subscriptions: {
    id: string
    plan: string
    status: string
    started_at: string | null
    ended_at: string | null
    organization: string
  }[]
  applications: {
    id: string
    name: string
    slug: string
    status: string
    type: string
    project: string
    organization: string
    created_at: string
  }[]
  vms: {
    id: string
    name: string
    status: string
    ip_address: string | null
    plan: string
    organization: string
    created_at: string
  }[]
  gate_accounts: {
    id: string
    username: string
    package: string
    status: string
    usage_display: string
    expired_at: string | null
    created_at: string
  }[]
  payments: {
    id: string
    amount: number
    status: string
    gateway: string
    paid_at: string | null
    created_at: string
    invoice_id: string
    organization: string
    plan: string | null
  }[]
}

const PAGE_SIZE = 25

const VERIFICATION_LABELS: Record<VerificationLevel, string> = {
  full: "احراز شده",
  partial: "ناقص",
  none: "احراز نشده",
}

const ORDERINGS = [
  { value: "created", label: "تاریخ ثبت‌نام — جدیدترین بالا (پیش‌فرض)" },
  { value: "activity", label: "آخرین فعالیت (ثبت‌نام/لاگین)" },
  { value: "login", label: "فقط آخرین لاگین" },
  { value: "verified", label: "وضعیت احراز: احرازشده‌ها اول" },
  { value: "unverified", label: "وضعیت احراز: احرازنشده‌ها اول" },
  { value: "payments", label: "بیشترین پرداختی" },
  { value: "balance", label: "بیشترین شارژ" },
]

const APP_STATUS: Record<string, { label: string; style: string }> = {
  running: { label: "در حال اجرا", style: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  creating: { label: "در حال ساخت", style: "bg-amber-50 text-amber-700 border-amber-200" },
  deploying: { label: "در حال استقرار", style: "bg-amber-50 text-amber-700 border-amber-200" },
  stopped: { label: "متوقف", style: "bg-slate-100 text-slate-600 border-slate-200" },
  failed: { label: "خطا", style: "bg-rose-50 text-rose-700 border-rose-200" },
  suspended: { label: "تعلیق", style: "bg-orange-50 text-orange-700 border-orange-200" },
}

const VM_STATUS: Record<string, { label: string; style: string }> = {
  running: { label: "در حال اجرا", style: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  stopped: { label: "متوقف", style: "bg-slate-100 text-slate-600 border-slate-200" },
  creating: { label: "در حال ساخت", style: "bg-amber-50 text-amber-700 border-amber-200" },
  suspended: { label: "تعلیق", style: "bg-orange-50 text-orange-700 border-orange-200" },
  error: { label: "خطا", style: "bg-rose-50 text-rose-700 border-rose-200" },
}

const GATE_STATUS: Record<string, { label: string; style: string }> = {
  active: { label: "فعال", style: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  expired: { label: "منقضی", style: "bg-slate-100 text-slate-600 border-slate-200" },
  quota_exhausted: { label: "اتمام ترافیک", style: "bg-amber-50 text-amber-700 border-amber-200" },
  suspended: { label: "تعلیق", style: "bg-rose-50 text-rose-700 border-rose-200" },
}

const PAYMENT_STATUS: Record<string, { label: string; style: string }> = {
  success: { label: "موفق", style: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  pending: { label: "در انتظار", style: "bg-amber-50 text-amber-700 border-amber-200" },
  failed: { label: "ناموفق", style: "bg-rose-50 text-rose-700 border-rose-200" },
}

const SUBSCRIPTION_STATUS: Record<string, string> = {
  active: "فعال",
  trialing: "دوره آزمایشی",
  past_due: "معوق",
  expired: "منقضی",
  canceled: "لغو شده",
  suspended: "تعلیق",
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

function formatDate(value?: string | null): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("fa-IR", { dateStyle: "medium" })
}

function formatDateTime(value?: string | null): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString("fa-IR", { dateStyle: "short", timeStyle: "short" })
}

function formatNumber(value: number): string {
  return (value || 0).toLocaleString("fa-IR")
}

function formatToman(value: number): string {
  if (!value) return "۰"
  return `${value.toLocaleString("fa-IR")} تومان`
}

function StatusChip({
  status,
  map,
}: {
  status: string
  map: Record<string, { label: string; style: string }>
}) {
  const item = map[status] ?? { label: status || "—", style: "bg-slate-100 text-slate-600 border-slate-200" }
  return (
    <span className={cn("inline-flex rounded-lg border px-2 py-0.5 text-[11px]", item.style)}>
      {item.label}
    </span>
  )
}

function VerificationBadge({ row, compact = false }: { row: CustomerRow; compact?: boolean }) {
  if (row.verification_level === "full") {
    return (
      <span
        title={`موبایل: ${row.mobile_verified ? "تایید" : "تایید نشده"} · ایمیل: ${
          row.email_verified ? "تایید" : "تایید نشده"
        }${row.shahkar_verified ? " · احراز هویت شاهکار" : ""}`}
        className={cn(
          "inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 font-medium text-emerald-700",
          compact ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        )}
      >
        <ShieldCheck className="h-3.5 w-3.5" />
        {VERIFICATION_LABELS.full}
      </span>
    )
  }
  if (row.verification_level === "partial") {
    return (
      <span
        title="تنها یکی از موبایل یا ایمیل تایید شده است"
        className={cn(
          "inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 font-medium text-amber-700",
          compact ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        )}
      >
        <ShieldAlert className="h-3.5 w-3.5" />
        {VERIFICATION_LABELS.partial}
      </span>
    )
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-500",
        compact ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
      )}
    >
      <Shield className="h-3.5 w-3.5" />
      {VERIFICATION_LABELS.none}
    </span>
  )
}

function ServiceBreakdown({ row }: { row: CustomerRow }) {
  const parts: string[] = []
  if (row.applications_total) parts.push(`پلتفرم ${formatNumber(row.applications_total)}`)
  if (row.vms_total) parts.push(`فلش ${formatNumber(row.vms_total)}`)
  if (row.gate_total) parts.push(`گیت ${formatNumber(row.gate_total)}`)
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-medium",
            row.services_active > 0
              ? "bg-emerald-50 text-emerald-700"
              : "bg-slate-100 text-slate-500",
          )}
        >
          <Boxes className="h-3 w-3" />
          {formatNumber(row.services_active)} فعال
        </span>
        <span className="text-[11px] text-slate-400">از {formatNumber(row.services_total)} سرویس</span>
      </div>
      <span className="text-[10px] text-slate-400">{parts.length ? parts.join(" · ") : "بدون سرویس"}</span>
    </div>
  )
}

function Avatar({ row }: { row: CustomerRow }) {
  return (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold",
        row.verification_level === "full"
          ? "bg-emerald-100 text-emerald-700 ring-2 ring-emerald-200"
          : "bg-slate-100 text-slate-600",
      )}
    >
      {row.display_name.trim().slice(0, 1) || "؟"}
    </div>
  )
}

export default function UsersPage() {
  const [meta, setMeta] = useState<CustomerMeta | null>(null)
  const [rows, setRows] = useState<CustomerRow[]>([])
  const [count, setCount] = useState(0)
  const [pages, setPages] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [verification, setVerification] = useState("")
  const [services, setServices] = useState("")
  const [ordering, setOrdering] = useState("created")

  const [selected, setSelected] = useState<CustomerRow | null>(null)

  const requestId = useRef(0)

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  const fetchMeta = useCallback(async () => {
    try {
      const { data } = await api.get<CustomerMeta>("/panel/customers/meta/")
      setMeta(data)
    } catch {
      /* stats are optional chrome */
    }
  }, [])

  const fetchRows = useCallback(async () => {
    const current = ++requestId.current
    setLoading(true)
    setError("")
    try {
      const params: Record<string, string | number> = { page, page_size: PAGE_SIZE, ordering }
      if (search) params.search = search
      if (verification) params.verification = verification
      if (services) params.services = services
      const { data } = await api.get<CustomerPage>("/panel/customers/", { params })
      if (current !== requestId.current) return
      setRows(data.results)
      setCount(data.count)
      setPages(data.pages)
    } catch (err) {
      if (current !== requestId.current) return
      setError(extractError(err))
    } finally {
      if (current === requestId.current) setLoading(false)
    }
  }, [page, search, verification, services, ordering])

  useEffect(() => {
    fetchMeta()
  }, [fetchMeta])

  useEffect(() => {
    fetchRows()
  }, [fetchRows])

  const refreshAll = () => {
    fetchRows()
    fetchMeta()
  }

  const verifiedPct = useMemo(() => {
    if (!meta?.total) return "۰"
    return ((meta.verified / meta.total) * 100).toLocaleString("fa-IR", {
      maximumFractionDigits: 1,
    })
  }, [meta])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">
            فقط مشتریان (بدون حساب‌های پنل) بر اساس تاریخ ثبت‌نام مرتب شده‌اند؛
            جدیدترین ثبت‌نام بالای فهرست و قدیمی‌ترین در انتها است. احرازشده و
            احرازنشده با هم نمایش داده می‌شوند و کاربر تاییدشده با رنگ سبز مشخص
            می‌شود.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refreshAll} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          بروزرسانی
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetaCard
          title="کل کاربران"
          value={formatNumber(meta?.total ?? 0)}
          note={`${formatNumber(meta?.new_last_7d ?? 0)} ثبت‌نام در ۷ روز`}
          icon={Users}
          tone="text-indigo-600"
        />
        <MetaCard
          title="احراز شده"
          value={formatNumber(meta?.verified ?? 0)}
          note={`${verifiedPct}٪ از کاربران`}
          icon={BadgeCheck}
          tone="text-emerald-600"
          highlight
        />
        <MetaCard
          title="فعال در ۷ روز"
          value={formatNumber(meta?.active_last_7d ?? 0)}
          note="ورود موفق اخیر"
          icon={LogIn}
          tone="text-sky-600"
        />
        <MetaCard
          title="جمع شارژ کیف پول"
          value={formatToman(meta?.wallet_total ?? 0)}
          note="موجودی همه کیف پول‌ها"
          icon={Wallet}
          tone="text-violet-600"
        />
        <MetaCard
          title="جمع پرداختی‌ها"
          value={formatToman(meta?.paid_total ?? 0)}
          note="پرداخت‌های موفق درگاه"
          icon={CreditCard}
          tone="text-amber-600"
        />
      </div>

      <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 lg:grid-cols-[1fr_170px_170px_240px]">
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="جستجو با ایمیل، موبایل، کد ملی، نام یا نام سازمان…"
            className="pr-9"
          />
        </div>
        <select
          value={verification}
          onChange={(event) => {
            setVerification(event.target.value)
            setPage(1)
          }}
          className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100"
        >
          <option value="">همه وضعیت‌های احراز</option>
          <option value="full">احراز شده</option>
          <option value="partial">ناقص</option>
          <option value="none">احراز نشده</option>
        </select>
        <select
          value={services}
          onChange={(event) => {
            setServices(event.target.value)
            setPage(1)
          }}
          className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100"
        >
          <option value="">همه کاربران</option>
          <option value="active">دارای سرویس فعال</option>
          <option value="none">بدون سرویس</option>
        </select>
        <select
          value={ordering}
          onChange={(event) => {
            setOrdering(event.target.value)
            setPage(1)
          }}
          className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100"
        >
          {ORDERINGS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-right text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">کاربر</th>
                <th className="px-4 py-3 font-medium">ایمیل / شماره تماس</th>
                <th className="px-4 py-3 font-medium">کد ملی</th>
                <th className="px-4 py-3 font-medium">تاریخ ثبت‌نام</th>
                <th className="px-4 py-3 font-medium">شارژ کیف پول</th>
                <th className="px-4 py-3 font-medium">پرداختی</th>
                <th className="px-4 py-3 font-medium">سرویس‌ها</th>
                <th className="px-4 py-3 font-medium">وضعیت احراز</th>
                <th className="px-4 py-3 font-medium">آخرین لاگین</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-16 text-center text-slate-400">
                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                    در حال دریافت کاربران…
                  </td>
                </tr>
              ) : null}

              {!loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-16 text-center text-slate-400">
                    کاربری با این فیلترها پیدا نشد.
                  </td>
                </tr>
              ) : null}

              {rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => setSelected(row)}
                  className={cn(
                    "cursor-pointer transition-colors hover:bg-slate-50/80",
                    row.verification_level === "full" && "bg-emerald-50/40",
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar row={row} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-medium text-slate-800">{row.display_name}</span>
                          {row.verification_level === "full" ? (
                            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                          ) : null}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
                          <span className="font-mono">#{row.id}</span>
                          {row.role !== "CUSTOMER" ? (
                            <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-indigo-600">
                              {row.role_label}
                            </span>
                          ) : null}
                          {!row.is_active ? (
                            <span className="rounded bg-rose-50 px-1.5 py-0.5 text-rose-600">غیرفعال</span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5 text-xs">
                      <span
                        className={cn(
                          "flex items-center gap-1.5",
                          row.email ? "text-slate-600" : "text-slate-300",
                        )}
                      >
                        <Mail className="h-3 w-3" />
                        {row.email || "ایمیل ندارد"}
                        {row.email && row.email_verified ? (
                          <BadgeCheck className="h-3 w-3 text-emerald-600" />
                        ) : null}
                      </span>
                      <span
                        className={cn(
                          "flex items-center gap-1.5",
                          row.mobile || row.phone ? "text-slate-600" : "text-slate-300",
                        )}
                      >
                        <Phone className="h-3 w-3" />
                        {row.mobile || row.phone || "شماره ندارد"}
                        {(row.mobile || row.phone) && row.mobile_verified ? (
                          <BadgeCheck className="h-3 w-3 text-emerald-600" />
                        ) : null}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={row.national_id ? "font-mono text-xs text-slate-600" : "text-xs text-slate-300"}>
                      {row.national_id || "—"}
                    </span>
                    {row.shahkar_verified ? (
                      <div className="mt-0.5 text-[10px] text-emerald-600">شاهکار</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                      {formatDate(row.created_at)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className={row.wallet_balance > 0 ? "font-medium text-violet-700" : "text-slate-400"}>
                      {formatToman(row.wallet_balance)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className={row.total_paid > 0 ? "font-medium text-emerald-700" : "text-slate-400"}>
                      {formatToman(row.total_paid)}
                    </span>
                    {row.last_payment_at ? (
                      <div className="mt-0.5 text-[10px] text-slate-400">{formatDate(row.last_payment_at)}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <ServiceBreakdown row={row} />
                  </td>
                  <td className="px-4 py-3">
                    <VerificationBadge row={row} compact />
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(row.last_login)}</td>
                  <td className="px-4 py-3 text-left">
                    <ChevronLeft className="h-4 w-4 text-slate-300" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
        <span>
          {formatNumber(count)} کاربر · صفحه {formatNumber(page)} از {formatNumber(pages || 1)}
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
            disabled={page >= (pages || 1) || loading}
            onClick={() => setPage((current) => current + 1)}
          >
            بعدی
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {selected ? (
        <CustomerDrawer customer={selected} onClose={() => setSelected(null)} />
      ) : null}
    </div>
  )
}

function MetaCard({
  title,
  value,
  note,
  icon: Icon,
  tone,
  highlight = false,
}: {
  title: string
  value: string
  note: string
  icon: React.ComponentType<{ className?: string }>
  tone: string
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-white p-4",
        highlight ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200",
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">{title}</p>
        <Icon className={cn("h-4 w-4", tone)} />
      </div>
      <p className={cn("mt-2 text-lg font-bold", highlight ? "text-emerald-700" : "text-slate-900")}>
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-slate-400">{note}</p>
    </div>
  )
}

function SectionCard({
  title,
  count,
  icon: Icon,
  children,
}: {
  title: string
  count?: number
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
        <Icon className="h-4 w-4 text-indigo-600" />
        {title}
        {typeof count === "number" ? (
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-normal text-slate-500">
            {formatNumber(count)}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  )
}

function CustomerDrawer({ customer, onClose }: { customer: CustomerRow; onClose: () => void }) {
  const [detail, setDetail] = useState<CustomerDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError("")
    api
      .get<CustomerDetail>(`/panel/customers/${customer.id}/`)
      .then(({ data }) => {
        if (alive) setDetail(data)
      })
      .catch((err) => {
        if (alive) setError(extractError(err))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [customer.id])

  const data = detail?.customer ?? customer

  return (
    <div className="fixed inset-0 z-40 flex justify-start bg-slate-900/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-3xl flex-col bg-slate-50 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white p-4">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar row={data} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-base font-bold text-slate-900">{data.display_name}</h2>
                <VerificationBadge row={data} compact />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                <span className="font-mono">#{data.id}</span>
                {data.username ? <span>{data.username}</span> : null}
                <span>ثبت‌نام {formatDate(data.created_at)}</span>
                <span>آخرین لاگین {formatDateTime(data.last_login)}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4 scrollbar-thin">
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MiniStat label="شارژ کیف پول" value={formatToman(data.wallet_balance)} tone="text-violet-700" />
            <MiniStat label="جمع پرداختی" value={formatToman(data.total_paid)} tone="text-emerald-700" />
            <MiniStat
              label="سرویس فعال"
              value={`${formatNumber(data.services_active)} از ${formatNumber(data.services_total)}`}
              tone="text-indigo-700"
            />
            <MiniStat label="سازمان‌ها" value={formatNumber(data.organizations_count)} tone="text-slate-800" />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <VerifyTile label="موبایل" verified={data.mobile_verified} value={data.mobile || data.phone || "—"} />
            <VerifyTile label="ایمیل" verified={data.email_verified} value={data.email || "—"} />
            <VerifyTile
              label="احراز هویت (کد ملی)"
              verified={data.shahkar_verified}
              value={data.national_id || "—"}
            />
          </div>

          {loading && !detail ? (
            <div className="flex justify-center py-10 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : null}

          {detail ? (
            <>
              <SectionCard title="سرویس‌های پلتفرم (PaaS)" count={detail.applications.length} icon={Cloud}>
                {detail.applications.length === 0 ? (
                  <Empty text="اپلیکیشنی روی پلتفرم ندارد." />
                ) : (
                  <div className="space-y-2">
                    {detail.applications.map((app) => (
                      <div
                        key={app.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-800">{app.name}</p>
                          <p className="text-[11px] text-slate-400">
                            {app.organization} / {app.project} · {formatDate(app.created_at)}
                          </p>
                        </div>
                        <StatusChip status={app.status} map={APP_STATUS} />
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard title="ماشین‌های هایوفلش" count={detail.vms.length} icon={Server}>
                {detail.vms.length === 0 ? (
                  <Empty text="ماشین ابری ندارد." />
                ) : (
                  <div className="space-y-2">
                    {detail.vms.map((vm) => (
                      <div
                        key={vm.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-800">{vm.name}</p>
                          <p className="text-[11px] text-slate-400">
                            {vm.plan} · {vm.ip_address || "بدون IP"} · {formatDate(vm.created_at)}
                          </p>
                        </div>
                        <StatusChip status={vm.status} map={VM_STATUS} />
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard title="اکانت‌های هایوگیت" count={detail.gate_accounts.length} icon={ShieldCheck}>
                {detail.gate_accounts.length === 0 ? (
                  <Empty text="اکانت تحریم‌شکن ندارد." />
                ) : (
                  <div className="space-y-2">
                    {detail.gate_accounts.map((account) => (
                      <div
                        key={account.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-800">{account.username}</p>
                          <p className="text-[11px] text-slate-400">
                            {account.package}
                            {account.usage_display ? ` · مصرف ${account.usage_display}` : ""}
                            {account.expired_at ? ` · انقضا ${formatDate(account.expired_at)}` : ""}
                          </p>
                        </div>
                        <StatusChip status={account.status} map={GATE_STATUS} />
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard title="پرداختی‌ها" count={detail.payments.length} icon={CreditCard}>
                {detail.payments.length === 0 ? (
                  <Empty text="پرداختی ثبت نشده است." />
                ) : (
                  <div className="space-y-2">
                    {detail.payments.map((payment) => (
                      <div
                        key={payment.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800">{formatToman(payment.amount)}</p>
                          <p className="text-[11px] text-slate-400">
                            {payment.gateway || "درگاه"} · {formatDateTime(payment.paid_at || payment.created_at)}
                            {payment.plan ? ` · ${payment.plan}` : ""}
                          </p>
                        </div>
                        <StatusChip status={payment.status} map={PAYMENT_STATUS} />
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard title="سازمان‌ها" count={detail.organizations.length} icon={Boxes}>
                {detail.organizations.length === 0 ? (
                  <Empty text="عضو هیچ سازمانی نیست." />
                ) : (
                  <div className="space-y-2">
                    {detail.organizations.map((org) => (
                      <div
                        key={org.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-800">{org.name}</p>
                          <p className="text-[11px] text-slate-400">
                            {org.slug} · {org.role === "owner" ? "مالک" : "عضو"} · {formatDate(org.created_at)}
                          </p>
                        </div>
                        <span className="text-xs text-violet-700">{formatToman(org.wallet_balance)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard title="اشتراک‌ها" count={detail.subscriptions.length} icon={CreditCard}>
                {detail.subscriptions.length === 0 ? (
                  <Empty text="اشتراکی ندارد." />
                ) : (
                  <div className="space-y-2">
                    {detail.subscriptions.map((sub) => (
                      <div
                        key={sub.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-800">{sub.plan}</p>
                          <p className="text-[11px] text-slate-400">
                            {sub.organization} · {formatDate(sub.started_at)}
                            {sub.ended_at ? ` → ${formatDate(sub.ended_at)}` : ""}
                          </p>
                        </div>
                        <span className="rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600">
                          {SUBSCRIPTION_STATUS[sub.status] ?? sub.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className={cn("mt-1 text-sm font-bold", tone)}>{value}</p>
    </div>
  )
}

function VerifyTile({ label, verified, value }: { label: string; verified: boolean; value: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        verified ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white",
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-slate-500">{label}</p>
        {verified ? (
          <BadgeCheck className="h-4 w-4 text-emerald-600" />
        ) : (
          <ShieldAlert className="h-4 w-4 text-slate-300" />
        )}
      </div>
      <p
        className={cn(
          "mt-1 truncate text-xs",
          verified ? "font-medium text-emerald-800" : "text-slate-600",
        )}
        title={value}
      >
        {value}
      </p>
      <p className={cn("mt-0.5 text-[10px]", verified ? "text-emerald-600" : "text-slate-400")}>
        {verified ? "تایید شده" : "تایید نشده"}
      </p>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-xs text-slate-400">{text}</p>
}
