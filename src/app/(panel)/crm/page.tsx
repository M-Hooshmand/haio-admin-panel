"use client"

import { useCallback, useEffect, useState } from "react"
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Loader2,
  Phone,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  StickyNote,
  Users,
} from "lucide-react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { CustomerDrawer } from "./customer-drawer"
import {
  type CrmMeta,
  type CustomerRow,
  type Dashboard,
  type FollowUp,
  type SegmentPage,
  type TabKey,
  SEGMENT_TABS,
  extractError,
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
} from "./types"

const PAGE_SIZE = 25

const TAB_TONES: Record<TabKey, string> = {
  today: "border-indigo-200 bg-indigo-50 text-indigo-700",
  first_buyer: "border-emerald-200 bg-emerald-50 text-emerald-700",
  renewer: "border-sky-200 bg-sky-50 text-sky-700",
  abandoned: "border-rose-200 bg-rose-50 text-rose-700",
  ticketed: "border-amber-200 bg-amber-50 text-amber-700",
  archive: "border-slate-200 bg-slate-100 text-slate-700",
}

function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: React.ReactNode
  hint?: string
  tone: "indigo" | "emerald" | "rose" | "slate"
}) {
  const styles = {
    indigo: "border-indigo-200 bg-indigo-50 text-indigo-900",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
    rose: "border-rose-200 bg-rose-50 text-rose-900",
    slate: "border-slate-200 bg-white text-slate-900",
  }[tone]
  return (
    <div className={cn("rounded-2xl border p-4", styles)}>
      <p className="text-[11px] font-medium opacity-70">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
      {hint ? <p className="mt-0.5 text-[10px] opacity-60">{hint}</p> : null}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-10 text-center">
      <p className="text-xs text-slate-400">{text}</p>
    </div>
  )
}

function CallCard({
  item,
  rank,
  busy,
  onOpen,
  onSnooze,
}: {
  item: FollowUp
  rank: number
  busy: boolean
  onOpen: () => void
  onSnooze: (days: number) => void
}) {
  const firstTime = item.meta?.first_time === true
  const isAbandoned = item.kind === "abandoned_invoice"
  const attempts = Number(item.meta?.attempts ?? item.invoice?.attempts ?? 0)
  return (
    <div
      className={cn(
        "rounded-2xl border bg-white p-4 transition-shadow hover:shadow-sm",
        isAbandoned && firstTime
          ? "border-rose-200"
          : isAbandoned
            ? "border-amber-200"
            : "border-slate-200",
      )}
    >
      <div className="flex gap-3">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold",
            isAbandoned && firstTime
              ? "bg-rose-100 text-rose-700"
              : isAbandoned
                ? "bg-amber-100 text-amber-700"
                : "bg-sky-100 text-sky-700",
          )}
        >
          {formatNumber(rank)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-bold text-slate-900">{item.customer.display_name}</p>
            {isAbandoned ? (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-medium",
                  firstTime
                    ? "bg-rose-50 text-rose-700"
                    : "bg-amber-50 text-amber-700",
                )}
              >
                {firstTime ? "اولین خرید" : "خرید مجدد"}
              </span>
            ) : (
              <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700">
                {item.kind_label}
              </span>
            )}
            {item.customer.mobile ? (
              <a
                href={`tel:${item.customer.mobile}`}
                dir="ltr"
                className="mr-auto inline-flex items-center gap-1 text-sm font-bold text-indigo-700 hover:underline"
              >
                <Phone className="h-3.5 w-3.5" />
                {item.customer.mobile}
              </a>
            ) : (
              <span className="mr-auto text-[10px] text-rose-600">شماره ندارد</span>
            )}
          </div>

          {item.invoice ? (
            <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 px-3 py-2 text-[11px] sm:grid-cols-4">
              <div>
                <p className="text-[10px] text-slate-400">محصول</p>
                <p className="font-medium text-slate-800">{item.invoice.product}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400">مبلغ</p>
                <p className="font-medium text-slate-800">{formatMoney(item.invoice.amount)}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400">رفتن به درگاه</p>
                <p className={cn("font-medium", attempts ? "text-rose-700" : "text-slate-500")}>
                  {attempts ? `${formatNumber(attempts)} بار` : "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400">تاریخ فاکتور</p>
                <p className="font-medium text-slate-800">{formatDate(item.invoice.created_at)}</p>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-xs leading-5 text-slate-700">{item.reason}</p>
          )}

          {item.invoice ? (
            <p className="mt-1.5 line-clamp-2 text-[11px] leading-5 text-slate-500">{item.reason}</p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {item.customer.mobile ? (
              <a
                href={`tel:${item.customer.mobile}`}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-[11px] font-medium text-white hover:bg-indigo-700"
              >
                <Phone className="h-3.5 w-3.5" />
                تماس
              </a>
            ) : null}
            <Button size="sm" variant="outline" className="h-8 gap-1" onClick={onOpen}>
              <StickyNote className="h-3.5 w-3.5" />
              پرونده و ثبت نتیجه
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-[11px] text-slate-500"
              disabled={busy}
              onClick={() => onSnooze(7)}
            >
              ۱ هفته بعد
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SegmentTable({
  rows,
  onOpen,
}: {
  rows: CustomerRow[]
  onOpen: (id: number) => void
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full min-w-[900px] text-xs">
        <thead className="border-b border-slate-200 bg-slate-50 text-[11px] text-slate-500">
          <tr>
            <th className="px-3 py-2.5 text-right font-medium">مشتری</th>
            <th className="px-3 py-2.5 text-right font-medium">دلیل دسته</th>
            <th className="px-3 py-2.5 text-right font-medium">خرید / پرداخت</th>
            <th className="px-3 py-2.5 text-right font-medium">رهاشده</th>
            <th className="px-3 py-2.5 text-right font-medium">تیکت</th>
            <th className="px-3 py-2.5 text-right font-medium">شرح حال</th>
            <th className="px-3 py-2.5 text-right font-medium">آخرین تماس</th>
            <th className="px-3 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr
              key={row.id}
              className="cursor-pointer transition-colors hover:bg-indigo-50/40"
              onClick={() => onOpen(row.id)}
            >
              <td className="px-3 py-2.5">
                <p className="font-bold text-slate-900">{row.display_name}</p>
                <p dir="ltr" className="text-[10px] text-slate-500">
                  {row.mobile || row.email || "—"}
                </p>
                {row.do_not_call ? (
                  <span className="mt-1 inline-block rounded-full bg-rose-50 px-1.5 py-0.5 text-[9px] text-rose-700">
                    تماس نگیرید
                  </span>
                ) : null}
              </td>
              <td className="max-w-[240px] px-3 py-2.5 text-[11px] leading-5 text-slate-600">
                {row.segment_reason}
                {row.tags.length ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {row.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </td>
              <td className="px-3 py-2.5">
                <p className="font-medium text-slate-800">{formatMoney(row.total_paid)}</p>
                <p className="text-[10px] text-slate-500">
                  {row.paid_count} خرید · {formatDate(row.last_paid_at)}
                </p>
              </td>
              <td className="px-3 py-2.5">
                <p className={cn("font-medium", row.abandoned_count ? "text-rose-700" : "text-slate-400")}>
                  {row.abandoned_count ? formatMoney(row.abandoned_value) : "—"}
                </p>
                <p className="text-[10px] text-slate-500">
                  {row.abandoned_count ? `${row.abandoned_count} فاکتور` : "ندارد"}
                </p>
              </td>
              <td className="px-3 py-2.5">
                <p className="font-medium text-slate-800">{formatNumber(row.ticket_count)}</p>
                <p className="text-[10px] text-slate-500">
                  {row.open_ticket_count ? `${row.open_ticket_count} باز` : "بسته"}
                </p>
              </td>
              <td className="max-w-[220px] px-3 py-2.5">
                {row.persona ? (
                  <p className="line-clamp-2 text-[11px] leading-5 text-amber-800">{row.persona}</p>
                ) : (
                  <span className="text-[10px] text-slate-400">ثبت نشده — کلیک کنید</span>
                )}
              </td>
              <td className="px-3 py-2.5 text-[10px] text-slate-500">
                {row.last_contacted_at ? formatDate(row.last_contacted_at) : "—"}
                {row.last_contact_outcome ? (
                  <p className="text-[9px] text-slate-400">{row.last_contact_outcome}</p>
                ) : null}
              </td>
              <td className="px-3 py-2.5 text-left">
                <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-[11px]">
                  <ChevronLeft className="h-3.5 w-3.5" />
                  پرونده
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? (
        <p className="py-10 text-center text-xs text-slate-400">موردی در این دسته نیست.</p>
      ) : null}
    </div>
  )
}

export default function CrmPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [meta, setMeta] = useState<CrmMeta | null>(null)
  const [tab, setTab] = useState<TabKey>("today")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState("")
  const [appliedSearch, setAppliedSearch] = useState("")
  const [page, setPage] = useState(1)
  const [segment, setSegment] = useState<SegmentPage | null>(null)
  const [archiveStatus, setArchiveStatus] = useState<"snoozed" | "done" | "canceled">("snoozed")
  const [archive, setArchive] = useState<{ rows: FollowUp[]; total: number } | null>(null)

  const [drawerCustomer, setDrawerCustomer] = useState<number | null>(null)
  const [drawerFollowup, setDrawerFollowup] = useState<string | null>(null)

  const loadDashboard = useCallback(async () => {
    try {
      const { data } = await api.get<Dashboard>("/panel/crm/dashboard/")
      setDashboard(data)
      setError(null)
    } catch (err) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  const loadMeta = useCallback(async () => {
    try {
      const { data } = await api.get<CrmMeta>("/panel/crm/meta/")
      setMeta(data)
    } catch {
      /* meta is optional for rendering */
    }
  }, [])

  const loadTab = useCallback(async () => {
    setBusy(true)
    try {
      if (tab === "first_buyer" || tab === "renewer" || tab === "abandoned" || tab === "ticketed") {
        const { data } = await api.get<SegmentPage>(`/panel/crm/segments/${tab}/`, {
          params: { search: appliedSearch, page, page_size: PAGE_SIZE },
        })
        setSegment(data)
      } else if (tab === "archive") {
        const { data } = await api.get<{ rows: FollowUp[]; total: number }>("/panel/crm/followups/", {
          params: { status: archiveStatus, page, page_size: PAGE_SIZE },
        })
        setArchive(data)
      }
      setError(null)
    } catch (err) {
      setError(extractError(err))
    } finally {
      setBusy(false)
    }
  }, [tab, appliedSearch, page, archiveStatus])

  useEffect(() => {
    void loadDashboard()
    void loadMeta()
  }, [loadDashboard, loadMeta])

  useEffect(() => {
    setPage(1)
  }, [tab, archiveStatus])

  useEffect(() => {
    if (tab !== "today") void loadTab()
  }, [tab, loadTab])

  const refreshAll = useCallback(async () => {
    await Promise.all([loadDashboard(), tab === "today" ? Promise.resolve() : loadTab()])
  }, [loadDashboard, loadTab, tab])

  const snooze = async (item: FollowUp, days: number) => {
    setBusy(true)
    try {
      await api.post(`/panel/crm/followups/${item.id}/snooze/`, { days })
      await refreshAll()
    } catch (err) {
      setError(extractError(err))
    } finally {
      setBusy(false)
    }
  }

  const reopen = async (item: FollowUp) => {
    setBusy(true)
    try {
      await api.post(`/panel/crm/followups/${item.id}/reopen/`)
      await refreshAll()
    } catch (err) {
      setError(extractError(err))
    } finally {
      setBusy(false)
    }
  }

  const syncNow = async () => {
    setBusy(true)
    try {
      await api.post("/panel/crm/followups/sync/", {})
      await refreshAll()
    } catch (err) {
      setError(extractError(err))
    } finally {
      setBusy(false)
    }
  }

  const openCustomer = (id: number, followupId: string | null = null) => {
    setDrawerCustomer(id)
    setDrawerFollowup(followupId)
  }

  const tabCount = (key: TabKey): number | null => {
    if (!dashboard) return null
    if (key === "today") return dashboard.counts.due_today
    if (key === "archive") return dashboard.counts.snoozed
    return dashboard.segments[key] ?? 0
  }

  const today = dashboard?.today ?? []
  const abandonedCalls = today.filter((item) => item.kind === "abandoned_invoice")
  const renewalCalls = today.filter((item) => item.kind !== "abandoned_invoice")

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between md:p-5">
        <div>
          <h1 className="text-sm font-bold text-slate-900">پیگیری مشتریان</h1>
          <p className="mt-0.5 text-[11px] text-slate-500">
            اولویت تماس: فاکتور رهاشده در درگاه، سپس تمدید. خریداران اول فقط در تب خودشان برای آمار هستند.
            {dashboard?.generated_at ? ` · آخرین به‌روزرسانی: ${formatDateTime(dashboard.generated_at)}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void refreshAll()} disabled={busy}>
            <RefreshCw className={cn("h-4 w-4", busy && "animate-spin")} />
            بروزرسانی
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => void syncNow()} disabled={busy}>
            <Sparkles className="h-4 w-4" />
            ساخت مجدد لیست
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          tone="indigo"
          label="تماس امروز"
          value={`${formatNumber(dashboard?.counts.due_today ?? 0)} نفر`}
          hint={
            dashboard?.counts.overdue
              ? `${formatNumber(dashboard.counts.overdue)} مورد عقب‌افتاده`
              : "همه در موعد"
          }
        />
        <StatCard
          tone="emerald"
          label="امروز انجام شد"
          value={`${formatNumber(dashboard?.counts.done_today ?? 0)} تماس`}
          hint={`${formatNumber(dashboard?.counts.done_week ?? 0)} تماس در ۷ روز`}
        />
        <StatCard
          tone="rose"
          label="ارزش فاکتورهای رهاشده"
          value={formatMoney(dashboard?.kpis.abandoned_value_30d ?? 0)}
          hint={`${formatNumber(dashboard?.kpis.abandoned_count_30d ?? 0)} فاکتور در ۳۰ روز`}
        />
        <StatCard
          tone="slate"
          label="بازگشت پس از تماس"
          value={formatMoney(dashboard?.kpis.recovered_value_7d ?? 0)}
          hint={`${formatNumber(dashboard?.kpis.recovered_count_7d ?? 0)} فاکتور در ۷ روز`}
        />
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {SEGMENT_TABS.map((item) => {
          const active = tab === item.key
          const count = tabCount(item.key)
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-colors",
                active
                  ? TAB_TONES[item.key]
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
              )}
            >
              {item.label}
              {count !== null ? (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px]",
                    active ? "bg-white/70" : "bg-slate-100 text-slate-500",
                  )}
                >
                  {formatNumber(count)}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      {tab === "today" ? (
        <div className="space-y-4">
          {loading ? (
            <div className="flex min-h-40 items-center justify-center rounded-2xl border border-slate-200 bg-white">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
            </div>
          ) : (
            <>
              <section className="space-y-3">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                      <Phone className="h-4 w-4 text-indigo-600" />
                      لیست تماس امروز
                    </h2>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      فقط اولویت‌ها: اول کسانی که به درگاه رفتند و پول ندادند، بعد تمدیدکننده‌ها.
                    </p>
                  </div>
                  <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700">
                    {formatNumber(today.length)} شماره
                  </span>
                </div>

                {today.length === 0 ? (
                  <Empty text="برای امروز موردی نیست. لیست را دوباره بسازید یا فردا سر بزنید." />
                ) : (
                  <div className="space-y-5">
                    {abandonedCalls.length ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-rose-500" />
                          <h3 className="text-xs font-bold text-slate-800">
                            اولویت ۱ — رفتند درگاه و پرداخت نکردند
                          </h3>
                          <span className="text-[10px] text-slate-400">
                            {formatNumber(abandonedCalls.length)} نفر
                          </span>
                        </div>
                        <div className="grid gap-2 xl:grid-cols-2">
                          {abandonedCalls.map((item, index) => (
                            <CallCard
                              key={item.id}
                              item={item}
                              rank={index + 1}
                              busy={busy}
                              onOpen={() => openCustomer(item.customer.id, item.id)}
                              onSnooze={(days) => void snooze(item, days)}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {renewalCalls.length ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-sky-500" />
                          <h3 className="text-xs font-bold text-slate-800">
                            اولویت ۲ — تمدید کرده‌اند (تماس رضایت‌سنجی)
                          </h3>
                          <span className="text-[10px] text-slate-400">
                            {formatNumber(renewalCalls.length)} نفر
                          </span>
                        </div>
                        <div className="grid gap-2 xl:grid-cols-2">
                          {renewalCalls.map((item, index) => (
                            <CallCard
                              key={item.id}
                              item={item}
                              rank={abandonedCalls.length + index + 1}
                              busy={busy}
                              onOpen={() => openCustomer(item.customer.id, item.id)}
                              onSnooze={(days) => void snooze(item, days)}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </section>

              {(dashboard?.upcoming.length ?? 0) > 0 ? (
                <section className="space-y-2">
                  <h2 className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <CalendarClock className="h-4 w-4 text-slate-500" />
                    یادآوری‌های بعدی
                    <span className="text-[10px] font-normal text-slate-400">
                      {formatNumber(dashboard?.upcoming.length ?? 0)} مورد
                    </span>
                  </h2>
                  <div className="rounded-2xl border border-slate-200 bg-white">
                    {dashboard?.upcoming.slice(0, 8).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => openCustomer(item.customer.id, item.id)}
                        className="flex w-full items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 text-right last:border-0 hover:bg-slate-50"
                      >
                        <span className="text-xs font-medium text-slate-800">
                          {item.customer.display_name}
                        </span>
                        <span className="text-[10px] text-slate-500">{item.kind_label}</span>
                        <span className="text-[10px] text-slate-500">{formatDate(item.due_at)}</span>
                        <ChevronLeft className="h-3.5 w-3.5 text-slate-400" />
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {tab !== "today" && tab !== "archive" ? (
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <form
              className="relative w-full sm:max-w-sm"
              onSubmit={(event) => {
                event.preventDefault()
                setPage(1)
                setAppliedSearch(search.trim())
              }}
            >
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="جست‌وجوی نام، موبایل یا ایمیل…"
                className="pl-9"
              />
            </form>
            <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <Users className="h-3.5 w-3.5" />
              {formatNumber(segment?.total ?? 0)} مشتری در این دسته
            </p>
          </div>

          {tab === "first_buyer" ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">
              این دسته فقط برای آمار و شناخت مشتری است؛ فعلاً جزو اولویت تماس امروز نیست.
            </p>
          ) : null}

          {busy && !segment ? (
            <div className="flex min-h-40 items-center justify-center rounded-2xl border border-slate-200 bg-white">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
            </div>
          ) : (
            <SegmentTable rows={segment?.rows ?? []} onOpen={(id) => openCustomer(id)} />
          )}

          {(segment?.total ?? 0) > PAGE_SIZE ? (
            <div className="flex items-center justify-between">
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                disabled={page <= 1 || busy}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                <ChevronRight className="h-4 w-4" />
                قبلی
              </Button>
              <span className="text-[11px] text-slate-500">
                صفحه {formatNumber(page)} از {formatNumber(Math.ceil((segment?.total ?? 0) / PAGE_SIZE))}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                disabled={page * PAGE_SIZE >= (segment?.total ?? 0) || busy}
                onClick={() => setPage((value) => value + 1)}
              >
                بعدی
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "archive" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-slate-500">وضعیت:</span>
            {(
              [
                { key: "snoozed", label: "یادآوری‌شده (بعداً)" },
                { key: "done", label: "انجام‌شده" },
                { key: "canceled", label: "حذف‌شده" },
              ] as const
            ).map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => {
                  setArchiveStatus(option.key)
                  setPage(1)
                }}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px]",
                  archiveStatus === option.key
                    ? "border-slate-800 bg-slate-800 text-white"
                    : "border-slate-200 bg-white text-slate-600",
                )}
              >
                {option.label}
              </button>
            ))}
            <span className="ms-auto text-[11px] text-slate-400">
              {formatNumber(archive?.total ?? 0)} مورد
            </span>
          </div>

          <div className="space-y-2">
            {(archive?.rows ?? []).map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      className="text-sm font-bold text-slate-900 hover:text-indigo-600"
                      onClick={() => openCustomer(item.customer.id, item.id)}
                    >
                      {item.customer.display_name}
                    </button>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                      {item.kind_label}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px]",
                        item.status === "done"
                          ? "bg-emerald-50 text-emerald-700"
                          : item.status === "snoozed"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-slate-100 text-slate-500",
                      )}
                    >
                      {item.status_label}
                    </span>
                    {item.outcome_label ? (
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] text-indigo-700">
                        {item.outcome_label}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[11px] leading-5 text-slate-600">{item.reason}</p>
                  <p className="mt-0.5 text-[10px] text-slate-400">
                    {item.status === "snoozed"
                      ? `یادآوری: ${formatDate(item.snoozed_until)}`
                      : `بسته‌شده: ${formatDateTime(item.completed_at)}`}
                    {item.note ? ` · ${item.note.slice(0, 100)}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {item.status !== "done" && item.status !== "canceled" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1"
                      disabled={busy}
                      onClick={() => void reopen(item)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      برگرداندن
                    </Button>
                  ) : null}
                  {item.status === "done" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1"
                      disabled={busy}
                      onClick={() => void reopen(item)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      پیگیری مجدد
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-1"
                    onClick={() => openCustomer(item.customer.id, item.id)}
                  >
                    <StickyNote className="h-3.5 w-3.5" />
                    پرونده
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {(archive?.rows.length ?? 0) === 0 ? (
            <Empty text="در این وضعیت موردی نیست." />
          ) : null}
          {(archive?.total ?? 0) > PAGE_SIZE ? (
            <div className="flex items-center justify-between">
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                disabled={page <= 1 || busy}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                <ChevronRight className="h-4 w-4" />
                قبلی
              </Button>
              <span className="text-[11px] text-slate-500">
                صفحه {formatNumber(page)} از {formatNumber(Math.ceil((archive?.total ?? 0) / PAGE_SIZE))}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                disabled={page * PAGE_SIZE >= (archive?.total ?? 0) || busy}
                onClick={() => setPage((value) => value + 1)}
              >
                بعدی
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-2 text-[10px] text-slate-400 sm:grid-cols-3">
        <p className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3 w-3" />
          «انجام شد» یعنی تماس گرفته‌اید؛ اگر بعداً باید دوباره پیگیری شود، یادآوری بسازید.
        </p>
        <p className="flex items-center gap-1.5">
          <AlertTriangle className="h-3 w-3" />
          «رهاشده درگاه» یعنی فاکتور کنسل‌شده‌ای که مشتری حداقل یک بار درگاه پرداخت را دیده و
          بعد از آن هیچ پرداخت موفقی نداشته است؛ فاکتورهایی که مشتری بعداً همان مبلغ را پرداخت
          کرده، خودکار از این لیست حذف می‌شوند.
        </p>
        <p className="flex items-center gap-1.5">
          <CreditCard className="h-3 w-3" />
          لیست هر ساعت و همچنین با دکمهٔ «ساخت مجدد لیست» به‌روز می‌شود.
        </p>
      </div>

      {drawerCustomer !== null ? (
        <CustomerDrawer
          customerId={drawerCustomer}
          meta={meta}
          initialFollowUpId={drawerFollowup}
          onClose={() => {
            setDrawerCustomer(null)
            setDrawerFollowup(null)
          }}
          onChanged={() => void refreshAll()}
        />
      ) : null}
    </div>
  )
}
