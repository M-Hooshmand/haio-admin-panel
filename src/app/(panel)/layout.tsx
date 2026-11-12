"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  Cpu,
  CreditCard,
  LayoutDashboard,
  Loader2,
  LogOut,
  Megaphone,
  Menu,
  ReceiptText,
  FileText,
  Server,
  Settings,
  ShieldAlert,
  Sparkles,
  ShieldCheck,
  Ticket,
  Users,
  X,
} from "lucide-react"
import { useAuthStore } from "@/stores/auth-store"
import { NAV_ITEMS, PANEL_ROLE_LABELS, navItemsForUser } from "@/lib/roles"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  users: Users,
  organizations: Building2,
  subscriptions: CreditCard,
  invoices: ReceiptText,
  proforma: FileText,
  dedicated: Server,
  haioflash: Cpu,
  haiogate: ShieldCheck,
  tickets: Ticket,
  campaigns: Megaphone,
  monitoring: Activity,
  notifications: Bell,
  assistant: Sparkles,
  reports: BarChart3,
  settings: Settings,
}

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const { user, role, isLoading, isAuthenticated, bootstrap, logout } = useAuthStore()

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/login")
  }, [isLoading, isAuthenticated, router])

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  // Navigation audit is stored by the backend; this only reports the section.
  const lastVisited = useRef("")
  useEffect(() => {
    if (!isAuthenticated || !pathname || lastVisited.current === pathname) return
    lastVisited.current = pathname
    const section = pathname.split("/")[1] || "dashboard"
    void api.post("/panel/visit/", { section, path: pathname }).catch(() => undefined)
  }, [pathname, isAuthenticated])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
          <p className="text-sm">در حال بررسی دسترسی...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) return null

  const items = navItemsForUser(user)

  if (!role) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <ShieldAlert className="mx-auto h-10 w-10 text-amber-500" />
          <h1 className="mt-4 text-lg font-bold text-slate-900">دسترسی به پنل ندارید</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            حساب شما نقش کارکنان را ندارد. برای دریافت دسترسی با مدیر سیستم تماس بگیرید.
          </p>
          <Button variant="outline" className="mt-6 w-full" onClick={logout}>
            خروج از حساب
          </Button>
        </div>
      </div>
    )
  }

  const activeItem = NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  )
  const displayName =
    user?.display_name ||
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
    user?.username ||
    user?.mobile ||
    "کاربر"

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-300">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-bold text-white">پنل مدیریت هایو</p>
          <p className="text-[11px] text-slate-400">Staff Control Panel</p>
        </div>
      </div>

      <nav className="scrollbar-thin flex-1 space-y-1 overflow-y-auto p-3">
        {items.map((item) => {
          const Icon = ICONS[item.key] ?? LayoutDashboard
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-indigo-500/15 font-medium text-white"
                  : "text-slate-300 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon className={cn("h-4.5 w-4.5", active ? "text-indigo-300" : "text-slate-400")} />
              {item.title}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="rounded-xl bg-white/5 p-3">
          <p className="truncate text-sm font-medium text-white">{displayName}</p>
          <p className="mt-0.5 text-[11px] text-indigo-300">{PANEL_ROLE_LABELS[role]}</p>
        </div>
        <button
          onClick={logout}
          className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          خروج
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 right-0 z-40 hidden w-64 bg-slate-900 lg:block">
        {sidebar}
      </aside>

      {menuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMenuOpen(false)} />
          <aside className="absolute inset-y-0 right-0 w-72 bg-slate-900">
            <button
              className="absolute left-3 top-4 rounded-lg p-1 text-slate-400 hover:text-white"
              onClick={() => setMenuOpen(false)}
              aria-label="بستن منو"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      ) : null}

      <div className="lg:pr-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur md:px-6">
          <div className="flex items-center gap-3">
            <button
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
              onClick={() => setMenuOpen(true)}
              aria-label="باز کردن منو"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-sm font-bold text-slate-900 md:text-base">
                {activeItem?.title ?? "پنل مدیریت"}
              </h1>
              <p className="hidden text-xs text-slate-500 md:block">
                {activeItem?.description ?? "مدیریت و پشتیبانی هایوکلود"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 sm:inline">
              {PANEL_ROLE_LABELS[role]}
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
              {displayName.slice(0, 1)}
            </div>
          </div>
        </header>

        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
