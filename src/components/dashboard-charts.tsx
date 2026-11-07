"use client"

import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"

/* ────────────────────────────────────────────────────────────────────────────
 * Small, dependency-free SVG chart primitives for the admin dashboard.
 * Everything is RTL-friendly, scales with its container and renders Persian
 * numbers/dates. No chart library is added to the bundle.
 * ──────────────────────────────────────────────────────────────────────────── */

export type ChartBand = { start: number; end: number; label?: string }

const FA = new Intl.NumberFormat("fa-IR")

export function faNum(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—"
  return FA.format(value)
}

export function faToman(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—"
  return `${FA.format(value)} تومان`
}

export function faCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} میلیارد`
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} میلیون`
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)} هزار`
  return FA.format(value)
}

export function faDay(iso: string): string {
  try {
    return new Intl.DateTimeFormat("fa-IR", { month: "short", day: "numeric" }).format(
      new Date(`${iso}T12:00:00`)
    )
  } catch {
    return iso
  }
}

function niceMax(value: number): number {
  if (value <= 0) return 1
  const exponent = Math.floor(Math.log10(value))
  const base = 10 ** exponent
  const step = base / 2
  return Math.ceil(value / step) * step
}

function yTicks(max: number, count = 4): number[] {
  return Array.from({ length: count + 1 }, (_, i) => (max / count) * i)
}

function useHoverIndex(count: number) {
  const [index, setIndex] = useState<number | null>(null)
  const onMove = (event: React.MouseEvent<SVGSVGElement>, width: number, padLeft: number, padRight: number) => {
    if (count <= 1) return
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = (event.clientX - rect.left) / rect.width
    const x = ratio * width
    const usable = width - padLeft - padRight
    const raw = ((x - padLeft) / usable) * (count - 1)
    setIndex(Math.max(0, Math.min(count - 1, Math.round(raw))))
  }
  return { index, setIndex, onMove }
}

export interface Series {
  key: string
  label: string
  color: string
  values: number[]
  type?: "line" | "area"
  dashed?: boolean
}

export function TimeSeriesChart({
  labels,
  series,
  bands = [],
  height = 260,
  formatValue = faNum,
  className,
}: {
  labels: string[]
  series: Series[]
  bands?: ChartBand[]
  height?: number
  formatValue?: (value: number) => string
  className?: string
}) {
  const width = 860
  const pad = { left: 48, right: 14, top: 14, bottom: 28 }
  const { index, setIndex, onMove } = useHoverIndex(labels.length)

  const max = useMemo(
    () => niceMax(Math.max(1, ...series.flatMap((s) => s.values))),
    [series]
  )
  const plotW = width - pad.left - pad.right
  const plotH = height - pad.top - pad.bottom
  const x = (i: number) => pad.left + (labels.length <= 1 ? 0 : (i / (labels.length - 1)) * plotW)
  const y = (v: number) => pad.top + (1 - v / max) * plotH

  const xLabelIndices = useMemo(() => {
    if (labels.length <= 1) return [0]
    const step = Math.max(1, Math.ceil(labels.length / 6))
    const out: number[] = []
    for (let i = 0; i < labels.length; i += step) out.push(i)
    if (out[out.length - 1] !== labels.length - 1) out.push(labels.length - 1)
    return out
  }, [labels.length])

  const hoverLeft = index === null ? 0 : (x(index) / width) * 100

  return (
    <div className={cn("relative", className)} dir="ltr">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        onMouseMove={(e) => onMove(e, width, pad.left, pad.right)}
        onMouseLeave={() => setIndex(null)}
        role="img"
      >
        {bands.map((band, i) => (
          <rect
            key={`band-${i}`}
            x={x(Math.max(0, band.start))}
            y={pad.top}
            width={Math.max(2, x(Math.min(labels.length - 1, band.end)) - x(Math.max(0, band.start)))}
            height={plotH}
            fill="#6366f1"
            opacity={0.07}
          >
            <title>{band.label}</title>
          </rect>
        ))}

        {yTicks(max).map((tick) => (
          <g key={`tick-${tick}`}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="#e2e8f0"
              strokeWidth={1}
            />
            <text
              x={pad.left - 8}
              y={y(tick) + 4}
              textAnchor="end"
              className="fill-slate-400"
              fontSize={10}
            >
              {faCompact(tick)}
            </text>
          </g>
        ))}

        {series.map((s) => {
          const points = s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")
          const areaPath = `M ${x(0)},${y(0)} L ${s.values
            .map((v, i) => `${x(i)},${y(v)}`)
            .join(" L ")} L ${x(s.values.length - 1)},${y(0)} Z`
          return (
            <g key={s.key}>
              {s.type === "area" ? (
                <path d={areaPath} fill={s.color} opacity={0.12} />
              ) : null}
              <polyline
                points={points}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray={s.dashed ? "5 4" : undefined}
              />
            </g>
          )
        })}

        {index !== null ? (
          <g>
            <line
              x1={x(index)}
              x2={x(index)}
              y1={pad.top}
              y2={pad.top + plotH}
              stroke="#94a3b8"
              strokeDasharray="3 3"
            />
            {series.map((s) => (
              <circle key={`dot-${s.key}`} cx={x(index)} cy={y(s.values[index] ?? 0)} r={3.5} fill={s.color} />
            ))}
          </g>
        ) : null}

        {xLabelIndices.map((i) => (
          <text
            key={`x-${i}`}
            x={x(i)}
            y={height - 8}
            textAnchor="middle"
            className="fill-slate-400"
            fontSize={10}
          >
            {faDay(labels[i])}
          </text>
        ))}
      </svg>

      {index !== null ? (
        <div
          className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-[11px] shadow-lg"
          style={{ left: `${hoverLeft}%` }}
        >
          <p className="mb-1 font-bold text-slate-700">{faDay(labels[index])}</p>
          {series.map((s) => (
            <p key={s.key} className="flex items-center gap-1.5 whitespace-nowrap text-slate-600">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
              {s.label}: <span className="font-bold text-slate-800">{formatValue(s.values[index] ?? 0)}</span>
            </p>
          ))}
        </div>
      ) : null}

      <div className="mt-1 flex flex-wrap items-center justify-center gap-4" dir="rtl">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export function DailyBarChart({
  labels,
  values,
  color = "#4f46e5",
  bands = [],
  height = 220,
  formatValue = faNum,
  extra,
}: {
  labels: string[]
  values: number[]
  color?: string
  bands?: ChartBand[]
  height?: number
  formatValue?: (value: number) => string
  extra?: (index: number) => { label: string; value: string }[]
}) {
  const width = 860
  const pad = { left: 54, right: 14, top: 14, bottom: 28 }
  const { index, setIndex, onMove } = useHoverIndex(labels.length)
  const max = useMemo(() => niceMax(Math.max(1, ...values)), [values])
  const plotW = width - pad.left - pad.right
  const plotH = height - pad.top - pad.bottom
  const step = plotW / Math.max(1, labels.length)
  const barW = Math.max(2, step * 0.62)
  const x = (i: number) => pad.left + i * step + step / 2
  const y = (v: number) => pad.top + (1 - v / max) * plotH

  const xLabelIndices = useMemo(() => {
    const stepN = Math.max(1, Math.ceil(labels.length / 6))
    const out: number[] = []
    for (let i = 0; i < labels.length; i += stepN) out.push(i)
    if (out[out.length - 1] !== labels.length - 1) out.push(labels.length - 1)
    return out
  }, [labels.length])

  return (
    <div className="relative" dir="ltr">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        onMouseMove={(e) => onMove(e, width, pad.left, pad.right)}
        onMouseLeave={() => setIndex(null)}
        role="img"
      >
        {bands.map((band, i) => (
          <rect
            key={`band-${i}`}
            x={pad.left + Math.max(0, band.start) * step}
            y={pad.top}
            width={Math.max(2, (Math.min(labels.length - 1, band.end) - Math.max(0, band.start) + 1) * step)}
            height={plotH}
            fill="#6366f1"
            opacity={0.07}
          >
            <title>{band.label}</title>
          </rect>
        ))}
        {yTicks(max).map((tick) => (
          <g key={`t-${tick}`}>
            <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} stroke="#e2e8f0" />
            <text x={pad.left - 8} y={y(tick) + 4} textAnchor="end" className="fill-slate-400" fontSize={10}>
              {faCompact(tick)}
            </text>
          </g>
        ))}
        {values.map((v, i) => (
          <rect
            key={`b-${i}`}
            x={x(i) - barW / 2}
            y={y(v)}
            width={barW}
            height={Math.max(0, pad.top + plotH - y(v))}
            rx={2}
            fill={index === i ? "#4338ca" : color}
            opacity={v === 0 ? 0.15 : 0.9}
          />
        ))}
        {xLabelIndices.map((i) => (
          <text key={`x-${i}`} x={x(i)} y={height - 8} textAnchor="middle" className="fill-slate-400" fontSize={10}>
            {faDay(labels[i])}
          </text>
        ))}
      </svg>
      {index !== null ? (
        <div
          className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-[11px] shadow-lg"
          style={{ left: `${(x(index) / width) * 100}%` }}
        >
          <p className="mb-1 font-bold text-slate-700">{faDay(labels[index])}</p>
          <p className="whitespace-nowrap text-slate-700">{formatValue(values[index] ?? 0)}</p>
          {extra?.(index).map((row) => (
            <p key={row.label} className="whitespace-nowrap text-slate-500">
              {row.label}: <span className="font-bold text-slate-700">{row.value}</span>
            </p>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function HBarList({
  items,
  emptyLabel = "داده‌ای نیست",
}: {
  items: {
    key: string
    label: string
    value: number | null
    hint?: string
    segments?: { value: number; color: string; label: string }[]
  }[]
  emptyLabel?: string
}) {
  const max = Math.max(1, ...items.map((i) => i.value ?? 0))
  if (!items.length) return <p className="py-6 text-center text-xs text-slate-400">{emptyLabel}</p>
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const available = item.value !== null
        const value = item.value ?? 0
        const segments = item.segments?.filter((s) => s.value > 0) ?? []
        return (
          <div key={item.key}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
              <span className="font-medium text-slate-700">{item.label}</span>
              <span className={cn("font-bold", available ? "text-slate-800" : "text-slate-400")}>
                {available ? faNum(item.value) : "منبع داده ثبت نشده"}
              </span>
            </div>
            {available ? (
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                {segments.length ? (
                  segments.map((seg) => (
                    <div
                      key={seg.label}
                      className="h-full"
                      style={{ width: `${(seg.value / max) * 100}%`, background: seg.color }}
                      title={`${seg.label}: ${faNum(seg.value)}`}
                    />
                  ))
                ) : (
                  <div
                    className="h-full rounded-full bg-indigo-500"
                    style={{ width: `${(value / max) * 100}%` }}
                  />
                )}
              </div>
            ) : (
              <div className="h-2.5 w-full rounded-full border border-dashed border-slate-200 bg-slate-50" />
            )}
            {item.hint ? <p className="mt-1 text-[10px] text-slate-400">{item.hint}</p> : null}
          </div>
        )
      })}
    </div>
  )
}

export function Funnel({
  stages,
}: {
  stages: { label: string; value: number; hint?: string; color: string }[]
}) {
  const first = Math.max(1, stages[0]?.value ?? 1)
  return (
    <div className="space-y-3">
      {stages.map((stage, i) => {
        const pct = Math.round((stage.value / first) * 100)
        return (
          <div key={stage.label}>
            <div className="mb-1 flex items-baseline justify-between text-xs">
              <span className="font-medium text-slate-700">{stage.label}</span>
              <span className="text-slate-500">
                <span className="font-bold text-slate-800">{faNum(stage.value)}</span>
                <span className="mr-1 text-[10px] text-slate-400">({faNum(pct)}٪)</span>
              </span>
            </div>
            <div className="h-7 w-full overflow-hidden rounded-lg bg-slate-100">
              <div
                className="flex h-full items-center justify-end rounded-lg px-2 text-[10px] font-bold text-white transition-all"
                style={{ width: `${Math.max(4, pct)}%`, background: stage.color }}
              >
                {pct >= 18 ? faNum(stage.value) : ""}
              </div>
            </div>
            {stage.hint ? <p className="mt-1 text-[10px] text-slate-400">{stage.hint}</p> : null}
            {i < stages.length - 1 ? (
              <div className="mx-auto my-1 h-2 w-px bg-slate-200" />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

export function Sparkline({
  values,
  color = "#6366f1",
  height = 30,
}: {
  values: number[]
  color?: string
  height?: number
}) {
  const width = 120
  const max = Math.max(1, ...values)
  const points = values
    .map((v, i) => `${(i / Math.max(1, values.length - 1)) * width},${height - (v / max) * (height - 4) - 2}`)
    .join(" ")
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-8 w-28">
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} opacity={0.8} />
    </svg>
  )
}
