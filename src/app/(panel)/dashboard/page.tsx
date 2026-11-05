"use client"

import { useEffect, useState } from "react"
import { Activity, CheckCircle2, CircleDashed, Users } from "lucide-react"
import { api } from "@/lib/api"
import { useAuthStore } from "@/stores/auth-store"
import { PANEL_ROLE_LABELS, navItemsForRole } from "@/lib/roles"

export default function DashboardPage() {
  const { user, role } = useAuthStore()
  const [backendOk, setBackendOk] = useState<boolean | null>(null)

  useEffect(() => {
    api
      .get("/health/")
      .then(() => setBackendOk(true))
      .catch(() => setBackendOk(false))
  }, [])

  const items = navItemsForRole(role)
  const displayName =
    user?.display_name ||
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
    user?.username ||
    "کاربر"

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-gradient-to-l from-indigo-600 to-violet-600 p-6 text-white md:p-8">
        <p className="text-sm text-indigo-100">خوش آمدید</p>
        <h2 className="mt-1 text-2xl font-bold">{displayName}</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-indigo-100">
          این پنل فقط لایه نمایش است؛ همه داده‌ها از سرور مرکزی خوانده می‌شوند و
          همه عملیات در بک‌اند انجام می‌شود. دسترسی شما بر اساس نقش
          «{role ? PANEL_ROLE_LABELS[role] : "—"}» محدود شده است.
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="اتصال به بک‌اند"
          value={backendOk === null ? "در حال بررسی" : backendOk ? "برقرار" : "قطع"}
          icon={backendOk ? CheckCircle2 : CircleDashed}
          tone={backendOk ? "text-emerald-600" : "text-amber-600"}
        />
        <StatCard title="نقش شما" value={role ? PANEL_ROLE_LABELS[role] : "—"} icon={Users} />
        <StatCard title="بخش‌های در دسترس" value={`${items.length} بخش`} icon={Activity} />
        <StatCard title="وضعیت" value="آماده اتصال داده" icon={CircleDashed} tone="text-slate-500" />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-bold text-slate-900">بخش‌های قابل دسترس شما</h3>
        <p className="mt-1 text-xs text-slate-500">
          محتوای هر بخش پس از تأیید ساختار توسط شما به داده‌های واقعی متصل می‌شود.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div key={item.key} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-800">{item.title}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function StatCard({
  title,
  value,
  icon: Icon,
  tone = "text-indigo-600",
}: {
  title: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  tone?: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">{title}</p>
        <Icon className={`h-4 w-4 ${tone}`} />
      </div>
      <p className="mt-3 text-lg font-bold text-slate-900">{value}</p>
    </div>
  )
}
