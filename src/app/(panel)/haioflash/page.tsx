"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  Search,
  Server,
  UserRound,
} from "lucide-react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { navItemsForUser } from "@/lib/roles"
import { useAuthStore } from "@/stores/auth-store"

interface FlashOwner {
  id: number
  display_name: string | null
  username: string | null
  email: string
  mobile: string
  is_active: boolean
}

interface FlashOrg {
  id: number
  name: string
}

interface FlashPlan {
  id: string
  name: string
  plan_type: string
  plan_type_display: string
  cpu_cores: number
  memory_gib: number
  storage_gib: number
  price_monthly: number
  price_monthly_snapshot: number
  billing_mode: string
  billing_mode_display: string
}

interface FlashNode {
  id: string
  name: string
  region: string
  status: string
}

interface FlashTraffic {
  total_bytes: number
  used_bytes: number
  remaining_bytes: number
  percent: number
  purchased_addon_bytes: number
}

interface FlashVm {
  id: string
  machine_no: number | null
  short_id: string
  microvm_id: string
  name: string
  status: string
  status_display: string
  suspended_reason_display: string | null
  owner: FlashOwner
  organization: FlashOrg
  credential: { username: string; password: string }
  network: {
    ipv4: string | null
    ipv6: string | null
    mac: string
    ssh_port: number | null
  }
  plan: FlashPlan
  node: FlashNode
  ip_shared: {
    id: string
    name: string
    short_id: string
    status: string
    status_display: string
  } | null
  image: string | null
  traffic: FlashTraffic
  expired_at: string | null
  days_remaining: number | null
  is_expired: boolean
  next_billing_date: string | null
  hourly_cost_accumulated: number
  last_stats_sync: string | null
  created_at: string
}

interface VmSummary {
  total: number
  running: number
  stopped: number
  creating: number
  suspended: number
  error: number
  expiring_soon: number
  hourly: number
  traffic_total: number
  traffic_used: number
  traffic_remaining: number
  expiring_days: number
}

interface VmPage {
  count: number
  page: number
  page_size: number
  pages: number
  ordering: string
  generated_at: string
  summary: VmSummary
  results: FlashVm[]
}

interface FlashIpVm {
  id: string
  name: string
  status: string
  status_display: string
  short_id: string
  owner: FlashOwner
  organization: FlashOrg
  machine_no: number | null
}

interface FlashDedicated {
  id: string
  server_name: string
  note: string
  is_active: boolean
}

interface FlashIp {
  address: string
  state: "assigned" | "free" | "reserved" | "stale" | "dedicated" | "unregistered"
  state_display: string
  is_active: boolean | null
  mac: string | null
  gateway: string | null
  region: string | null
  node: string | null
  vm: FlashIpVm | null
  extra_claims: Array<{
    id: string
    name: string
    status: string
    status_display: string
    owner: FlashOwner
  }>
  dedicated: FlashDedicated | null
}

interface IpRange {
  from: string
  to: string
  count: number
  assigned: number
  free: number
  reserved: number
  stale: number
  dedicated: number
  unregistered: number
}

interface IpSummary {
  total: number
  assigned: number
  free: number
  reserved: number
  stale: number
  dedicated: number
  unregistered: number
  usable: number
  running: number
  stopped: number
  suspended: number
  vm_claim_count: number
  duplicate_addresses: null | Array<string | { address: string; names: string[] }>
  ranges: IpRange[]
  range_count: number
}

interface IpPage {
  count: number
  page: number
  page_size: number
  pages: number
  generated_at: string
  summary: IpSummary
  results: FlashIp[]
}

interface DedicatedRow {
  id: string
  address: string
  server_name: string
  note: string
  is_active: boolean
  created_at: string
}

interface HistClaim {
  id: string
  name: string
  short_id: string
  machine_no: number | null
  microvm_id: string
  status: string
  status_display: string
  owner: FlashOwner
  organization: FlashOrg
  node: string
  region: string
  plan: string
  traffic_used_bytes: number
  created_at: string
  ended_at: string | null
  is_current: boolean
  is_dead: boolean
}

interface HistEvent {
  id: string
  vm: string
  short_id: string
  type: string
  type_display: string
  description: string
  created_at: string
}

interface HistPool {
  is_active: boolean
  state: string
  mac: string
  gateway: string | null
  region: string | null
  node: string | null
}

interface HistPayload {
  address: string
  geo: "iran" | "foreign"
  ip_found: boolean
  pool: HistPool | null
  current: HistClaim | null
  claims: HistClaim[]
  claim_count: number
  live_claim_count: number
  note: string
  events: HistEvent[]
  generated_at: string
}

const PAGE_SIZE = 25

const VM_ORDERINGS = [
  { value: "created", label: "جدیدترین — قدیمی‌ترین در انتها (پیش‌فرض)" },
  { value: "expiry", label: "نزدیک‌ترین تاریخ انقضا" },
  { value: "usage", label: "بیشترین مصرف ترافیک" },
  { value: "remaining", label: "کمترین ترافیک باقی‌مانده" },
]

const VM_STATUS: Record<string, { label: string; chip: string; dot: string }> = {
  running: { label: "در حال اجرا", chip: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  stopped: { label: "متوقف", chip: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
  creating: { label: "در حال ساخت", chip: "bg-sky-50 text-sky-700", dot: "bg-sky-500" },
  suspended: { label: "معلق", chip: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  error: { label: "خطا", chip: "bg-rose-50 text-rose-700", dot: "bg-rose-500" },
  deleting: { label: "در حال حذف", chip: "bg-slate-100 text-slate-500", dot: "bg-slate-400" },
  deleted: { label: "حذف‌شده", chip: "bg-slate-100 text-slate-500", dot: "bg-slate-300" },
}

const IP_STATES = [
  { value: "assigned", label: "دست مشتری" },
  { value: "free", label: "آزاد (استخر)" },
  { value: "reserved", label: "رزروی (بلاک / فیلتر / ایران‌اکسس)" },
  { value: "stale", label: "نیازمند بازپس‌گیری" },
  { value: "dedicated", label: "سرور اختصاصی" },
  { value: "unregistered", label: "خارج از استخر" },
]

const IP_STATE_STYLE: Record<string, { label: string; chip: string }> = {
  assigned: { label: "دست مشتری", chip: "bg-emerald-50 text-emerald-700" },
  free: { label: "آزاد (استخر)", chip: "bg-sky-50 text-sky-700" },
  reserved: { label: "رزروی (بلاک / فیلتر)", chip: "bg-rose-50 text-rose-700" },
  stale: { label: "نیازمند بازپس‌گیری", chip: "bg-amber-50 text-amber-700" },
  dedicated: { label: "سرور اختصاصی", chip: "bg-indigo-50 text-indigo-700" },
  unregistered: { label: "خارج از استخر", chip: "bg-slate-100 text-slate-500" },
}

const faNumber = new Intl.NumberFormat("fa-IR")
const faDate = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" })
const faDateTime = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" })

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—"
  return faNumber.format(value)
}

function formatToman(value: number | null | undefined): string {
  if (!value) return "—"
  return `${faNumber.format(value)} تومان`
}

function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return "—"
  if (bytes === 0) return "۰ بایت"
  const units = ["بایت", "KB", "MB", "GB", "TB", "PB"]
  let index = 0
  let size = bytes
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024
    index += 1
  }
  const text = size >= 10 || index === 0 ? size.toFixed(0) : size.toFixed(1)
  return `${faNumber.format(Number(text))} ${units[index]}`
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  return faDate.format(new Date(value))
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—"
  return faDateTime.format(new Date(value))
}

function extractError(error: unknown): string {
  if (!error) return "خطای نامشخص"
  const axiosLike = error as { response?: { data?: unknown } }
  const data = axiosLike.response?.data
  if (typeof data === "string") return data
  if (data && typeof data === "object") {
    const details = data as { detail?: string; error?: string }
    if (typeof details.detail === "string") return details.detail
    if (typeof details.error === "string") return details.error
  }
  const message = error instanceof Error ? error.message : String(error)
  return `خطا در دریافت اطلاعات: ${message}`
}

function daysLabel(vm: FlashVm): { text: string; chip: string } {
  if (vm.days_remaining === null) return { text: "بدون تاریخ انقضا", chip: "bg-slate-100 text-slate-500" }
  if (vm.is_expired) return { text: "منقضی شده", chip: "bg-rose-50 text-rose-700" }
  if (vm.days_remaining === 0) return { text: "کمتر از ۱ روز", chip: "bg-rose-50 text-rose-700" }
  const chip =
    vm.days_remaining <= 3
      ? "bg-rose-50 text-rose-700"
      : vm.days_remaining <= 7
        ? "bg-amber-50 text-amber-700"
        : vm.days_remaining <= 14
          ? "bg-sky-50 text-sky-700"
          : "bg-emerald-50 text-emerald-700"
  return { text: `${formatNumber(vm.days_remaining)} روز مانده`, chip }
}

function trafficTone(percent: number): string {
  if (percent >= 90) return "bg-rose-500"
  if (percent >= 70) return "bg-amber-500"
  return "bg-emerald-500"
}

function ownerName(owner: FlashOwner | null | undefined): string {
  if (!owner || !owner.display_name) return "—"
  return owner.display_name
}

function StatusChip({ vm }: { vm: FlashVm }) {
  const meta = VM_STATUS[vm.status] ?? { label: vm.status_display || vm.status, chip: "bg-slate-100 text-slate-600", dot: "bg-slate-400" }
  return (
    <div className="flex flex-col gap-1">
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
          meta.chip,
        )}
      >
        <span className={cn("size-1.5 rounded-full", meta.dot)} />
        {meta.label}
      </span>
      {vm.suspended_reason_display ? (
        <span className="text-[10px] text-amber-600">{vm.suspended_reason_display}</span>
      ) : null}
    </div>
  )
}

function MetaCard({
  title,
  value,
  note,
  highlight,
}: {
  title: string
  value: string
  note?: string
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-white p-4",
        highlight ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200",
      )}
    >
      <p className="text-xs text-slate-500">{title}</p>
      <p className="mt-1 text-xl font-semibold text-slate-800">{value}</p>
      {note ? <p className="mt-0.5 text-[11px] text-slate-400">{note}</p> : null}
    </div>
  )
}

function TrafficCell({ total, used, remaining, percent }: {
  total: number
  used: number
  remaining: number
  percent: number
}) {
  return (
    <div className="min-w-[150px]">
      <p className="text-sm">
        <span className="font-medium text-slate-700">باقی‌مانده {formatBytes(remaining)}</span>
        <span className="text-slate-400"> از {formatBytes(total)}</span>
      </p>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn("h-full rounded-full transition-all", trafficTone(percent))}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
        <span>مصرف {formatNumber(Math.round(percent))}٪</span>
        <span>{formatBytes(used)}</span>
      </div>
    </div>
  )
}

function OwnerCell({ vm }: { vm: FlashVm }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 font-medium text-slate-800">
        <UserRound className="size-3.5 text-slate-400" />
        {ownerName(vm.owner)}
      </p>
      <p className="mt-0.5 text-xs text-slate-500">{vm.organization.name}</p>
      {vm.owner.mobile ? <p className="text-xs text-slate-400" dir="ltr">{vm.owner.mobile}</p> : null}
      {vm.owner.email ? <p className="text-[11px] text-slate-400" dir="ltr">{vm.owner.email}</p> : null}
    </div>
  )
}

function CredentialCell({ vm }: { vm: FlashVm }) {
  const [visible, setVisible] = useState(false)
  const [copied, setCopied] = useState(false)
  const password = vm.credential.password

  const copy = async () => {
    if (!password) return
    try {
      await navigator.clipboard.writeText(password)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="flex flex-col gap-1" dir="ltr">
      <p className="text-xs font-medium text-slate-700">
        {vm.credential.username}
        {vm.network.ssh_port ? <span className="text-slate-400"> :{vm.network.ssh_port}</span> : null}
      </p>
      {password ? (
        <div className="flex items-center gap-1">
          <code className="rounded bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-600">
            {visible ? password : "•".repeat(Math.min(password.length, 10))}
          </code>
          <button
            type="button"
            onClick={() => setVisible((value) => !value)}
            className="rounded p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            title={visible ? "پنهان کردن رمز" : "نمایش رمز"}
          >
            {visible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </button>
          <button
            type="button"
            onClick={copy}
            className="rounded p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            title="کپی رمز"
          >
            {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
          </button>
        </div>
      ) : (
        <span className="text-[11px] text-slate-400">—</span>
      )}
    </div>
  )
}

function PlanCell({ plan, image }: { plan: FlashPlan; image: string | null }) {
  return (
    <div>
      <p className="font-medium text-slate-800">{plan.name}</p>
      <p className="mt-0.5 text-[11px] text-slate-500" dir="ltr">
        {formatNumber(plan.cpu_cores)} vCPU · {formatBytes(plan.memory_gib * 1024 ** 3)} · {formatBytes(plan.storage_gib * 1024 ** 3)}
      </p>
      <p className="mt-0.5 text-[11px] text-slate-400">
        {plan.billing_mode_display} · {formatToman(plan.price_monthly_snapshot || plan.price_monthly)}
      </p>
      {image ? <p className="text-[10px] text-slate-400">{image}</p> : null}
    </div>
  )
}

const flashHrefRe = /haioflash/

export default function HaioflashPage() {
  const { user, isLoading: authLoading } = useAuthStore()
  const allowed = useMemo(
    () => Boolean(user && navItemsForUser(user).some((item) => flashHrefRe.test(item.href))),
    [user],
  )

  const [tab, setTab] = useState<"vms" | "ips" | "dedicated" | "history">("vms")
  const fetchVmsRef = useRef(0)
  const fetchIpsRef = useRef(0)
  const fetchHistRef = useRef(0)
  const fetchDedRef = useRef(0)

  // --- machines -----------------------------------------------------------
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const [ordering, setOrdering] = useState("created")
  const [page, setPage] = useState(1)
  const [vmData, setVmData] = useState<VmPage | null>(null)
  const [vmLoading, setVmLoading] = useState(false)
  const [vmError, setVmError] = useState("")

  // --- IP registry --------------------------------------------------------
  const [ipSearchInput, setIpSearchInput] = useState("")
  const [ipSearch, setIpSearch] = useState("")
  const [ipState, setIpState] = useState("")
  const [ipData, setIpData] = useState<IpPage | null>(null)
  const [ipLoading, setIpLoading] = useState(false)
  const [ipError, setIpError] = useState("")

  // --- dedicated servers --------------------------------------------------
  const [dedData, setDedData] = useState<DedicatedRow[] | null>(null)
  const [dedLoading, setDedLoading] = useState(false)
  const [dedError, setDedError] = useState("")
  const [dedAddress, setDedAddress] = useState("")
  const [dedServerName, setDedServerName] = useState("")
  const [dedNote, setDedNote] = useState("")
  const [dedSaving, setDedSaving] = useState(false)
  const [dedRowEditing, setDedRowEditing] = useState<DedicatedRow | null>(null)

  // --- IP history ---------------------------------------------------------
  const [histInput, setHistInput] = useState("")
  const [histAddress, setHistAddress] = useState("")
  const [histData, setHistData] = useState<HistPayload | null>(null)
  const [histLoading, setHistLoading] = useState(false)
  const [histError, setHistError] = useState("")

  // debounce both searches
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch((current) => (searchInput === current ? current : searchInput))
      setPage(1)
    }, 400)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIpSearch((current) => (ipSearchInput === current ? current : ipSearchInput))
    }, 400)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ipSearchInput])

  const fetchVms = useCallback(async () => {
    if (!allowed) return
    const requestId = ++fetchVmsRef.current
    setVmLoading(true)
    setVmError("")
    try {
      const params: Record<string, string | number> = {
        page,
        page_size: PAGE_SIZE,
        ordering,
      }
      if (search) params.search = search
      if (status) params.status = status
      const resp = await api.get<VmPage>("/panel/haioflash/vms/", { params })
      if (fetchVmsRef.current !== requestId) return
      setVmData(resp.data)
    } catch (error) {
      if (fetchVmsRef.current === requestId) setVmError(extractError(error))
    } finally {
      if (fetchVmsRef.current === requestId) setVmLoading(false)
    }
  }, [allowed, page, ordering, search, status])

  const fetchIps = useCallback(async () => {
    if (!allowed) return
    const requestId = ++fetchIpsRef.current
    setIpLoading(true)
    setIpError("")
    try {
      const params: Record<string, string | number> = {
        page_size: 200,
      }
      if (ipSearch) params.search = ipSearch
      if (ipState) params.state = ipState
      const resp = await api.get<IpPage>("/panel/haioflash/ips/", { params })
      if (fetchIpsRef.current !== requestId) return
      setIpData(resp.data)
    } catch (error) {
      if (fetchIpsRef.current === requestId) setIpError(extractError(error))
    } finally {
      if (fetchIpsRef.current === requestId) setIpLoading(false)
    }
  }, [allowed, ipSearch, ipState])

  const fetchDedicated = useCallback(async () => {
    if (!allowed) return
    const requestId = ++fetchDedRef.current
    setDedLoading(true)
    setDedError("")
    try {
      const resp = await api.get<DedicatedRow[]>("/panel/haioflash/dedicated/", {
        params: { page_size: 50 },
      })
      if (fetchDedRef.current !== requestId) return
      setDedData(Array.isArray(resp.data) ? resp.data : (resp.data as unknown as { results?: DedicatedRow[] } & DedicatedRow[]).results ?? [])
    } catch (error) {
      if (fetchDedRef.current === requestId) setDedError(extractError(error))
    } finally {
      if (fetchDedRef.current === requestId) setDedLoading(false)
    }
  }, [allowed])

  const saveDedicated = useCallback(async () => {
    const address = dedAddress.trim()
    if (!address) return
    const requestId = ++fetchDedRef.current
    setDedSaving(true)
    setDedError("")
    try {
      await api.post("/panel/haioflash/dedicated/", {
        address,
        server_name: dedServerName.trim(),
        note: dedNote.trim(),
      })
      setDedAddress("")
      setDedServerName("")
      setDedNote("")
      await fetchDedicated()
    } catch (error) {
      setDedError(extractError(error))
    } finally {
      void requestId
      setDedSaving(false)
    }
  }, [allowed, dedAddress, dedServerName, dedNote, fetchDedicated])

  const updateDedicated = useCallback(async (row: DedicatedRow, patch: Record<string, unknown>) => {
    setDedError("")
    try {
      await api.patch(`/panel/haioflash/dedicated/${row.id}/`, patch)
      await fetchDedicated()
    } catch (error) {
      setDedError(extractError(error))
    }
  }, [fetchDedicated])

  const deleteDedicated = useCallback(async (row: DedicatedRow) => {
    if (!window.confirm(`آی‌پی ${row.address} از سرورهای اختصاصی حذف شود؟`)) return
    setDedError("")
    try {
      await api.delete(`/panel/haioflash/dedicated/${row.id}/`)
      await fetchDedicated()
    } catch (error) {
      setDedError(extractError(error))
    }
  }, [fetchDedicated])

  const fetchHistory = useCallback(async () => {
    if (!allowed || !histAddress) return
    const requestId = ++fetchHistRef.current
    setHistLoading(true)
    setHistError("")
    try {
      const resp = await api.get<HistPayload>("/panel/haioflash/ip-history/", {
        params: { address: histAddress },
      })
      if (fetchHistRef.current !== requestId) return
      setHistData(resp.data)
    } catch (error) {
      if (fetchHistRef.current === requestId) setHistError(extractError(error))
    } finally {
      if (fetchHistRef.current === requestId) setHistLoading(false)
    }
  }, [allowed, histAddress])

  useEffect(() => {
    if (tab !== "history" || !histAddress) return
    void fetchHistory()
  }, [tab, fetchHistory])

  useEffect(() => {
    void fetchVms()
  }, [fetchVms])

  useEffect(() => {
    if (tab !== "ips") return
    void fetchIps()
  }, [tab, fetchIps])

  useEffect(() => {
    if (tab !== "dedicated") return
    void fetchDedicated()
  }, [tab, fetchDedicated])

  if (authLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="size-6 animate-spin" />
      </div>
    )
  }

  if (!allowed) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
        <p className="text-lg font-medium text-amber-700">دسترسی محدود</p>
        <p className="mt-1 text-sm text-amber-600">این بخش فقط برای مدیر و تیم فنی باز است.</p>
      </div>
    )
  }

  const vmSummary = vmData?.summary
  const ipSummary = ipData?.summary

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">هایوفلش</h1>
          <p className="mt-1 text-sm text-slate-500">
            کل سرورهای ابری کاربران — شماره ماشین، مالک، آی‌پی، اطلاعات ورود، تاریخ ساخت و انقضا، مصرف ترافیک و پلن.
            زیرتب «موجودی آی‌پی» کل ۱۲۸ آی‌پی شاتل تهران را وضعیت‌به‌وضعیت نشان می‌دهد، زیرتب «سوابق آی‌پی» تاریخچهٔ مالکیت هر آی‌پی و زیرتب «سرور اختصاصی» آی‌پی‌های رزروشدهٔ سرورهای اختصاصی.
          </p>
          {vmData ? (
            <p className="mt-1 text-xs text-slate-400">آخرین بروزرسانی: {formatDateTime(vmData.generated_at)}</p>
          ) : null}
        </div>
        <Button
          variant="outline"
          onClick={() =>
            tab === "vms"
              ? fetchVms()
              : tab === "ips"
                ? fetchIps()
                : tab === "dedicated"
                  ? fetchDedicated()
                  : fetchHistory()
          }
          disabled={vmLoading || ipLoading || dedLoading || histLoading}
        >
          <RefreshCw
            className={cn(
              "size-4",
              (tab === "vms" ? vmLoading : tab === "ips" ? ipLoading : tab === "dedicated" ? dedLoading : histLoading) &&
                "animate-spin",
            )}
          />
          بروزرسانی
        </Button>
      </div>

      {/* sub-tabs */}
      <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
        <button
          type="button"
          onClick={() => setTab("vms")}
          className={cn(
            "rounded-lg px-4 py-1.5 text-sm font-medium transition",
            tab === "vms" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50",
          )}
        >
          سرورها
        </button>
        <button
          type="button"
          onClick={() => setTab("ips")}
          className={cn(
            "rounded-lg px-4 py-1.5 text-sm font-medium transition",
            tab === "ips" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50",
          )}
        >
          موجودی آی‌پی
        </button>
        <button
          type="button"
          onClick={() => setTab("dedicated")}
          className={cn(
            "rounded-lg px-4 py-1.5 text-sm font-medium transition",
            tab === "dedicated" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50",
          )}
        >
          سرور اختصاصی
        </button>
        <button
          type="button"
          onClick={() => setTab("history")}
          className={cn(
            "rounded-lg px-4 py-1.5 text-sm font-medium transition",
            tab === "history" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50",
          )}
        >
          سوابق آی‌پی
        </button>
      </div>

      {tab === "vms" ? (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            <MetaCard title="کل سرورها" value={formatNumber(vmSummary?.total)} note="به‌جز حذف‌شده‌ها" />
            <MetaCard title="در حال اجرا" value={formatNumber(vmSummary?.running)} note="فعال و روشن" highlight />
            <MetaCard title="متوقف" value={formatNumber(vmSummary?.stopped)} note="روشن نیست" />
            <MetaCard title="در حال ساخت" value={formatNumber(vmSummary?.creating)} note="در صف پرووژن" />
            <MetaCard title="معلق" value={formatNumber(vmSummary?.suspended)} note="نیازمند بررسی" />
            <MetaCard title="خطا" value={formatNumber(vmSummary?.error)} note="نیازمند رسیدگی" />
            <MetaCard
              title={`رو به انقضا (${formatNumber(vmSummary?.expiring_days ?? 7)} روز)`}
              value={formatNumber(vmSummary?.expiring_soon)}
              note="نیاز به تمدید"
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-[1fr_1fr_260px]">
            <MetaCard title="ترافیک مصرف‌شده کل" value={formatBytes(vmSummary?.traffic_used)} />
            <MetaCard title="ترافیک باقی‌مانده کل" value={formatBytes(vmSummary?.traffic_remaining)} note={`از ${formatBytes(vmSummary?.traffic_total)}`} highlight />
            <MetaCard title="سرورهای ساعتی" value={formatNumber(vmSummary?.hourly)} note="billing_mode = hourly" />
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
            <div className="relative min-w-[240px] flex-1">
              <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="جستجو با نام سرور، آی‌پی، مالک، موبایل یا پلن…"
                className="pr-9"
              />
            </div>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value)
                setPage(1)
              }}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
            >
              <option value="">همه وضعیت‌ها</option>
              {Object.entries(VM_STATUS).map(([value, meta]) => (
                <option key={value} value={value}>{meta.label}</option>
              ))}
            </select>
            <select
              value={ordering}
              onChange={(event) => {
                setOrdering(event.target.value)
                setPage(1)
              }}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
            >
              {VM_ORDERINGS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          {vmError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{vmError}</div>
          ) : null}

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-[1440px] w-full text-right text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                  <th className="px-4 py-3 font-medium">ماشین</th>
                  <th className="px-4 py-3 font-medium">برای چه کسی</th>
                  <th className="px-4 py-3 font-medium">پلن</th>
                  <th className="px-4 py-3 font-medium">وضعیت</th>
                  <th className="px-4 py-3 font-medium">آی‌پی و شبکه</th>
                  <th className="px-4 py-3 font-medium">اطلاعات ورود</th>
                  <th className="px-4 py-3 font-medium">ترافیک مصرف‌شده و باقی‌مانده</th>
                  <th className="px-4 py-3 font-medium">باقی‌مانده از انقضا</th>
                  <th className="px-4 py-3 font-medium">تاریخ ساخت</th>
                </tr>
              </thead>
              <tbody>
                {vmLoading && !vmData ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-16 text-center text-slate-400">
                      <Loader2 className="mx-auto size-6 animate-spin" />
                    </td>
                  </tr>
                ) : (vmData?.results.length ?? 0) === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-16 text-center text-slate-400">
                      سروری با این فیلترها پیدا نشد.
                    </td>
                  </tr>
                ) : (
                  vmData?.results.map((vm) => {
                    const days = daysLabel(vm)
                    return (
                      <tr key={vm.id} className="border-b border-slate-100 align-top last:border-0 hover:bg-slate-50/60">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Server className="size-4 text-slate-400" />
                            <div>
                              <p className="font-medium text-slate-800">{vm.name}</p>
                              <p className="text-[11px] text-slate-400">
                                {vm.machine_no ? (
                                  <span>ماشین {formatNumber(vm.machine_no)}</span>
                                ) : (
                                  <span dir="ltr">{vm.short_id}</span>
                                )}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3"><OwnerCell vm={vm} /></td>
                        <td className="px-4 py-3"><PlanCell plan={vm.plan} image={vm.image} /></td>
                        <td className="px-4 py-3"><StatusChip vm={vm} /></td>
                        <td className="px-4 py-3" dir="ltr">
                          <p className="font-mono text-xs text-slate-700">{vm.network.ipv4 ?? "—"}</p>
                          {vm.network.ipv6 ? <p className="font-mono text-[10px] text-slate-400">{vm.network.ipv6}</p> : null}
                          <p className="font-mono text-[10px] text-slate-400">{vm.network.mac}</p>
                          <p className="text-[10px] text-slate-400" dir="rtl">{vm.node.name} · {vm.node.region}</p>
                          {vm.ip_shared ? (
                            <span className="mt-1 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700" dir="rtl">
                              ردیف تکراری — «{vm.ip_shared.name}» هم این آی‌پی را دارد ({vm.ip_shared.status_display}) — سابقه را در زیرتب «سوابق آی‌پی» ببینید
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3"><CredentialCell vm={vm} /></td>
                        <td className="px-4 py-3">
                          <TrafficCell
                            total={vm.traffic.total_bytes}
                            used={vm.traffic.used_bytes}
                            remaining={vm.traffic.remaining_bytes}
                            percent={vm.traffic.percent}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn("inline-block rounded-full px-2 py-0.5 text-[11px] font-medium", days.chip)}>
                            {days.text}
                          </span>
                          <p className="mt-1 text-[11px] text-slate-400">{formatDate(vm.expired_at)}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">{formatDate(vm.created_at)}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
            <p>{formatNumber(vmData?.count)} سرور · صفحه {formatNumber(vmData?.page)} از {formatNumber(vmData?.pages)}</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={(vmData?.page ?? 1) <= 1} onClick={() => setPage((value) => value - 1)}>
                <ChevronRight className="size-4" /> قبلی
              </Button>
              <Button variant="outline" size="sm" disabled={(vmData?.page ?? 1) >= (vmData?.pages ?? 1)} onClick={() => setPage((value) => value + 1)}>
                بعدی <ChevronLeft className="size-4" />
              </Button>
            </div>
          </div>
        </section>
      ) : tab === "ips" ? (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            <MetaCard title="کل آی‌پی‌ها" value={formatNumber(ipSummary?.total)} note={`${formatNumber(ipSummary?.range_count)} رنج ۶۴تایی شاتل`} highlight />
            <MetaCard
              title="دست مشتری"
              value={formatNumber(ipSummary?.assigned)}
              note={`در حال اجرا ${formatNumber(ipSummary?.running)} · متوقف ${formatNumber(ipSummary?.stopped)} · ساسپند ${formatNumber(ipSummary?.suspended)}`}
            />
            <MetaCard title="آزاد (استخر)" value={formatNumber(ipSummary?.free)} note="قابل اختصاص" />
            <MetaCard title="رزروی (بلاک/فیلتر/ایران‌اکسس)" value={formatNumber(ipSummary?.reserved)} note="قابل استفاده نیست" />
            <MetaCard title="سرور اختصاصی" value={formatNumber(ipSummary?.dedicated)} note="رزرو دست خودمان" />
            <MetaCard title="نیازمند بازپس‌گیری" value={formatNumber(ipSummary?.stale)} note="فقط ردیف حذف‌شده مانده" />
            <MetaCard title="خارج از استخر" value={formatNumber(ipSummary?.unregistered)} note={`قابل استفاده در مجموع: ${formatNumber(ipSummary?.usable)}`} />
          </div>

          <p className="text-xs text-slate-400">
            کل فضای شاتل تهران {formatNumber(ipSummary?.total)} آی‌پی در {formatNumber(ipSummary?.range_count)} رنج ۶۴تایی (۹۴٫۱۸۲٫۹۴٫۰–۶۳ و ۹۴٫۱۸۲٫۱۷۲٫۶۴–۱۲۷) است؛
            {" "}{formatNumber(ipSummary?.vm_claim_count)} سرور روی این فضا ثبت‌شده و رنج‌های خارج از ایران نمایش داده نمی‌شوند.
          </p>

          {ipSummary?.ranges.length ? (
            <div>
              <p className="mb-2 text-sm font-medium text-slate-600">
                رنج‌ها — از چه آی‌پی تا چه آی‌پی:
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {ipSummary.ranges.map((range) => (
                  <div key={`${range.from}-${range.to}`} className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3" dir="ltr">
                    <p className="font-mono text-sm font-medium text-slate-800">
                      {range.from} <span className="text-slate-400">→</span> {range.to}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">{faNumber.format(range.count)} آی‌پی</p>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]" dir="rtl">
                      <span className="text-emerald-600">دست مشتری {faNumber.format(range.assigned)}</span>
                      <span className="text-sky-600">آزاد {faNumber.format(range.free)}</span>
                      {range.reserved ? <span className="text-rose-600">رزروی {faNumber.format(range.reserved)}</span> : null}
                      {range.stale ? <span className="text-amber-600">بازپس‌گیری {faNumber.format(range.stale)}</span> : null}
                      {range.dedicated ? <span className="text-indigo-600">اختصاصی {faNumber.format(range.dedicated)}</span> : null}
                      <span className="text-slate-500">خارج از استخر {faNumber.format(range.unregistered)}</span>
                    </div>
                  </div>
                ))}
              </div>
              {ipSummary.duplicate_addresses?.length ? (
                <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                  هشدار: {formatNumber(ipSummary.duplicate_addresses.length)} آی‌پی بیش از یک ردیف زنده دارد —{" "}
                  {ipSummary.duplicate_addresses
                    .map((d) => {
                      const addr = typeof d === "string" ? d : (d as { address?: string }).address ?? "";
                      const names: string[] = typeof d === "string" ? [] : ((d as { names?: string[] }).names ?? []);
                      return names.length ? `${addr} (${names.join(" و ")})` : addr;
                    })
                    .join("، ")}. ردیف‌های تکراری نیازمند پاکسازی‌اند.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
            <div className="relative min-w-[240px] flex-1">
              <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={ipSearchInput}
                onChange={(event) => setIpSearchInput(event.target.value)}
                placeholder="جستجو با آی‌پی، نام سرور، مالک یا موبایل…"
                className="pr-9"
              />
            </div>
            <select
              value={ipState}
              onChange={(event) => setIpState(event.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
            >
              <option value="">همه حالت‌ها</option>
              {IP_STATES.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          {ipError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{ipError}</div>
          ) : null}

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-[900px] w-full text-right text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                  <th className="px-4 py-3 font-medium">آی‌پی</th>
                  <th className="px-4 py-3 font-medium">وضعیت</th>
                  <th className="px-4 py-3 font-medium">سرور / سرور اختصاصی</th>
                  <th className="px-4 py-3 font-medium">نود / ناحیه</th>
                </tr>
              </thead>
              <tbody>
                {ipLoading && !ipData ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-16 text-center text-slate-400">
                      <Loader2 className="mx-auto size-6 animate-spin" />
                    </td>
                  </tr>
                ) : (ipData?.results.length ?? 0) === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-16 text-center text-slate-400">
                      آی‌پی‌ای با این فیلترها پیدا نشد.
                    </td>
                  </tr>
                ) : (
                  ipData?.results.map((ip) => {
                    const meta = IP_STATE_STYLE[ip.state]
                    return (
                      <tr key={ip.address} className="border-b border-slate-100 align-top last:border-0 hover:bg-slate-50/60">
                        <td className="px-4 py-3" dir="ltr">
                          <p className="font-mono text-sm font-medium text-slate-800">{ip.address}</p>
                          {ip.mac ? <p className="font-mono text-[10px] text-slate-400">{ip.mac}</p> : null}
                          {ip.gateway ? <p className="font-mono text-[10px] text-slate-400">GW {ip.gateway}</p> : null}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn("inline-block rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", meta?.chip ?? "bg-slate-100 text-slate-600")}>
                            {ip.state_display || meta?.label || ip.state}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {ip.dedicated ? (
                            <div>
                              <p className="font-medium text-indigo-700">{ip.dedicated.server_name || "سرور اختصاصی"}</p>
                              {ip.dedicated.note ? <p className="text-[11px] text-slate-400">{ip.dedicated.note}</p> : null}
                            </div>
                          ) : ip.vm ? (
                            <div>
                              <p className="font-medium text-slate-700">{ip.vm.name}</p>
                              <p className="text-[11px] text-slate-400">
                                {ip.vm.status_display} · {ip.vm.machine_no ? `ماشین ${formatNumber(ip.vm.machine_no)}` : ip.vm.short_id}
                              </p>
                              <p className="text-[11px] text-slate-500">{ip.vm.owner?.display_name || "—"}</p>
                              {ip.vm.owner?.mobile ? <p className="text-[11px] text-slate-400" dir="ltr">{ip.vm.owner.mobile}</p> : null}
                              {ip.extra_claims.length ? (
                                <p className="mt-1 text-[10px] text-amber-600">
                                  ردیف تکراری: {ip.extra_claims.map((c) => `${c.name} (${c.status_display})`).join("، ")} — سابقه را در «سوابق آی‌پی» ببینید
                                </p>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {ip.region ?? "—"}
                          {ip.node ? <p className="text-[11px] text-slate-400">{ip.node}</p> : null}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-slate-400">{formatNumber(ipData?.count)} آی‌پی · کل استخر به‌صورت یکجا (۱۲۸ آدرس) بدون صفحه‌بندی.</p>
        </section>
      ) : tab === "dedicated" ? (
        <section className="space-y-4">
          <p className="text-xs text-slate-500">
            آی‌پی‌هایی که از فضای شاتل تهران رزرو کرده‌ایم و به سرورهای اختصاصی داده شده‌اند — این آی‌پی‌ها در «موجودی آی‌پی» مستقل از استخر مشتری‌ها شمرده می‌شوند.
          </p>

          {dedError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{dedError}</div>
          ) : null}

          <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-3">
            <div className="min-w-[180px] flex-1">
              <label className="mb-1 block text-xs text-slate-500">آدرس آی‌پی</label>
              <Input
                value={dedAddress}
                onChange={(event) => setDedAddress(event.target.value)}
                placeholder="94.182.94.57"
                dir="ltr"
                className="font-mono text-left"
              />
            </div>
            <div className="min-w-[160px] flex-1">
              <label className="mb-1 block text-xs text-slate-500">نام سرور اختصاصی</label>
              <Input
                value={dedServerName}
                onChange={(event) => setDedServerName(event.target.value)}
                placeholder="مثلاً ts1-core"
              />
            </div>
            <div className="min-w-[200px] flex-[2]">
              <label className="mb-1 block text-xs text-slate-500">توضیح</label>
              <Input
                value={dedNote}
                onChange={(event) => setDedNote(event.target.value)}
                placeholder="اختیاری"
              />
            </div>
            <Button onClick={() => void saveDedicated()} disabled={dedSaving || !dedAddress.trim()}>
              {dedSaving ? <Loader2 className="size-4 animate-spin" /> : null}
              ثبت
            </Button>
          </div>

          {dedLoading && !dedData ? (
            <div className="flex h-40 items-center justify-center text-slate-400">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : (dedData?.length ?? 0) === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-400">
              هنوز آی‌پی‌ای برای سرور اختصاصی ثبت نشده است.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {dedData?.map((row) => (
                <div key={row.id} className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-sm font-medium text-slate-800" dir="ltr">{row.address}</p>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-medium",
                        row.is_active ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500",
                      )}
                    >
                      {row.is_active ? "فعال" : "غیرفعال"}
                    </span>
                  </div>
                  {dedRowEditing?.id === row.id ? (
                    <div className="mt-2 space-y-2">
                      <Input
                        value={dedRowEditing.server_name}
                        onChange={(event) =>
                          setDedRowEditing({ ...dedRowEditing, server_name: event.target.value })
                        }
                        placeholder="نام سرور"
                      />
                      <Input
                        value={dedRowEditing.note}
                        onChange={(event) => setDedRowEditing({ ...dedRowEditing, note: event.target.value })}
                        placeholder="توضیح"
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            void updateDedicated(row, {
                              server_name: dedRowEditing.server_name,
                              note: dedRowEditing.note,
                            })
                            setDedRowEditing(null)
                          }}
                        >
                          ذخیره
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setDedRowEditing(null)}>
                          انصراف
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="mt-2 font-semibold text-indigo-700">
                        {row.server_name || "بدون نام"}
                      </p>
                      {row.note ? <p className="mt-0.5 text-[11px] text-slate-500">{row.note}</p> : null}
                      <p className="mt-1 text-[10px] text-slate-400">ثبت: {formatDate(row.created_at)}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => setDedRowEditing(row)}>
                          ویرایش
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void deleteDedicated(row)}>
                          حذف
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="space-y-4">
          {/* IP history lookup */}
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
            <Input
              value={histInput}
              onChange={(event) => setHistInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") setHistAddress(histInput.trim())
              }}
              placeholder="آدرس آی‌پی را وارد کنید… مثلاً 94.182.94.50"
              dir="ltr"
              className="min-w-[260px] flex-1 font-mono text-left"
            />
            <Button size="sm" onClick={() => setHistAddress(histInput.trim())} disabled={histLoading}>
              {histLoading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              بررسی
            </Button>
            {histAddress ? (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 font-mono text-xs text-slate-600" dir="ltr">
                {histAddress}
              </span>
            ) : null}
          </div>

          {histError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{histError}</div>
          ) : null}

          {!histData && !histLoading && !histError ? (
            <p className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
              آی‌پی یک سرور را وارد کنید تا مشخص شود الان دست چه کسی است و پیش‌تر در چه تاریخ‌هایی دست کدام کاربر بوده است.
            </p>
          ) : null}

          {histData ? (
            <>
              <div>
                <p className="text-sm font-medium text-slate-600">
                  وضعیت فعلی {histData.geo === "iran" ? "(ایران — شاتل)" : "(خارج از ایران — بدون سرویس)"}
                </p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {histData.current ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
                      <p className="text-xs text-emerald-700">در حال حاضر دست</p>
                      <p className="mt-1 text-lg font-semibold text-slate-800">{ownerName(histData.current.owner)}</p>
                      {histData.current.owner.mobile ? (
                        <p className="text-xs text-slate-500" dir="ltr">{histData.current.owner.mobile}</p>
                      ) : null}
                      {histData.current.owner.email ? (
                        <p className="text-[11px] text-slate-400" dir="ltr">{histData.current.owner.email}</p>
                      ) : null}
                      <p className="mt-1.5 text-xs text-slate-600">
                        سرور «{histData.current.name}» — {histData.current.status_display}
                        {histData.current.microvm_id ? <span className="text-slate-400" dir="ltr"> · {histData.current.microvm_id.slice(0, 12)}</span> : null}
                      </p>
                      <p className="text-[11px] text-slate-400">{histData.current.node} · {histData.current.region}</p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        از تاریخ {formatDate(histData.current.created_at)}
                        {histData.current.ended_at ? ` تا ${formatDate(histData.current.ended_at)}` : " تاکنون"}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="text-xs text-slate-500">مالک فعلی</p>
                      <p className="mt-1 text-sm text-slate-600">الان دست هیچ سروری نیست</p>
                      {histData.pool ? (
                        <p className="mt-1 text-[11px] text-slate-400">
                          وضعیت استخر: {histData.pool.is_active ? "فعال" : "غیرفعال / قرنطینه"} · {histData.pool.state}
                          {histData.pool.region ? ` · ${histData.pool.region}` : ""}
                        </p>
                      ) : (
                        <p className="mt-1 text-[11px] text-slate-400">این آی‌پی در استخر ثبت نشده است.</p>
                      )}
                    </div>
                  )}
                  <MetaCard title="تعداد سابقه‌های ثبت‌شده" value={formatNumber(histData.claim_count)} note={`${formatNumber(histData.live_claim_count)} ردیف زنده`} />
                  <MetaCard title="رخدادهای ثبت‌شده" value={formatNumber(histData.events.length)} note="روشن/خاموش، تغییر آی‌پی و…" />
                </div>
              </div>

              {histData.note ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">{histData.note}</div>
              ) : null}

              <div>
                <p className="text-sm font-medium text-slate-600">
                  سابقهٔ مالکیت {histData.address} ({formatNumber(histData.claim_count)} ردیف):
                </p>
                <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200 bg-white">
                  <table className="min-w-[900px] w-full text-right text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                        <th className="px-4 py-3 font-medium">از تاریخ</th>
                        <th className="px-4 py-3 font-medium">تا تاریخ</th>
                        <th className="px-4 py-3 font-medium">برای چه کسی</th>
                        <th className="px-4 py-3 font-medium">سرور</th>
                        <th className="px-4 py-3 font-medium">وضعیت ردیف</th>
                        <th className="px-4 py-3 font-medium">نود / ناحیه</th>
                        <th className="px-4 py-3 font-medium">مصرف ترافیک</th>
                      </tr>
                    </thead>
                    <tbody>
                      {histData.claims.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                            سابقه‌ای برای این آی‌پی ثبت نشده است.
                          </td>
                        </tr>
                      ) : (
                        histData.claims.map((claim) => {
                          const meta = VM_STATUS[claim.status]
                          return (
                            <tr key={claim.id} className={cn("border-b border-slate-100 align-top last:border-0", claim.is_current && "bg-emerald-50/40")}>
                              <td className="px-4 py-3 text-xs text-slate-600">{formatDate(claim.created_at)}</td>
                              <td className="px-4 py-3 text-xs text-slate-600">{claim.ended_at ? formatDate(claim.ended_at) : <span className="font-medium text-emerald-600">تاکنون</span>}</td>
                              <td className="px-4 py-3">
                                <p className="text-slate-800">{ownerName(claim.owner)}</p>
                                <p className="text-[11px] text-slate-400">{claim.organization.name}</p>
                                {claim.owner.mobile ? <p className="text-[11px] text-slate-400" dir="ltr">{claim.owner.mobile}</p> : null}
                              </td>
                              <td className="px-4 py-3">
                                <p className="font-medium text-slate-700">{claim.name}</p>
                                <p className="text-[11px] text-slate-400" dir="ltr">
                                  {claim.microvm_id ? claim.microvm_id.slice(0, 12) : claim.short_id}
                                </p>
                              </td>
                              <td className="px-4 py-3">
                                <span className={cn("inline-block rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", meta?.chip ?? "bg-slate-100 text-slate-600")}>
                                  {meta?.label ?? claim.status_display}
                                </span>
                                {claim.is_current ? (
                                  <span className="mt-1 block text-[10px] font-medium text-emerald-600">مالک فعلی</span>
                                ) : null}
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-500">
                                {claim.node}
                                <p className="text-[11px] text-slate-400">{claim.region}</p>
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-500">{formatBytes(claim.traffic_used_bytes)}</td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-slate-600">رخدادهای سرورهای مرتبط با این آی‌پی:</p>
                <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200 bg-white">
                  <table className="min-w-[760px] w-full text-right text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                        <th className="px-4 py-3 font-medium">تاریخ</th>
                        <th className="px-4 py-3 font-medium">سرور</th>
                        <th className="px-4 py-3 font-medium">رخداد</th>
                        <th className="px-4 py-3 font-medium">توضیح</th>
                      </tr>
                    </thead>
                    <tbody>
                      {histData.events.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-12 text-center text-slate-400">
                            برای سرورهای این آی‌پی رخدادی ثبت نشده است.
                          </td>
                        </tr>
                      ) : (
                        histData.events.map((event) => (
                          <tr key={event.id} className="border-b border-slate-100 align-top last:border-0">
                            <td className="px-4 py-3 text-xs text-slate-600">{formatDateTime(event.created_at)}</td>
                            <td className="px-4 py-3 text-xs text-slate-600">{event.vm}</td>
                            <td className="px-4 py-3 text-xs text-slate-700">{event.type_display}</td>
                            <td className="px-4 py-3 text-xs text-slate-500" dir="ltr">{event.description}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </section>
      )}
    </div>
  )
}
