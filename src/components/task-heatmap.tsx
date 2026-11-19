"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarCheck2, Flame } from "lucide-react"

import { api } from "@/lib/api"
import { JALALI_MONTHS, toJalali } from "@/lib/jalali"
import { faNum } from "@/components/dashboard-charts"
import { cn } from "@/lib/utils"

/**
 * GitHub-style contribution heatmap for the team task board.
 *
 * Each cell is one day; the shade shows how many tasks were completed that
 * day. Weeks run Saturday → Friday (the Iranian week) and are laid out left to
 * right, oldest first, exactly like GitHub, so the newest activity sits at the
 * far right. Month labels are Jalali.
 */

interface ActivityDay {
  date: string
  done: number
  created: number
}

interface ActivityResponse {
  since: string
  until: string
  days: ActivityDay[]
  total_done: number
  active_days: number
  best_day: number
}

const WEEKDAYS = ["شنبه", "یک‌شنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنج‌شنبه", "جمعه"]

const LEVELS = [
  "bg-slate-100",
  "bg-emerald-100",
  "bg-emerald-300",
  "bg-emerald-500",
  "bg-emerald-700",
]

function levelFor(count: number): number {
  if (count <= 0) return 0
  if (count === 1) return 1
  if (count <= 3) return 2
  if (count <= 6) return 3
  return 4
}

function isoOf(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

function parseIso(value: string): Date {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day)
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date.getTime())
  next.setDate(next.getDate() + amount)
  return next
}

function jalaliMonthLabel(value: string): string {
  const date = parseIso(value)
  const [, month] = toJalali(date.getFullYear(), date.getMonth() + 1, date.getDate())
  return JALALI_MONTHS[month - 1]
}

function cellTitle(day: ActivityDay): string {
  const date = parseIso(day.date)
  const [year, month, dayOfMonth] = toJalali(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate()
  )
  const stamp = `${faNum(dayOfMonth)} ${JALALI_MONTHS[month - 1]} ${faNum(year)}`
  if (day.done === 0) {
    return `${stamp} — کاری انجام نشده${day.created ? `، ${faNum(day.created)} تسک جدید` : ""}`
  }
  return `${stamp} — ${faNum(day.done)} کار انجام‌شده${
    day.created ? `، ${faNum(day.created)} تسک جدید` : ""
  }`
}

export function TaskHeatmap() {
  const [data, setData] = useState<ActivityResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    api
      .get<ActivityResponse>("/panel/tasks/activity/")
      .then(({ data: payload }) => {
        if (alive) {
          setData(payload)
          setError(null)
        }
      })
      .catch((err) => {
        if (!alive) return
        const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail
        setError(detail || "دریافت فعالیت تسک‌ها ناموفق بود.")
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  const grid = useMemo(() => {
    if (!data || data.days.length === 0) return null

    const byDate = new Map<string, ActivityDay>()
    for (const day of data.days) byDate.set(day.date, day)

    const first = parseIso(data.days[0].date)
    const last = parseIso(data.days[data.days.length - 1].date)

    // JavaScript weeks start Sunday; the Iranian week starts Saturday.
    const offset = (first.getDay() + 1) % 7
    const start = addDays(first, -offset)

    const weeks: (ActivityDay | null)[][] = []
    const monthLabels: { column: number; label: string }[] = []
    let cursor = start
    let previousMonth = ""

    while (cursor <= last) {
      const week: (ActivityDay | null)[] = []
      for (let day = 0; day < 7; day += 1) {
        const current = addDays(cursor, day)
        week.push(current > last ? null : byDate.get(isoOf(current)) ?? null)
      }

      const firstOfWeek = week.find((cell) => cell !== null) ?? null
      if (firstOfWeek) {
        const label = jalaliMonthLabel(firstOfWeek.date)
        if (label !== previousMonth) {
          // Skip labels that would collide with the previous one.
          const lastLabel = monthLabels[monthLabels.length - 1]
          if (!lastLabel || weeks.length - lastLabel.column >= 3) {
            monthLabels.push({ column: weeks.length, label })
          }
          previousMonth = label
        }
      }

      weeks.push(week)
      cursor = addDays(cursor, 7)
    }

    return { weeks, monthLabels }
  }, [data])

  return (
    <section className="rounded-2xl border border-emerald-200 bg-gradient-to-l from-emerald-50/70 via-white to-white p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <span className="rounded-lg bg-emerald-100 p-1.5 text-emerald-700">
            <CalendarCheck2 className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-slate-900">فعالیت تسک‌های تیم</h3>
            <p className="mt-0.5 text-[11px] text-slate-500">
              کارهای انجام‌شده در یک سال گذشته؛ هر خانه یک روز است و رنگ پررنگ‌تر یعنی کار بیشتر
            </p>
          </div>
        </div>
        <a
          href="/tasks"
          className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-emerald-700 transition-colors hover:bg-emerald-50"
        >
          تخته تسک‌ها
          <Flame className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-slate-500">
        <span>
          <b className="text-slate-800">{faNum(data?.total_done ?? 0)}</b> کار انجام‌شده
        </span>
        <span>
          <b className="text-slate-800">{faNum(data?.active_days ?? 0)}</b> روز فعال
        </span>
        <span>
          بهترین روز: <b className="text-slate-800">{faNum(data?.best_day ?? 0)}</b> کار
        </span>
      </div>

      {error ? (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
          {error}
        </p>
      ) : loading && !data ? (
        <div className="mt-4 h-24 animate-pulse rounded-xl bg-slate-100" />
      ) : grid ? (
        <div className="mt-4 overflow-x-auto pb-1">
          <div dir="ltr" className="inline-block min-w-full">
            <div className="flex gap-1 pl-8">
              {grid.weeks.map((_, column) => {
                const label = grid.monthLabels.find((entry) => entry.column === column)
                return (
                  <div key={column} className="w-3 shrink-0 text-[9px] text-slate-400">
                {label ? (
                  <span className="block whitespace-nowrap pt-0.5">{label.label}</span>
                ) : null}
                  </div>
                )
              })}
            </div>

            <div className="mt-1 flex gap-1">
              <div className="flex w-7 shrink-0 flex-col gap-1 pr-1 text-[9px] text-slate-400">
                {WEEKDAYS.map((weekday, index) => (
                  <div key={weekday} className="flex h-3 items-center justify-end">
                    {index % 2 === 0 ? <span className="whitespace-nowrap">{weekday}</span> : null}
                  </div>
                ))}
              </div>

              {grid.weeks.map((week, column) => (
                <div key={column} className="flex flex-col gap-1">
                  {week.map((day, row) => (
                    <div
                      key={row}
                      title={day ? cellTitle(day) : undefined}
                      className={cn(
                        "h-3 w-3 rounded-[3px] transition-colors",
                        day ? LEVELS[levelFor(day.done)] : "bg-transparent"
                      )}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div dir="ltr" className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-slate-400">
        <span dir="rtl">کمتر</span>
        {LEVELS.map((tone) => (
          <span key={tone} className={cn("h-3 w-3 rounded-[3px]", tone)} />
        ))}
        <span dir="rtl">بیشتر</span>
      </div>
    </section>
  )
}
