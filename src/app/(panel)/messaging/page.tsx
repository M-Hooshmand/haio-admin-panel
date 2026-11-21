"use client"

import Link from "next/link"
import { ArrowLeft, MessageSquare, ShieldCheck, Wallet } from "lucide-react"

const PROVIDERS = [
  {
    key: "melipayamak",
    href: "/messaging/melipayamak",
    title: "ملی‌پیامک",
    description: "موجودی پیامک و ریالی، پیامک‌های ارسالی/دریافتی و وضعیت تحویل هر پیام",
    features: ["موجودی لحظه‌ای", "وضعیت دلیور هر پیام", "هشدار خودکار شارژ کم"],
    active: true,
  },
]

export default function MessagingPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <MessageSquare className="h-4 w-4 text-indigo-600" />
          سامانه‌های پیامکی
        </h2>
        <p className="mt-1 text-xs leading-6 text-slate-500">
          وضعیت سامانه‌های ارسال پیامک هایو در یک نگاه؛ بدون ورود جداگانه به پنل هر ارائه‌دهنده.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {PROVIDERS.map((provider) => (
          <Link
            key={provider.key}
            href={provider.href}
            className="group rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-indigo-300 hover:bg-indigo-50/30"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <MessageSquare className="h-5 w-5" />
              </div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                متصل
              </span>
            </div>
            <h3 className="mt-3 text-sm font-bold text-slate-900">{provider.title}</h3>
            <p className="mt-1 text-xs leading-6 text-slate-500">{provider.description}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {provider.features.map((feature) => (
                <span
                  key={feature}
                  className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] text-slate-600"
                >
                  {feature}
                </span>
              ))}
            </div>
            <span className="mt-4 flex items-center gap-1 text-xs font-medium text-indigo-600">
              ورود به گزارش
              <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <Wallet className="h-4 w-4 text-indigo-600" />
            هشدار شارژ کم
          </p>
          <p className="mt-1 text-xs leading-6 text-slate-500">
            هر ۱۵ دقیقه موجودی ریالی ملی‌پیامک بررسی می‌شود؛ اگر زیر ۱۰۰ هزار تومان برسد، پیام
            هشدار در گروه بله هایو ارسال می‌شود.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <ShieldCheck className="h-4 w-4 text-indigo-600" />
            دسترسی
          </p>
          <p className="mt-1 text-xs leading-6 text-slate-500">
            این گزارش فقط با نقش مدیریتی، اداری یا فنی باز می‌شود و داده‌ها مستقیم از API
            ارائه‌دهنده خوانده می‌شوند.
          </p>
        </div>
      </div>
    </div>
  )
}
