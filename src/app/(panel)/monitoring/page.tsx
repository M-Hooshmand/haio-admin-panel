"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Activity,
  BadgeCheck,
  CalendarDays,
  CircleDot,
  Compass,
  Globe,
  Loader2,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface MonitoringUser {
  id: number
  username: string
  email: string
  display_name: string | null
  role: string
  mobile: string
  is_active: boolean
  is_staff: boolean
  last_seen: number | null
  last_seen_label: string
  is_online: boolean
  current_section: string
  current_path?: string
  section_last_seen: number | null
}

interface ActivitySnapshot {
  online: MonitoringUser[]
  today: MonitoringUser[]
  online_count: number
  today_count: number
  refreshed_at: string
  online_ttl_minutes: number
}

const ROLE_LABELS: Record<string, string> = {
  CUSTOMER: "مشتری",
  SUPPORT_AGENT: "کارشناس پشتیبانی",
  SUPPORT_MANAGER: "سرپرست پشتیبانی",
  ADMIN: "ادمین",
  SUPER_ADMIN: "ادمین ارشد",
  MANAGER: "مدیر",
  OFFICE: "اداری",
  SALES: "فروش",
  FINANCE: "مالی",
  TECHNICAL: "فنی",
}

const SECTION_LABELS: Record<string, string> = {
  dashboard: "داشبورد",
  users: "کاربران",
  organizations: "سازمان‌ها",
  subscriptions: "اشتراک‌ها",
  invoices: "فاکتورها",
  proforma: "پیش‌فاکتورها",
  haioflash: "هایوفلش",
  haiogate: "هایوگیت",
  monitoring: "مونیتورینگ کاربران",
  tickets: "تیکت‌ها",
  campaigns: "کمپین‌ها",
  reports: "گزارش‌ها",
  settings: "تنظیمات",
  // my.haio.ir (buyer panel) route groups
  projects: "پروژه‌ها",
  applications: "اپلیکیشن‌ها",
  environments: "محیط‌ها",
  deployments: "استقرارها",
  domains: "دامنه‌ها",
  billing: "حساب و قبوض",
  marketplace: "مارکت‌پلیس",
  notifications: "اعلان‌ها",
  profile: "پروفایل",
  slides: "اسلایدها",
  support: "پشتیبانی",
  invitations: "دعوت‌نامه‌ها",
}

const REFRESH_INTERVAL_MS = 30_000

function formatLastSeen(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return "—"
  if (seconds < 60) return "همین حالا"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} دقیقه پیش`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ساعت و ${minutes % 60} دقیقه پیش`
  const days = Math.floor(hours / 24)
  return `${days} روز پیش`
}

function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(iso))
  } catch {
    return ""
  }
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

function UserRow({
  user,
  online,
  onlineTtlMinutes,
}: {
  user: MonitoringUser
  online: boolean
  onlineTtlMinutes: number
}) {
  const name =
    user.display_name && user.display_name !== user.username
      ? user.display_name
      : user.username

  const sectionRaw = (user.current_section || "").trim()
  const sectionLabel = sectionRaw ? SECTION_LABELS[sectionRaw] ?? sectionRaw : null
  const sectionFresh =
    sectionLabel !== null &&
    user.section_last_seen !== null &&
    user.section_last_seen !== undefined &&
    online &&
    user.section_last_seen <= onlineTtlMinutes * 60

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-xl border p-3 transition-colors",
        online ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200 bg-white",
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold",
          online ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500",
        )}
      >
        {name.slice(0, 1)}
      </div>

      <div className="min-w-40 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("text-sm font-bold", online ? "text-emerald-900" : "text-slate-800")}>
            {name}
          </span>
          {user.is_staff ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
              <ShieldCheck className="h-3 w-3" />
              کادر
            </span>
          ) : null}
          {!user.is_active ? (
            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700">
              غیرفعال
            </span>
          ) : null}
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
            {ROLE_LABELS[user.role] ?? user.role}
          </span>
          {sectionLabel ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                sectionFresh
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-slate-100 text-slate-500",
              )}
              title={user.current_path || undefined}
            >
              <Compass className="h-3 w-3" />
              {sectionFresh ? `الان در: ${sectionLabel}` : `آخرین بخش: ${sectionLabel}`}
            </span>
          ) : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1">
            <UserRound className="h-3 w-3" />
            {user.username}
          </span>
          {user.email ? (
            <span className="inline-flex items-center gap-1">
              <Globe className="h-3 w-3" />
              {user.email}
            </span>
          ) : null}
          {user.mobile ? (
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {user.mobile}
            </span>
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          "flex items-center gap-1.5 text-xs font-medium",
          online ? "text-emerald-700" : "text-slate-500",
        )}
      >
        {online ? (
          <CircleDot className="h-3.5 w-3.5 animate-pulse" />
        ) : (
          <CalendarDays className="h-3.5 w-3.5" />
        )}
        {formatLastSeen(user.last_seen)}
      </div>
    </div>
  )
}

function UserList({
  users,
  name,
  icon,
  onlineTtlMinutes,
}: {
  users: MonitoringUser[]
  name: string
  icon: React.ReactNode
  onlineTtlMinutes: number
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-sm font-bold text-slate-900">{name}</h2>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
          {users.length}
        </span>
      </header>

      {users.length === 0 ? (
        <p className="py-6 text-center text-xs text-slate-400">هیچ کاربری یافت نشد.</p>
      ) : (
        <div className="space-y-2">
          {users.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              online={user.is_online}
              onlineTtlMinutes={onlineTtlMinutes}
            />
          ))}
        </div>
      )}
    </section>
  )
}

export default function MonitoringPage() {
  const [snapshot, setSnapshot] = useState<ActivitySnapshot | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [auto, setAuto] = useState(true)

  const load = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const { data } = await api.get<ActivitySnapshot>("/staff/monitoring/activity/")
      setSnapshot(data)
      setError(null)
    } catch (err) {
      setError(extractError(err))
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!auto) return
    const timer = setInterval(() => void load(), REFRESH_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [auto, load])

  const filter = useCallback((users: MonitoringUser[]): MonitoringUser[] => {
    const q = query.trim().toLowerCase()
    if (!q) return users
    return users.filter((user) =>
      [user.username, user.email, user.mobile, user.display_name]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q)),
    )
  }, [query])

  const online = useMemo(() => filter(snapshot?.online ?? []), [snapshot, filter])
  const today = useMemo(
    () => filter(snapshot?.today.filter((user) => !user.is_online) ?? []),
    [snapshot, filter],
  )

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between md:p-5">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="جست‌وجو بر اساس نام، ایمیل یا موبایل..."
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAuto((value) => !value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
              auto
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-white text-slate-500",
            )}
          >
            <Activity className={cn("h-3.5 w-3.5", auto && "animate-pulse")} />
            {auto ? `به‌روزرسانی خودکار (${REFRESH_INTERVAL_MS / 1000} ثانیه)` : "به‌روزرسانی خودکار خاموش"}
          </button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => void load()}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            بروزرسانی
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-medium text-emerald-700">حالا آنلاین</p>
          <p className="mt-1 text-2xl font-bold text-emerald-900">
            {isLoading ? "…" : snapshot?.online_count ?? 0}
            <span className="text-xs font-normal text-emerald-600"> کاربر</span>
          </p>
        </div>
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
          <p className="text-xs font-medium text-indigo-700">فعال امروز</p>
          <p className="mt-1 text-2xl font-bold text-indigo-900">
            {isLoading ? "…" : snapshot?.today_count ?? 0}
            <span className="text-xs font-normal text-indigo-600"> کاربر</span>
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">تعریف آنلاین</p>
          <p className="mt-1 text-sm text-slate-700">
            فعالیت در {snapshot?.online_ttl_minutes ?? 10} دقیقه اخیر
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            {snapshot?.refreshed_at ? `آخرین بروزرسانی: ${formatTime(snapshot.refreshed_at)}` : ""}
          </p>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex min-h-40 items-center justify-center rounded-2xl border border-slate-200 bg-white">
          <div className="flex flex-col items-center gap-2 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
            <p className="text-xs">در حال دریافت داده‌ها...</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <UserList
            users={online}
            name="حالا آنلاین"
            onlineTtlMinutes={snapshot?.online_ttl_minutes ?? 10}
            icon={
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                <CircleDot className="h-4 w-4" />
              </span>
            }
          />
          <UserList
            users={today}
            name="بقیه کاربران فعال امروز"
            onlineTtlMinutes={snapshot?.online_ttl_minutes ?? 10}
            icon={
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                <CalendarDays className="h-4 w-4" />
              </span>
            }
          />
        </div>
      )}

      {!isLoading ? (
        <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <BadgeCheck className="h-3.5 w-3.5" />
          داده‌ها از گزارش فعالیت زنده بک‌اند (admin monitoring) گرفته می‌شود.
        </p>
      ) : null}
    </div>
  )
}
