"use client"

import { useMemo, useRef, useState } from "react"
import {
  Cloud,
  Cpu,
  Globe2,
  Headphones,
  Loader2,
  Megaphone,
  MonitorSmartphone,
  ShieldCheck,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react"
import {
  PRODUCTS,
  PRODUCT_BY_KEY,
  countWorkers,
  productForIssueProduct,
  productForSection,
  productForTask,
  sectionLabel,
  severityColor,
  faNum,
  pulsesPerMinute,
  type DiagnosticIssue,
  type MonitoringUser,
  type ProductDefinition,
  type ProductKey,
  type SystemSnapshot,
  type WorkerMonitorSnapshot,
  type WorkerTask,
} from "@/lib/brain"
import { cn } from "@/lib/utils"

const VIEW_W = 1400
const VIEW_H = 780
const CX = VIEW_W / 2
const CY = 378
const PRODUCT_RX = 438
const PRODUCT_RY = 246
const CLIENT_RX = 612
const CLIENT_RY = 346
const CORE_CLEARANCE = 96
const CARD_PAD = 54
const MAX_CLIENTS = 16

const CORE_MESH_NODES: Array<[number, number]> = [
  [4.6, 8.2], [6.2, 6.4], [7.8, 8.8], [9.4, 6.2], [10.4, 9.6],
  [8.2, 11.6], [5.8, 11.4], [7.2, 14.2], [9.6, 13.2], [6.4, 16.6],
  [9.4, 17.8], [10.8, 15.6], [4.8, 13.4], [13.2, 8.2], [15.4, 6.6],
  [17.2, 8.6], [19.2, 10.4], [14.8, 11.2], [17.4, 12.6], [16.2, 15.2],
  [18.6, 15.4], [14.2, 14.4], [15.2, 18], [17.8, 17.6], [13.6, 17.2],
  [12.9, 11.4], [11.8, 13.6],
]

const CORE_MESH_EDGES: Array<[number, number]> = [
  [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11],
  [11, 12], [12, 13], [0, 6], [6, 12], [12, 18], [18, 14], [14, 20],
  [20, 22], [22, 23], [23, 24], [24, 17], [17, 16], [16, 25], [25, 21],
  [21, 13], [13, 19], [19, 26], [26, 15], [15, 3], [9, 26], [8, 22],
  [7, 24], [4, 25], [5, 20], [2, 12], [0, 3], [1, 9], [10, 21],
  [11, 23], [6, 18], [14, 22], [16, 24], [3, 25], [9, 19], [13, 18],
]

const PRODUCT_ICONS: Record<ProductKey, LucideIcon> = {
  haioflash: Zap,
  haiogate: ShieldCheck,
  paas: Cloud,
  billing: Wallet,
  tickets: Headphones,
  campaigns: Megaphone,
  devices: MonitorSmartphone,
  hosting: Globe2,
  platform: Cpu,
}

interface Point {
  x: number
  y: number
}

interface ProductNode {
  def: ProductDefinition
  index: number
  angle: number
  x: number
  y: number
  dir: Point
  tangent: Point
  tasks: WorkerTask[]
  clients: ClientNode[]
  issueCount: number
  running: number
  coreWire: string
  coreReturn: string
}

interface ClientNode {
  user: MonitoringUser
  productKey: ProductKey
  color: string
  x: number
  y: number
  task?: WorkerTask
  requestPath: string
  responsePath: string
  dur: number
  begin: number
}

interface IssueSignal {
  issue: DiagnosticIssue
  color: string
  path: string
  dur: number
  begin: number
}

interface TipRow {
  label: string
  value: string
}

interface TipContent {
  color: string
  title: string
  subtitle?: string
  rows: TipRow[]
}

interface TipState extends TipContent {
  x: number
  y: number
}

interface HistoryPoint {
  t: number
  online: number
}

interface BrainMapProps {
  tasksByProduct: Record<ProductKey, WorkerTask[]>
  online: MonitoringUser[]
  onlineCount: number
  issues: DiagnosticIssue[]
  issuesByProduct: Record<ProductKey, number>
  system: SystemSnapshot | null
  monitor?: WorkerMonitorSnapshot | null
  history?: HistoryPoint[]
  isLoading: boolean
}

function segment(from: Point, to: Point, fromPad: number, toPad: number) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy) || 1
  return {
    a: { x: from.x + (dx / length) * fromPad, y: from.y + (dy / length) * fromPad },
    b: { x: to.x - (dx / length) * toPad, y: to.y - (dy / length) * toPad },
  }
}

function wirePath(a: Point, b: Point, bend = 0): string {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = Math.hypot(dx, dy) || 1
  const nx = -dy / length
  const ny = dx / length
  const midX = (a.x + b.x) / 2
  const midY = (a.y + b.y) / 2
  const controlX = midX + nx * bend * length
  const controlY = midY + ny * bend * length
  return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} Q ${controlX.toFixed(1)} ${controlY.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`
}

function clientName(user: MonitoringUser): string {
  return user.display_name?.trim() || user.username
}

function firstNameLetter(user: MonitoringUser): string {
  return Array.from(clientName(user))[0] ?? "?"
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—"
  const timestamp = new Date(iso).getTime()
  if (Number.isNaN(timestamp)) return "—"
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000))
  if (seconds < 60) return "همین حالا"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${faNum(minutes)} دقیقه پیش`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${faNum(hours)} ساعت پیش`
  return `${faNum(Math.floor(hours / 24))} روز پیش`
}

function fa(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—"
  if (typeof value === "number") return faNum(value)
  return value
}

function Particle({
  path,
  dur,
  begin,
  color,
  size = 2.6,
  opacity = 1,
}: {
  path: string
  dur: number
  begin: number
  color: string
  size?: number
  opacity?: number
}) {
  return (
    <circle r={size} fill={color} opacity={opacity} filter="url(#brain-glow)">
      <animateMotion
        dur={`${dur}s`}
        begin={`${begin}s`}
        repeatCount="indefinite"
        path={path}
      />
    </circle>
  )
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const width = 228
  const height = 48
  if (values.length < 2) {
    return (
      <div className="flex h-12 items-center justify-center text-[10px] text-slate-600">
        در انتظار داده‌های زنده…
      </div>
    )
  }
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const span = max - min || 1
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width
    const y = height - 4 - ((value - min) / span) * (height - 12)
    return [x, y] as const
  })
  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ")
  const area = `${line} L ${width} ${height} L 0 ${height} Z`
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-12 w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`spark-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#spark-${color.replace("#", "")})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
      <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r={2.4} fill={color} />
    </svg>
  )
}

function MonitorBar({
  label,
  value,
  percent,
  tone,
  hint,
}: {
  label: string
  value: string
  percent: number
  tone: string
  hint: string
}) {
  return (
    <div className="min-w-[118px] flex-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] text-slate-500">{label}</span>
        <span className="text-[11px] font-bold tabular-nums text-slate-200">{value}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.max(3, Math.min(100, percent))}%`, backgroundColor: tone, boxShadow: `0 0 9px ${tone}` }}
        />
      </div>
      <p className="mt-1 text-[9px] text-slate-600">{hint}</p>
    </div>
  )
}

export function BrainMap({
  tasksByProduct,
  online,
  onlineCount,
  issues,
  issuesByProduct,
  system,
  monitor,
  history = [],
  isLoading,
}: BrainMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<TipState | null>(null)

  const layout = useMemo(() => {
    const runningByProduct = new Map<ProductKey, number>()
    const seenTaskIds = new Set<string>()
    for (const run of monitor?.recent ?? []) {
      if (run.status !== "running") continue
      if (run.task_id) seenTaskIds.add(run.task_id)
      const key = productForIssueProduct(run.product)
      runningByProduct.set(key, (runningByProduct.get(key) ?? 0) + 1)
    }
    for (const task of monitor?.live?.tasks ?? []) {
      if (task.state !== "active") continue
      if (task.task_id && seenTaskIds.has(task.task_id)) continue
      const key = productForTask(task.name)
      runningByProduct.set(key, (runningByProduct.get(key) ?? 0) + 1)
    }

    const products: ProductNode[] = PRODUCTS.map((def, index) => {
      const angle = -Math.PI / 2 + (index * Math.PI * 2) / PRODUCTS.length
      const x = CX + Math.cos(angle) * PRODUCT_RX
      const y = CY + Math.sin(angle) * PRODUCT_RY
      const radialLength = Math.hypot(x - CX, y - CY) || 1
      const dir = { x: (x - CX) / radialLength, y: (y - CY) / radialLength }
      const tangent = { x: -dir.y, y: dir.x }
      const tasks = [...(tasksByProduct[def.key] ?? [])]
      const fromCore = segment({ x: CX, y: CY }, { x, y }, CORE_CLEARANCE, CARD_PAD)
      const bend = (index % 2 === 0 ? 1 : -1) * 0.055
      return {
        def,
        index,
        angle,
        x,
        y,
        dir,
        tangent,
        tasks,
        clients: [],
        issueCount: issuesByProduct[def.key] ?? 0,
        running: runningByProduct.get(def.key) ?? 0,
        coreWire: wirePath(fromCore.a, fromCore.b, bend),
        coreReturn: wirePath(fromCore.b, fromCore.a, -bend),
      }
    })

    const clients: ClientNode[] = []
    const perProduct = new Map<ProductKey, number>()
    for (const user of online.slice(0, MAX_CLIENTS)) {
      const key = productForSection(user.current_section)
      const product = products.find((item) => item.def.key === key) ?? products[0]
      const index = perProduct.get(key) ?? 0
      perProduct.set(key, index + 1)
      const spread = (index - 0.5) * 0.085 * (index % 2 === 0 ? 1 : -1)
      const angle = product.angle + spread
      const scale = 1 + (index % 2) * 0.035
      const x = CX + Math.cos(angle) * CLIENT_RX * scale
      const y = CY + Math.sin(angle) * CLIENT_RY * scale
      const clientPoint = { x, y }
      const cardPoint = { x: product.x, y: product.y }
      const request = segment(clientPoint, cardPoint, 13, CARD_PAD - 6)
      const bend = ((index % 3) - 1) * 0.08
      const client: ClientNode = {
        user,
        productKey: product.def.key,
        color: product.def.color,
        x,
        y,
        task: product.tasks[index % Math.max(product.tasks.length, 1)],
        requestPath: wirePath(request.a, request.b, bend),
        responsePath: wirePath(request.b, request.a, -bend),
        dur: 4.6 + (index % 5) * 0.55,
        begin: (index % 7) * 0.4,
      }
      clients.push(client)
      product.clients.push(client)
    }

    const errorSignals: IssueSignal[] = issues.slice(0, 6).map((issue, index) => {
      const product = products.find((item) => item.def.key === productForIssueProduct(issue.product)) ?? products[0]
      const fromProduct = segment({ x: product.x, y: product.y }, { x: CX, y: CY }, CARD_PAD - 8, CORE_CLEARANCE - 24)
      const bend = (index % 2 === 0 ? 1 : -1) * 0.12
      return {
        issue,
        color: severityColor(issue.severity),
        path: wirePath(fromProduct.a, fromProduct.b, bend),
        dur: 2.8 + (index % 4) * 0.4,
        begin: (index % 5) * 0.5,
      }
    })

    const volumes =
      system?.volumes && !("error" in system.volumes) ? system.volumes : undefined
    const activeWorkers =
      monitor?.live?.workers?.reduce((total, worker) => total + worker.active, 0) ?? 0
    const capacity =
      monitor?.live?.workers?.reduce((total, worker) => total + (worker.concurrency ?? 0), 0) ??
      countWorkers(tasksByProduct)

    return { products, clients, errorSignals, volumes, activeWorkers, capacity }
  }, [issues, issuesByProduct, monitor, online, system, tasksByProduct])

  const showTip = (event: React.MouseEvent, content: TipContent) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    setTip({
      ...content,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    })
  }

  const hideTip = () => setTip(null)

  const coreRows: TipRow[] = [
    { label: "دیتابیس", value: system?.database?.ok ? "سالم" : system ? "خطا" : "—" },
    { label: "کش", value: system?.cache?.ok ? "سالم" : system ? "خطا" : "—" },
    { label: "ورکرهای فعال", value: `${fa(layout.activeWorkers)} / ${fa(layout.capacity)}` },
    { label: "اجرای در جریان", value: fa(monitor?.counts?.running ?? 0) },
  ]

  const historyValues = history.map((point) => point.online)
  const coreHealthy = Boolean(system?.database?.ok && system?.cache?.ok)
  const workerPercent = layout.capacity > 0 ? (layout.activeWorkers / layout.capacity) * 100 : 0
  const pulses = pulsesPerMinute(tasksByProduct)
  const productOrder = new Map(PRODUCTS.map((product, index) => [product.key, index]))
  const sortedOnline = [...online].sort((a, b) => {
    const left = productOrder.get(productForSection(a.current_section)) ?? 99
    const right = productOrder.get(productForSection(b.current_section)) ?? 99
    return left - right
  })
  const visibleOnline = sortedOnline.slice(0, 8)

  return (
    <section className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#04070f] text-white shadow-[0_30px_90px_-60px_rgba(0,0,0,0.95)]">
      <div className="relative">
        <div
          ref={containerRef}
          dir="ltr"
          className="relative min-w-[980px] overflow-hidden"
          style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}` }}
          onMouseLeave={hideTip}
        >
          {/* Control-room ambience */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(30,58,138,0.28),transparent_52%),radial-gradient(circle_at_12%_16%,rgba(14,165,233,0.12),transparent_38%),radial-gradient(circle_at_88%_82%,rgba(168,85,247,0.12),transparent_42%)]" />
          <div className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] [background-size:44px_44px]" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,transparent_0%,rgba(2,6,23,0.15)_48%,rgba(2,6,23,0.72)_100%)]" />

          <svg
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            className="absolute inset-0 h-full w-full"
            preserveAspectRatio="xMidYMid meet"
            aria-label="نمای زندهٔ شبکهٔ عصبی زیرساخت"
          >
            <defs>
              <radialGradient id="core-aura">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.18} />
                <stop offset="42%" stopColor="#4f46e5" stopOpacity={0.11} />
                <stop offset="100%" stopColor="#020617" stopOpacity={0} />
              </radialGradient>
              <radialGradient id="brain-fill" cx="50%" cy="42%" r="62%">
                <stop offset="0%" stopColor="#312e81" stopOpacity={0.5} />
                <stop offset="45%" stopColor="#1e1b4b" stopOpacity={0.62} />
                <stop offset="100%" stopColor="#020617" stopOpacity={0.32} />
              </radialGradient>
              <radialGradient id="brain-core" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#a5f3fc" stopOpacity={0.42} />
                <stop offset="38%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
              </radialGradient>
              <radialGradient id="core-inner">
                <stop offset="0%" stopColor="#67e8f9" stopOpacity={0.3} />
                <stop offset="55%" stopColor="#4f46e5" stopOpacity={0.12} />
                <stop offset="100%" stopColor="#020617" stopOpacity={0} />
              </radialGradient>
              <linearGradient id="brain-edge" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#bae6fd" />
                <stop offset="50%" stopColor="#a5b4fc" />
                <stop offset="100%" stopColor="#38bdf8" />
              </linearGradient>
              <filter id="brain-glow" x="-120%" y="-120%" width="340%" height="340%">
                <feGaussianBlur stdDeviation="3.2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="core-blur" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="18" />
              </filter>
              <filter id="soft-glow" x="-120%" y="-120%" width="340%" height="340%">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <clipPath id="brain-clip">
                <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
                <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
              </clipPath>
            </defs>

            {/* starfield */}
            {Array.from({ length: 54 }).map((_, index) => {
              const x = 60 + ((index * 197) % (VIEW_W - 120))
              const y = 40 + ((index * 127) % (VIEW_H - 80))
              const r = index % 7 === 0 ? 1.5 : index % 3 === 0 ? 1 : 0.6
              return (
                <circle
                  key={`star-${index}`}
                  cx={x}
                  cy={y}
                  r={r}
                  fill="#c7d2fe"
                  opacity={0.12 + (index % 5) * 0.05}
                />
              )
            })}

            {/* orbits */}
            <ellipse cx={CX} cy={CY} rx={PRODUCT_RX + 30} ry={PRODUCT_RY + 30} fill="none" stroke="#38bdf8" strokeOpacity={0.08} strokeDasharray="2 10" />
            <ellipse cx={CX} cy={CY} rx={CLIENT_RX + 6} ry={CLIENT_RY + 6} fill="none" stroke="#818cf8" strokeOpacity={0.1} strokeDasharray="1 12" />
            <ellipse cx={CX} cy={CY} rx={CLIENT_RX - 58} ry={CLIENT_RY - 58} fill="none" stroke="#818cf8" strokeOpacity={0.07} />
            <circle cx={CX} cy={CY} r={290} fill="url(#core-aura)" className="brain-core-pulse" />

            {/* product routes */}
            {layout.products.map((product) => {
              const signalColor = product.def.color
              return (
                <g key={`route-${product.def.key}`}>
                  <path d={product.coreWire} fill="none" stroke={signalColor} strokeOpacity={0.05} strokeWidth={14} strokeLinecap="round" />
                  <path d={product.coreWire} fill="none" stroke={signalColor} strokeOpacity={0.14} strokeWidth={5} strokeLinecap="round" />
                  <path d={product.coreWire} fill="none" stroke={signalColor} strokeOpacity={0.72} strokeWidth={1.3} strokeLinecap="round" filter="url(#soft-glow)" />
                  <path d={product.coreWire} fill="none" stroke="#e0f2fe" strokeOpacity={0.18} strokeWidth={0.5} strokeDasharray="1 11">
                    <animate attributeName="stroke-dashoffset" from="0" to="-120" dur={`${3.6 + product.index * 0.2}s`} repeatCount="indefinite" />
                  </path>
                  {/* task enters the core */}
                  <Particle path={product.coreWire} dur={3.4 + product.index * 0.16} begin={product.index * 0.32} color={signalColor} size={7} opacity={0.14} />
                  <Particle path={product.coreWire} dur={3.4 + product.index * 0.16} begin={product.index * 0.32} color={signalColor} size={2.6} />
                  <Particle path={product.coreWire} dur={3.4 + product.index * 0.16} begin={product.index * 0.32 + 1.7} color={signalColor} size={1.7} opacity={0.8} />
                  {/* response returns to the product */}
                  <Particle path={product.coreReturn} dur={4.2 + product.index * 0.18} begin={product.index * 0.4 + 0.8} color="#34d399" size={2.1} opacity={0.9} />
                </g>
              )
            })}

            {/* client routes */}
            {layout.clients.map((client) => (
              <g key={`client-route-${client.user.id}`}>
                <path d={client.requestPath} fill="none" stroke={client.color} strokeOpacity={0.22} strokeWidth={1} strokeDasharray="2 6" />
                <Particle path={client.requestPath} dur={client.dur} begin={client.begin} color="#7dd3fc" size={2.2} />
                <Particle path={client.responsePath} dur={client.dur + 1.2} begin={client.begin + 1.5} color="#34d399" size={1.8} opacity={0.85} />
              </g>
            ))}

            {/* error pulses */}
            {layout.errorSignals.map((signal) => (
              <g key={`error-${signal.issue.id}`}>
                <path d={signal.path} fill="none" stroke={signal.color} strokeOpacity={0.22} strokeWidth={1.2} strokeDasharray="1 5" />
                <Particle path={signal.path} dur={signal.dur} begin={signal.begin} color={signal.color} size={2.8} />
              </g>
            ))}

            {/* core brain */}
            <g
              onMouseMove={(event) =>
                showTip(event, {
                  color: "#818cf8",
                  title: "HaioCore",
                  subtitle: "هستهٔ عصبی زیرساخت هایو",
                  rows: [
                    ...coreRows,
                    { label: "ماشین‌های فلش", value: fa(layout.volumes?.haioflash_vms) },
                    { label: "نودهای فعال", value: fa(layout.volumes?.haioflash_nodes_up) },
                    { label: "اکانت‌های گیت", value: fa(layout.volumes?.haiogate_accounts) },
                    { label: "تیکت‌ها", value: fa(layout.volumes?.tickets) },
                  ],
                })
              }
              onMouseLeave={hideTip}
              className="cursor-help"
            >
              <circle cx={CX} cy={CY} r={232} fill="url(#core-aura)" className="brain-core-pulse" />
              <circle cx={CX} cy={CY} r={168} fill="none" stroke="#6366f1" strokeOpacity={0.16} strokeDasharray="1 9" className="brain-spin-slow" />
              <circle cx={CX} cy={CY} r={146} fill="none" stroke="#38bdf8" strokeOpacity={0.14} strokeDasharray="18 14" className="brain-spin-reverse" />
              <circle cx={CX} cy={CY} r={138} fill="none" stroke="#818cf8" strokeOpacity={0.28}>
                <animate attributeName="r" values="112;186" dur="5s" repeatCount="indefinite" />
                <animate attributeName="stroke-opacity" values="0.28;0" dur="5s" repeatCount="indefinite" />
              </circle>
              <circle cx={CX} cy={CY} r={112} fill="#4338ca" opacity={0.12} filter="url(#core-blur)" />
              <circle cx={CX} cy={CY} r={104} fill="url(#core-inner)" />

              {/* orbital data planes */}
              <g fill="none" stroke="#38bdf8" strokeOpacity={0.13} strokeWidth={0.7}>
                <ellipse cx={CX} cy={CY} rx={152} ry={44} transform={`rotate(-24 ${CX} ${CY})`} strokeDasharray="2 9" />
                <ellipse cx={CX} cy={CY} rx={152} ry={44} transform={`rotate(24 ${CX} ${CY})`} strokeDasharray="2 9" />
                <ellipse cx={CX} cy={CY} rx={166} ry={54} strokeOpacity={0.07} />
              </g>

              {/* neural halo */}
              <g fill="#7dd3fc">
                {Array.from({ length: 44 }).map((_, index) => {
                  const angle = (index / 44) * Math.PI * 2
                  const radius = 146 + (index % 4) * 6
                  return (
                    <circle
                      key={`halo-${index}`}
                      cx={CX + Math.cos(angle) * radius}
                      cy={CY + Math.sin(angle) * radius}
                      r={index % 6 === 0 ? 1.1 : 0.6}
                      opacity={index % 5 === 0 ? 0.5 : 0.2}
                    >
                      <animate attributeName="opacity" values="0.12;0.55;0.12" dur={`${4 + (index % 7) * 0.5}s`} begin={`${(index % 9) * 0.4}s`} repeatCount="indefinite" />
                    </circle>
                  )
                })}
              </g>

              {/* brain silhouette (lucide brain, scaled) */}
              <g transform={`translate(${CX - 12 * 11.2} ${CY - 12 * 11.2}) scale(11.2)`} filter="url(#brain-glow)">
                <path
                  d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"
                  fill="url(#brain-fill)"
                  stroke="url(#brain-edge)"
                  strokeWidth={0.2}
                  strokeOpacity={1}
                />
                <path
                  d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"
                  fill="url(#brain-fill)"
                  stroke="url(#brain-edge)"
                  strokeWidth={0.2}
                  strokeOpacity={1}
                />
                <circle cx={12} cy={11.4} r={7.4} fill="url(#brain-core)" />
                <circle cx={12} cy={11.4} r={2.4} fill="#818cf8" opacity={0.22} filter="url(#core-blur)" />
                <g clipPath="url(#brain-clip)" stroke="#7dd3fc" strokeOpacity={0.38} strokeWidth={0.055}>
                  {CORE_MESH_EDGES.map(([a, b], index) => {
                    const from = CORE_MESH_NODES[a]
                    const to = CORE_MESH_NODES[b]
                    if (!from || !to) return null
                    return <line key={`mesh-${index}`} x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} />
                  })}
                </g>
                <g clipPath="url(#brain-clip)" fill="#bae6fd">
                  {CORE_MESH_NODES.map(([cx, cy], index) => (
                    <circle key={`meshnode-${index}`} cx={cx} cy={cy} r={index % 4 === 0 ? 0.14 : 0.085} opacity={index % 3 === 0 ? 0.85 : 0.5}>
                      <animate
                        attributeName="opacity"
                        values="0.18;0.9;0.18"
                        dur={`${3 + (index % 6) * 0.45}s`}
                        begin={`${(index % 8) * 0.3}s`}
                        repeatCount="indefinite"
                      />
                    </circle>
                  ))}
                </g>
                <g clipPath="url(#brain-clip)" stroke="#a5b4fc" strokeOpacity={0.42} strokeWidth={0.075} fill="none">
                  <path d="M3 8c2.2 1.2 3.7 3.2 4.2 5.4 0.4 1.7 1.7 3 3.4 3.4" />
                  <path d="M4.3 13.2c1.6 -0.8 3.3 -0.6 4.6 0.5 1.1 1 2.7 1 3.9 0.1" />
                  <path d="M6.2 18c0.4 -2 2 -3.5 4 -3.8 1.5 -0.2 2.8 -1.2 3.3 -2.6" />
                  <path d="M14.6 4.8c-0.2 1.7 0.5 3.4 1.9 4.4 1.2 0.9 1.8 2.4 1.5 3.9" />
                  <path d="M13.2 12.2c1.7 0.1 3.3 0.9 4.4 2.2 0.7 0.9 1.8 1.4 2.9 1.4" />
                  <path d="M15.2 20c0 -1.7 1.2 -3.2 2.9 -3.6 1 -0.2 1.8 -0.9 2.2 -1.8" />
                  <path d="M7.4 5.6c1.8 0.6 3.2 2 3.8 3.8 0.4 1.2 1.4 2.1 2.6 2.4" />
                  <path d="M9.6 20.4c0.4 -1.4 1.5 -2.4 2.9 -2.7 1.1 -0.2 2 -1 2.4 -2" />
                  <path d="M4.6 9.4c1.2 0.2 2.3 0.9 3 1.9 0.6 0.9 1.6 1.4 2.7 1.4" />
                  <path d="M16.8 7.2c-0.6 1.4 -0.4 3 0.6 4.1 0.7 0.8 1 1.9 0.8 3" />
                  <path d="M5.4 16.6c1.4 -0.2 2.7 0.4 3.5 1.5 0.5 0.7 1.3 1.1 2.1 1.2" />
                  <path d="M14.2 18.6c0.5 -1.1 1.6 -1.8 2.8 -1.7 0.9 0.1 1.7 -0.3 2.2 -1" />
                  <path d="M9.2 3.6c0.2 1.2 0.9 2.2 1.9 2.8" />
                  <path d="M11.4 21.2c0 -0.9 0.5 -1.7 1.3 -2.1" />
                </g>
                <g clipPath="url(#brain-clip)" fill="#bae6fd" opacity={0.9}>
                  {[
                    [7.4, 9.1],
                    [10.2, 6.8],
                    [15.4, 8.6],
                    [17.2, 12.4],
                    [12.8, 14.6],
                    [8.6, 15.2],
                    [13.6, 10.4],
                    [6.4, 12.1],
                    [10.8, 17.4],
                    [16.4, 16.2],
                  ].map(([cx, cy], index) => (
                    <circle key={`spark-${index}`} cx={cx} cy={cy} r={index % 2 === 0 ? 0.18 : 0.12}>
                      <animate attributeName="opacity" values="0.25;1;0.25" dur={`${2.6 + index * 0.35}s`} repeatCount="indefinite" />
                    </circle>
                  ))}
                </g>
              </g>

              {/* synapses */}
              {[
                [CX - 58, CY - 40, CX - 16, CY - 68, "#a5b4fc"],
                [CX + 24, CY - 62, CX + 62, CY - 24, "#7dd3fc"],
                [CX - 70, CY + 8, CX - 26, CY + 32, "#c4b5fd"],
                [CX + 10, CY + 22, CX + 54, CY + 46, "#a5b4fc"],
                [CX - 30, CY - 4, CX + 32, CY - 20, "#bae6fd"],
                [CX - 12, CY + 58, CX + 18, CY + 10, "#7dd3fc"],
              ].map(([x1, y1, x2, y2, color], index) => (
                <g key={`synapse-${index}`}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={String(color)} strokeOpacity={0.22} strokeWidth={0.6} />
                  <circle r={1.5} fill={String(color)} filter="url(#soft-glow)">
                    <animateMotion
                      dur={`${3.2 + index * 0.6}s`}
                      begin={`${index * 0.3}s`}
                      repeatCount="indefinite"
                      path={`M ${x1} ${y1} L ${x2} ${y2}`}
                    />
                  </circle>
                </g>
              ))}

              <circle cx={CX} cy={CY} r={92} fill="none" stroke="#c7d2fe" strokeOpacity={0.08} />
            </g>

            {/* client neurons */}
            {layout.clients.map((client) => (
              <g
                key={`client-${client.user.id}`}
                onMouseMove={(event) =>
                  showTip(event, {
                    color: client.color,
                    title: clientName(client.user),
                    subtitle: `${PRODUCT_BY_KEY[client.productKey].label} · ${client.user.last_seen_label}`,
                    rows: [
                      { label: "نقش", value: client.user.role },
                      { label: "بخش", value: sectionLabel(client.user.current_section) },
                      { label: "مسیر", value: client.user.current_path ?? "—" },
                      { label: "وظیفه", value: client.task?.label ?? "در حال مسیریابی" },
                      { label: "مسیر سیگنال", value: "کلاینت ← ورکر ← هسته ← نود محصول" },
                    ],
                  })
                }
                onMouseLeave={hideTip}
                className="cursor-help"
              >
                <circle cx={client.x} cy={client.y} r={24} fill="none" stroke={client.color} strokeOpacity={0.25} className="brain-ring" />
                <circle cx={client.x} cy={client.y} r={15} fill="#07101f" stroke={client.color} strokeWidth={1.5} />
                <circle cx={client.x} cy={client.y} r={15} fill={client.color} opacity={0.1} />
                <text x={client.x} y={client.y} textAnchor="middle" dominantBaseline="middle" fill="#e2e8f0" fontSize={9.5} fontWeight={700}>
                  {firstNameLetter(client.user)}
                </text>
                <circle cx={client.x + 10} cy={client.y - 10} r={3} fill="#34d399" filter="url(#soft-glow)" />
              </g>
            ))}
          </svg>

          {/* product cards */}
          {layout.products.map((product) => {
            const Icon = PRODUCT_ICONS[product.def.key]
            const rest = Math.max(0, product.tasks.length - 4)
            const brokerDown = monitor?.live?.ok === false
            const workerState = brokerDown ? "Offline" : product.running > 0 ? "Busy" : "Online"
            return (
              <div
                key={product.def.key}
                className="absolute z-20 w-[192px] -translate-x-1/2 -translate-y-1/2 cursor-help"
                style={{
                  left: `${((product.x / VIEW_W) * 100).toFixed(3)}%`,
                  top: `${((product.y / VIEW_H) * 100).toFixed(3)}%`,
                }}
                onMouseMove={(event) => {
                  showTip(event, {
                    color: product.def.color,
                    title: product.def.label,
                    subtitle: `${product.def.hint} · ${product.tasks.length} ورکر`,
                    rows: [
                      { label: "ورکر فعال", value: fa(product.running) },
                      { label: "کلاینت آنلاین", value: fa(product.clients.length) },
                      { label: "رخداد ۲۴ ساعت", value: fa(product.issueCount) },
                      { label: "وظایف", value: product.tasks.slice(0, 3).map((task) => task.label).join("، ") || "—" },
                      { label: "مسیر", value: "درخواست ← ورکر ← هسته ← محصول" },
                    ],
                  })
                }}
                onMouseLeave={hideTip}
              >
                <div
                  className="relative overflow-hidden rounded-lg border border-white/[0.12] bg-[#08111f]/95 px-3 pb-2 pt-2 backdrop-blur-md transition-colors duration-300 hover:border-white/15"
                  style={{ boxShadow: "0 16px 40px -32px rgba(0,0,0,0.95)" }}
                >
                  <div
                    className="pointer-events-none absolute inset-y-0 right-0 w-px"
                    style={{ background: `linear-gradient(180deg, transparent, ${product.def.color}99, transparent)` }}
                  />
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-white/10 bg-white/[0.03]"
                      style={{ color: product.def.color }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1 text-right" dir="rtl">
                      <p className="truncate text-[13px] font-semibold tracking-tight text-white">{product.def.label}</p>
                      <p className="mt-0.5 flex items-center justify-end gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-slate-400">
                        <span>{workerState}</span>
                        <span
                          className={cn(
                            "h-1 w-1 rounded-full",
                            brokerDown ? "bg-amber-400" : product.running > 0 ? "bg-emerald-400" : "bg-slate-600",
                          )}
                        />
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-white/[0.08] pt-1.5 text-[10px] text-slate-400" dir="rtl">
                    <span>
                      ورکر <b className="font-mono text-[10.5px] font-medium text-slate-100">{faNum(product.tasks.length)}</b>
                    </span>
                    <span>
                      کلاینت <b className="font-mono text-[10.5px] font-medium text-slate-100">{faNum(product.clients.length)}</b>
                    </span>
                    <span className={cn(product.running > 0 ? "text-emerald-300" : "text-slate-600")}>
                      اجرا <b className="font-mono font-medium">{faNum(product.running)}</b>
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-[3px]" dir="ltr">
                    {product.tasks.slice(0, 8).map((task) => (
                      <span
                        key={task.id}
                        className="block h-[2px] flex-1 rounded-full transition-opacity"
                        style={{ backgroundColor: product.def.color, opacity: task.scheduleSeconds <= 120 ? 0.65 : 0.22 }}
                        onMouseMove={(event) => {
                          event.stopPropagation()
                          showTip(event, {
                            color: product.def.color,
                            title: task.label,
                            subtitle: `${product.def.label} · ${task.scheduleLabel}`,
                            rows: [
                              { label: "وظیفه", value: task.task },
                              { label: "دوره", value: task.scheduleLabel },
                              { label: "اجرا برای", value: "مشتریان این محصول" },
                              { label: "وضعیت", value: "در چرخهٔ زمان‌بند" },
                            ],
                          })
                        }}
                      />
                    ))}
                    {rest > 0 ? <span className="font-mono text-[7px] text-slate-600">+{faNum(rest)}</span> : null}
                  </div>
                </div>
              </div>
            )
          })}

          {/* core badge */}
          <div
            className="pointer-events-none absolute z-20 -translate-x-1/2"
            style={{ left: "50%", top: `${((CY + 104) / VIEW_H) * 100}%` }}
            dir="rtl"
          >
            <div className="flex items-center gap-2 rounded-md border border-white/10 bg-[#060b15]/92 px-2.5 py-1.5 backdrop-blur-md">
              <span className={cn("h-1.5 w-1.5 rounded-full", coreHealthy ? "bg-emerald-400" : "bg-amber-400")} />
              <p className="text-[11px] font-semibold leading-none tracking-tight text-slate-100">HaioCore</p>
              <span className="h-3 w-px bg-white/10" />
              <p className="font-mono text-[8px] uppercase leading-none tracking-[0.18em] text-slate-500">{coreHealthy ? "live" : "degraded"}</p>
            </div>
          </div>

          {/* system overview */}
          <div className="pointer-events-none absolute left-4 top-4 z-30 hidden w-[232px] rounded-lg border border-white/[0.12] bg-[#070d18]/95 p-3 backdrop-blur-md sm:block" dir="rtl">
            <div className="flex items-center justify-between">
              <p className="text-[11.5px] font-semibold text-slate-100">نمای کلی سیستم</p>
              <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-slate-600">sys</span>
            </div>
            <div className="mt-1 border-b border-white/[0.06] pb-2">
              <Sparkline values={historyValues} color="#38bdf8" />
            </div>
            <div className="mt-2 space-y-1.5">
              {[
                { label: "کلاینت آنلاین", value: fa(onlineCount), tone: "text-emerald-300" },
                { label: "ورکر فعال", value: `${fa(layout.activeWorkers)} / ${fa(layout.capacity)}`, tone: "text-sky-300" },
                { label: "اجرای در جریان", value: fa(monitor?.counts?.running ?? 0), tone: "text-indigo-300" },
                { label: "خطای ۲۴ ساعت", value: fa(system?.issues_24h ?? 0), tone: "text-rose-300" },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between text-[10.5px]">
                  <span className="text-slate-500">{row.label}</span>
                  <span className={cn("font-mono text-[11px] font-medium tabular-nums", row.tone)}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* online clients */}
          <div className="pointer-events-none absolute right-4 top-4 z-30 hidden w-[244px] rounded-lg border border-white/[0.12] bg-[#070d18]/95 p-3 backdrop-blur-md sm:block" dir="rtl">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-slate-100">کاربران آنلاین</p>
              <span className="flex items-center gap-1 font-mono text-[9px] text-emerald-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                {fa(onlineCount)}
              </span>
            </div>
            <div className="mt-2.5 space-y-2 border-t border-white/[0.08] pt-2.5">
              {visibleOnline.length === 0 ? (
                <p className="py-3 text-center text-[10px] text-slate-500">کاربری آنلاین نیست.</p>
              ) : (
                visibleOnline.map((user) => {
                  const key = productForSection(user.current_section)
                  const product = PRODUCT_BY_KEY[key]
                  const name = user.display_name || user.username || user.email || "کاربر"
                  const initial = name.trim().charAt(0)
                  return (
                    <div key={user.id} className="flex items-center gap-2">
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold"
                        style={{ borderColor: `${product.color}55`, backgroundColor: `${product.color}1a`, color: product.color }}
                      >
                        {initial}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11.5px] font-medium leading-4 text-slate-100">{name}</p>
                        <p className="truncate text-[9.5px] leading-3.5 text-slate-400">
                          <span className="inline-flex items-center gap-1">
                            <span className="h-1 w-1 rounded-full" style={{ backgroundColor: product.color }} />
                            {product.label}
                          </span>
                          <span className="text-slate-600"> · {sectionLabel(user.current_section)}</span>
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
              {online.length > visibleOnline.length ? (
                <p className="pt-1 text-center font-mono text-[9px] text-slate-500">+{fa(online.length - visibleOnline.length)}</p>
              ) : null}
            </div>
          </div>

          {/* legend */}
          <div className="pointer-events-none absolute bottom-4 left-4 z-30 hidden flex-col gap-1 rounded-lg border border-white/[0.08] bg-[#050a15]/88 px-2.5 py-1.5 text-[9.5px] text-slate-300 backdrop-blur-md sm:flex" dir="rtl">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1"><span className="h-1 w-1 rounded-full bg-sky-400" /> درخواست کلاینت</span>
              <span className="flex items-center gap-1"><span className="h-1 w-1 rounded-full bg-indigo-400" /> پردازش هسته</span>
              <span className="flex items-center gap-1"><span className="h-1 w-1 rounded-full bg-emerald-400" /> پاسخ</span>
              <span className="flex items-center gap-1"><span className="h-1 w-1 rounded-full bg-rose-500" /> خطا</span>
            </div>
            <p className="text-[9px] text-slate-400">
              مسیر سیگنال: کلاینت ← ورکر ← هسته ← نود محصول ← بازگشت پاسخ
            </p>
          </div>

          {/* bottom dock */}
          <div className="pointer-events-none absolute bottom-4 left-1/2 z-30 hidden w-[470px] -translate-x-1/2 items-end gap-4 rounded-lg border border-white/[0.08] bg-[#050a15]/88 px-4 py-2.5 backdrop-blur-md lg:flex" dir="rtl">
            <MonitorBar label="سلامت هسته" value={coreHealthy ? "۱۰۰٪" : system ? "۶۰٪" : "—"} percent={coreHealthy ? 100 : system ? 60 : 0} tone="#34d399" hint="دیتابیس و کش" />
            <MonitorBar label="ظرفیت ورکر" value={`${fa(layout.activeWorkers)}/${fa(layout.capacity)}`} percent={workerPercent} tone="#38bdf8" hint="اجرای هم‌زمان" />
            <MonitorBar label="سیگنال / دقیقه" value={fa(pulses)} percent={Math.min(100, pulses / 2)} tone="#818cf8" hint="چرخهٔ زمان‌بند" />
          </div>

          {/* worker load */}
          <div className="pointer-events-none absolute bottom-4 right-4 z-30 hidden w-[228px] rounded-lg border border-white/[0.08] bg-[#050a15]/88 p-3 backdrop-blur-md xl:block" dir="rtl">
            <div className="flex items-center justify-between">
              <p className="text-[10.5px] font-semibold text-slate-200">بار ورکرها</p>
              <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-slate-600">
                {monitor?.live?.ok ? "live" : "n/a"}
              </span>
            </div>
            <div className="mt-2 space-y-2">
              {(monitor?.live?.workers ?? []).slice(0, 4).map((worker) => {
                const concurrency = worker.concurrency ?? 1
                const percent = Math.min(100, (worker.active / Math.max(concurrency, 1)) * 100)
                return (
                  <div key={worker.hostname}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-mono text-[8.5px] text-slate-400" dir="ltr">
                        {worker.hostname.split("@")[0]}
                      </span>
                      <span className="shrink-0 font-mono text-[8.5px] tabular-nums text-slate-500">
                        {worker.active}/{concurrency}
                      </span>
                    </div>
                    <div className="mt-1 h-[2px] w-full overflow-hidden rounded-full bg-white/[0.06]">
                      <div className="h-full rounded-full bg-sky-400/70" style={{ width: `${Math.max(3, percent)}%` }} />
                    </div>
                  </div>
                )
              })}
              {(monitor?.live?.workers ?? []).length === 0 ? (
                <p className="py-1 text-center text-[9px] text-slate-600">ورکری از بروکر گزارش نشده است.</p>
              ) : null}
            </div>
          </div>

          {tip ? (
            <div
              className="pointer-events-none absolute z-50 w-72 max-w-[calc(100vw-2rem)] rounded-lg border bg-[#060c18]/97 p-3 text-right shadow-2xl backdrop-blur-xl"
              style={{
                left: `clamp(160px, ${((tip.x / VIEW_W) * 100).toFixed(3)}%, calc(100% - 160px))`,
                top: `${((tip.y / VIEW_H) * 100).toFixed(3)}%`,
                transform: tip.y < 160 ? "translate(-50%, 8px)" : "translate(-50%, calc(-100% - 14px))",
                borderColor: `${tip.color}44`,
                boxShadow: "0 24px 60px rgba(0,0,0,.7)",
              }}
              dir="rtl"
            >
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: tip.color }} />
                <p className="truncate text-xs font-bold text-slate-100">{tip.title}</p>
              </div>
              {tip.subtitle ? <p className="mt-0.5 truncate text-[10px] text-slate-400">{tip.subtitle}</p> : null}
              <div className="mt-2 space-y-1 border-t border-white/10 pt-2">
                {tip.rows.map((row) => (
                  <div key={row.label} className="flex items-start justify-between gap-3">
                    <span className="shrink-0 text-[10px] text-slate-500">{row.label}</span>
                    <span className="break-words text-left text-[10px] leading-4 text-slate-200">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {isLoading ? (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#04070f]/70 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
                <p className="text-xs">در حال اتصال به مغز زیرساخت…</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
