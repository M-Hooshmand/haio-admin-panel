"use client"

import { useParams } from "next/navigation"
import { Construction, ShieldAlert } from "lucide-react"
import { NAV_ITEMS, PANEL_ROLE_LABELS } from "@/lib/roles"
import { useAuthStore } from "@/stores/auth-store"

export default function SectionPage() {
  const params = useParams<{ section: string | string[] }>()
  const section = Array.isArray(params.section) ? params.section[0] : params.section
  const { role } = useAuthStore()
  const item = NAV_ITEMS.find((entry) => entry.href === `/${section}`)

  if (!item) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
        <Construction className="mx-auto h-8 w-8 text-slate-400" />
        <p className="mt-3 text-sm text-slate-600">این بخش پیدا نشد.</p>
      </div>
    )
  }

  const allowed = role ? item.roles.includes(role) : false

  if (!allowed) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
        <ShieldAlert className="mx-auto h-8 w-8 text-amber-500" />
        <h2 className="mt-3 text-sm font-bold text-amber-900">دسترسی محدود</h2>
        <p className="mt-2 text-sm text-amber-800">
          این بخش برای نقش شما ({role ? PANEL_ROLE_LABELS[role] : "نامشخص"}) در دسترس نیست.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 md:p-10">
      <div className="mx-auto max-w-xl text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
          <Construction className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-lg font-bold text-slate-900">{item.title}</h2>
        <p className="mt-2 text-sm leading-7 text-slate-500">{item.description}</p>
        <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-xs leading-6 text-slate-500">
          بدنه این بخش آماده است. پس از مشخص‌کردن تب‌ها و فیلدهای موردنیاز، داده‌ها از
          API بک‌اند به این صفحه متصل می‌شوند.
        </p>
      </div>
    </div>
  )
}
