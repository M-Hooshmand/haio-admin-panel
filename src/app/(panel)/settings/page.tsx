"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Activity,
  CheckCircle2,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserCog,
  UsersRound,
} from "lucide-react"
import { api } from "@/lib/api"
import { NAV_ITEMS, PANEL_ROLE_LABELS, type PanelRole } from "@/lib/roles"
import { useAuthStore } from "@/stores/auth-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type Tab = "password" | "users" | "activity"

interface PanelUserRow {
  id: number
  username?: string | null
  email?: string | null
  mobile?: string | null
  display_name?: string
  panel_role?: PanelRole | null
  effective_role?: PanelRole | null
  role?: string
  is_active?: boolean
  last_login?: string | null
}

interface ActivityRow {
  id: number
  user: string
  username?: string | null
  email?: string | null
  action: string
  action_label: string
  section: string
  path: string
  ip?: string | null
  created_at: string
}

const ACTION_LABELS: Record<string, string> = {
  login: "ورود به پنل",
  visit: "بازدید بخش",
  password_change: "تغییر رمز",
  user_create: "ایجاد کاربر",
  user_update: "ویرایش کاربر",
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

function formatTime(value?: string | null): string {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("fa-IR", { dateStyle: "short", timeStyle: "medium" })
}

export default function SettingsPage() {
  const { role } = useAuthStore()
  const [tab, setTab] = useState<Tab>("password")

  if (role !== "MANAGER") {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        این بخش فقط برای مدیر پنل قابل دسترسی است.
      </div>
    )
  }

  const tabs: { key: Tab; label: string; icon: typeof KeyRound }[] = [
    { key: "password", label: "تغییر رمز عبور", icon: KeyRound },
    { key: "users", label: "کاربران پنل", icon: UsersRound },
    { key: "activity", label: "لاگ ورود و بازدید", icon: Activity },
  ]

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-2">
        <div className="flex flex-wrap gap-1">
          {tabs.map((item) => {
            const Icon = item.icon
            const active = tab === item.key
            return (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-indigo-50 font-medium text-indigo-700"
                    : "text-slate-600 hover:bg-slate-50",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            )
          })}
        </div>
      </div>

      {tab === "password" ? <PasswordTab /> : null}
      {tab === "users" ? <UsersTab /> : null}
      {tab === "activity" ? <ActivityTab /> : null}
    </div>
  )
}

function PasswordTab() {
  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError("")
    setDone(false)
    if (newPassword.length < 8) {
      setError("رمز جدید باید حداقل ۸ کاراکتر باشد.")
      return
    }
    if (newPassword !== confirm) {
      setError("تکرار رمز جدید مطابقت ندارد.")
      return
    }
    setSaving(true)
    try {
      await api.post("/panel/password/change/", {
        old_password: oldPassword,
        new_password: newPassword,
      })
      setOldPassword("")
      setNewPassword("")
      setConfirm("")
      setDone(true)
    } catch (err) {
      setError(extractError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      className="max-w-xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6"
    >
      <div>
        <h2 className="text-base font-bold text-slate-900">تغییر رمز عبور</h2>
        <p className="mt-1 text-xs text-slate-500">
          رمز جدید در بک‌اند (Django) ذخیره می‌شود و بلافاصله اعمال می‌گردد.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">رمز فعلی</label>
        <Input
          type="password"
          value={oldPassword}
          onChange={(event) => setOldPassword(event.target.value)}
          required
          autoComplete="current-password"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">رمز جدید</label>
        <Input
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">تکرار رمز جدید</label>
        <Input
          type="password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          required
          autoComplete="new-password"
        />
      </div>

      {error ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      {done ? (
        <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> رمز عبور با موفقیت تغییر کرد.
        </p>
      ) : null}

      <Button type="submit" disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
        ذخیره رمز جدید
      </Button>
    </form>
  )
}

function UsersTab() {
  const [rows, setRows] = useState<PanelUserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [newRole, setNewRole] = useState<PanelRole>("OFFICE")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const { data } = await api.get<{ results: PanelUserRow[] }>("/panel/users/")
      setRows(data.results ?? [])
    } catch (err) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const createUser = async (event: React.FormEvent) => {
    event.preventDefault()
    setCreating(true)
    setError("")
    setMessage("")
    try {
      await api.post("/panel/users/", {
        email: email.trim(),
        password,
        panel_role: newRole,
        first_name: firstName,
        last_name: lastName,
      })
      setEmail("")
      setPassword("")
      setFirstName("")
      setLastName("")
      setMessage("کاربر پنل ساخته شد.")
      await load()
    } catch (err) {
      setError(extractError(err))
    } finally {
      setCreating(false)
    }
  }

  const updateUser = async (id: number, payload: Record<string, unknown>) => {
    setError("")
    setMessage("")
    try {
      await api.patch(`/panel/users/${id}/`, payload)
      setMessage("تغییرات ذخیره شد.")
      await load()
    } catch (err) {
      setError(extractError(err))
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={createUser} className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-2">
          <Plus className="h-4 w-4 text-indigo-600" />
          <h2 className="text-base font-bold text-slate-900">افزودن کاربر پنل</h2>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          کاربر با ایمیل و رمز وارد می‌شود؛ نقش او سطح دسترسی را در بک‌اند تعیین می‌کند.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">ایمیل</label>
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              placeholder="name@haio.ir"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">رمز عبور</label>
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              placeholder="حداقل ۸ کاراکتر"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">نام</label>
            <Input value={firstName} onChange={(event) => setFirstName(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">نام خانوادگی</label>
            <Input value={lastName} onChange={(event) => setLastName(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">نقش</label>
            <select
              value={newRole}
              onChange={(event) => setNewRole(event.target.value as PanelRole)}
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-indigo-500"
            >
              {Object.entries(PANEL_ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <Button type="submit" disabled={creating}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCog className="h-4 w-4" />}
            ساخت کاربر
          </Button>
        </div>
      </form>

      {error ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      {message ? (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-bold text-slate-900">کاربران دارای دسترسی پنل</h2>
          <button
            onClick={() => void load()}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> به‌روزرسانی
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">کاربر</th>
                <th className="px-4 py-3 font-medium">ایمیل</th>
                <th className="px-4 py-3 font-medium">نقش پنل</th>
                <th className="px-4 py-3 font-medium">آخرین ورود</th>
                <th className="px-4 py-3 font-medium">وضعیت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">
                      {row.display_name || row.username || row.email}
                    </p>
                    <p className="text-[11px] text-slate-400">#{row.id}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{row.email || "—"}</td>
                  <td className="px-4 py-3">
                    <select
                      value={row.effective_role ?? row.panel_role ?? ""}
                      onChange={(event) =>
                        void updateUser(row.id, { panel_role: event.target.value })
                      }
                      className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs"
                    >
                      {Object.entries(PANEL_ROLE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{formatTime(row.last_login)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => void updateUser(row.id, { is_active: !row.is_active })}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[11px]",
                        row.is_active
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500",
                      )}
                    >
                      {row.is_active ? "فعال" : "غیرفعال"}
                    </button>
                  </td>
                </tr>
              ))}
              {!rows.length && !loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">
                    کاربری یافت نشد.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function ActivityTab() {
  const [rows, setRows] = useState<ActivityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<{ results: ActivityRow[] }>("/panel/activity/", {
        params: { limit: 100 },
      })
      setRows(data.results ?? [])
      setLastUpdate(new Date())
      setError("")
    } catch (err) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 5000)
    return () => window.clearInterval(timer)
  }, [load])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-sm font-medium text-slate-800">لاگ زنده</span>
          <span className="text-xs text-slate-400">هر ۵ ثانیه به‌روزرسانی می‌شود</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>آخرین به‌روزرسانی: {lastUpdate ? lastUpdate.toLocaleTimeString("fa-IR") : "—"}</span>
          <button
            onClick={() => void load()}
            className="flex items-center gap-1 hover:text-indigo-600"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> اکنون
          </button>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">زمان</th>
                <th className="px-4 py-3 font-medium">کاربر</th>
                <th className="px-4 py-3 font-medium">رویداد</th>
                <th className="px-4 py-3 font-medium">بخش</th>
                <th className="px-4 py-3 font-medium">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                    {formatTime(row.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{row.user}</p>
                    <p className="text-[11px] text-slate-400">{row.email || row.username || ""}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[11px]",
                        row.action === "login"
                          ? "bg-indigo-50 text-indigo-700"
                          : row.action === "visit"
                            ? "bg-slate-100 text-slate-600"
                            : "bg-amber-50 text-amber-700",
                      )}
                    >
                      {ACTION_LABELS[row.action] ?? row.action_label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {NAV_ITEMS.find((item) => item.key === row.section)?.title || row.section || "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{row.ip || "—"}</td>
                </tr>
              ))}
              {!rows.length && !loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">
                    هنوز رویدادی ثبت نشده است.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
        <ShieldCheck className="h-3.5 w-3.5" /> ثبت رویدادها در بک‌اند انجام می‌شود؛ این صفحه فقط
        نمایش می‌دهد.
      </p>
    </div>
  )
}
