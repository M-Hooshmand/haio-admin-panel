/**
 * Data model for the live infrastructure brain.
 *
 * The map is driven by real staff endpoints:
 *  - /staff/monitoring/activity/  -> online clients and the product they use
 *  - /staff/diagnostics/system/   -> Celery beat workers + platform volumes
 *  - /staff/diagnostics/issues/   -> recent incidents (red pulses)
 *
 * Product clusters are only a presentation layer: every worker on screen is a
 * real scheduled task from the backend scheduler registry.
 */

export interface MonitoringUser {
  id: number
  username: string
  email: string
  display_name: string | null
  role: string
  mobile: string
  is_active: boolean
  is_staff: boolean
  last_seen: number | null
  last_seen_label: string
  is_online: boolean
  current_section: string
  current_path?: string
  section_last_seen: number | null
}

export interface ActivitySnapshot {
  online: MonitoringUser[]
  today: MonitoringUser[]
  online_count: number
  today_count: number
  refreshed_at: string
  online_ttl_minutes: number
}

export interface SchedulerEntry {
  name: string
  task: string
  schedule?: number | string | null
}

export interface SystemSnapshot {
  checked_at: string
  database: { ok: boolean; error?: string }
  cache: { ok: boolean; error?: string }
  issues_24h: number
  issues_by_product: Record<string, number>
  critical_24h: number
  volumes: Record<string, number | string> | { error: string }
  scheduler: SchedulerEntry[]
}

export type IssueSeverity = "warning" | "error" | "critical"

export interface DiagnosticIssue {
  id: number
  source: string
  product: string
  severity: IssueSeverity
  summary: string
  detail?: string
  path?: string
  method?: string
  status_code?: number | null
  task_name?: string
  object_type?: string
  object_id?: string
  correlation_id?: string
  created_at: string
}

export interface IssuesResponse {
  count: number
  results: DiagnosticIssue[]
}

export type TaskRunStatus = "running" | "success" | "failure" | "revoked"

export interface TaskRun {
  id: number
  task_id: string
  name: string
  product: string
  status: TaskRunStatus
  worker: string
  queue: string
  args: string
  kwargs: string
  result: string
  error: string
  started_at: string
  finished_at: string | null
  duration_ms: number | null
}

export interface LiveWorkerTask {
  state: "active" | "reserved" | "scheduled" | string
  worker: string
  task_id: string | null
  name: string
  args: string
  eta: string | null
  time_start: number | null
}

export interface LiveWorker {
  hostname: string
  active: number
  reserved: number
  scheduled: number
  concurrency: number | null
  uptime: number | null
  processed: number | null
}

export interface WorkerMonitorSnapshot {
  checked_at: string
  counts: {
    running: number
    stuck: number
    success_24h: number
    failure_24h: number
    revoked_24h: number
  }
  stuck_after_minutes: number
  task_log?: boolean
  stuck_task_ids?: string[]
  stuck_reasons?: Record<string, string>
  recent: TaskRun[]
  live: {
    ok: boolean
    error?: string
    workers: LiveWorker[]
    tasks: LiveWorkerTask[]
  }
}

export interface TopologyNode {
  key: string
  product: string
  kind: string
  label: string
  code: string
  region: string
  status: string
  reachable: boolean | null
  latency_ms: number | null
  error: string
  vms: number | null
  max_vms: number | null
  capacity: Record<string, number | string | null>
  apps_by_product?: Record<string, number>
  detail: string
}

export interface McpHealth {
  name: string
  label: string
  url: string
  ok: boolean
  latency_ms: number | null
  profile: string | null
  tools: number | null
  tiered_tools: number | null
  error: string
}

export interface AgentHealth {
  total: number
  active: number
  keys_active: number
  keys_used_24h: number
  mcp_tokens_active: number
  mcp_tokens_used_24h: number
  agents: Array<{
    name: string
    active: boolean
    keys: number
    last_used_at: string | null
  }>
  guest_agents: { total: number; online: number }
  jobs: { queued: number; running: number; failed_24h: number; timeout_24h: number }
}

export interface SkillRegistry {
  configured: boolean
  root: string
  count: number
  skills: Array<{ name: string; path: string; updated_at: string }>
  error?: string
}

export interface BrainTopology {
  checked_at: string
  nodes: TopologyNode[]
  mcp: McpHealth[]
  agents: AgentHealth
  skills: SkillRegistry
}

export type ProductKey =
  | "haioflash"
  | "haiogate"
  | "paas"
  | "billing"
  | "tickets"
  | "campaigns"
  | "devices"
  | "hosting"
  | "platform"

export interface ProductDefinition {
  key: ProductKey
  label: string
  hint: string
  color: string
}

/** Clockwise from the top of the map. */
export const PRODUCTS: ProductDefinition[] = [
  { key: "haioflash", label: "هایوفلش", hint: "ماشین‌های ابری", color: "#38bdf8" },
  { key: "haiogate", label: "هایوگیت", hint: "تحریم‌شکن", color: "#818cf8" },
  { key: "paas", label: "پلتفرم ابری", hint: "اپ‌ها و دامنه‌ها", color: "#a78bfa" },
  { key: "billing", label: "مالی و اشتراک", hint: "فاکتور و کیف پول", color: "#22d3ee" },
  { key: "tickets", label: "پشتیبانی", hint: "تیکت و ایجنت", color: "#94a3b8" },
  { key: "campaigns", label: "رشد و کمپین", hint: "ایمیل و بله", color: "#c084fc" },
  { key: "devices", label: "دستگاه‌های ابری", hint: "اندروید و دسکتاپ", color: "#60a5fa" },
  { key: "hosting", label: "میزبانی و CDN", hint: "وردپرس و CDN", color: "#7dd3fc" },
  { key: "platform", label: "هستهٔ پلتفرم", hint: "پنل و ایجنت‌ها", color: "#64748b" },
]

export const PRODUCT_BY_KEY: Record<ProductKey, ProductDefinition> = PRODUCTS.reduce(
  (acc, product) => {
    acc[product.key] = product
    return acc
  },
  {} as Record<ProductKey, ProductDefinition>,
)

export interface WorkerTask {
  id: string
  name: string
  task: string
  label: string
  shortName: string
  scheduleSeconds: number
  scheduleLabel: string
  product: ProductKey
}

export const TASK_LABELS: Record<string, string> = {
  poll_tickets: "بررسی تیکت‌های جدید",
  sync_storage_usage: "همگام‌سازی مصرف فضای ذخیره‌سازی",
  sync_app_traffic: "همگام‌سازی ترافیک اپلیکیشن‌ها",
  sync_app_bandwidth: "شمارش پهنای باند اپلیکیشن‌ها",
  reconcile_billing_suspensions: "بازبینی تعلیق‌های مالی",
  send_suspension_warnings: "هشدار تعلیق سرویس",
  sync_provider_statuses: "همگام‌سازی وضعیت استقرارها",
  sync_domain_certificates: "تمدید گواهی دامنه‌ها",
  sync_quota_task: "همگام‌سازی سهمیهٔ هایوگیت",
  remove_expired_accounts_task: "حذف اکانت‌های منقضی",
  sync_all_vm_statuses: "همگام‌سازی وضعیت ماشین‌ها",
  collect_all_vm_stats: "جمع‌آوری آمار منابع",
  collect_all_vm_traffic: "شمارش ترافیک ماشین‌ها",
  process_monthly_billing: "صورتحساب ماهانهٔ فلش",
  process_hourly_billing: "صورتحساب ساعتی فلش",
  suspend_expired_vms: "تعلیق ماشین‌های منقضی",
  reconcile_vm_entitlements: "تطبیق اشتراک ماشین‌ها",
  enforce_traffic_quota: "اعمال سهمیهٔ ترافیک",
  send_expiration_warnings: "هشدار انقضای سرویس",
  resume_suspended_vms: "بازگردانی ماشین‌های معلق",
  release_expired_ip_subscriptions: "آزادسازی IPهای منقضی",
  reclaim_orphan_networks: "پاک‌سازی شبکه‌های رهاشده",
  reconcile_all_functions: "هماهنگ‌سازی فانکشن‌ها",
  scale_down_idle_functions: "خواباندن فانکشن‌های بیکار",
  collect_function_metrics: "جمع‌آوری متریک فانکشن‌ها",
  send_email_drip: "ارسال ایمیل کمپین",
  send_bale_drip: "ارسال پیام بله",
  send_no_reply_reminders: "یادآوری کمپین‌های بی‌پاسخ",
  campaign_end_sweep: "بستن کمپین‌های پایان‌یافته",
  expire_campaign_grants_task: "انقضای هدایای کمپین",
  cancel_stale_invoices_task: "لغو فاکتورهای رهاشده",
  expire_abandoned_checkouts_task: "انقضای پرداخت‌های نیمه‌کاره",
  dedicated_invoice_sweep_task: "فاکتور سرور اختصاصی",
  cleanup_expired_android_environments: "پاک‌سازی اندرویدهای منقضی",
  sync_android_device_statuses: "وضعیت دستگاه‌های اندروید",
  sleep_idle_android_devices: "خواباندن اندرویدهای بیکار",
  meter_android_device_usage: "مصرف دستگاه‌های اندروید",
  sweep_agent_timeouts: "پاک‌سازی ایجنت‌های بی‌پاسخ",
  sync_cdn_inventory: "همگام‌سازی CDN",
  create_cdn_renewal_invoices: "تمدید اشتراک CDN",
  sync_desktop_statuses: "وضعیت دسکتاپ‌ها",
  sync_wordpress_statuses: "وضعیت وردپرس",
}

const FALLBACK_TASKS: Array<[task: string, schedule: number]> = [
  ["haio.tickets.tasks.poll_tickets", 60],
  ["haio.storage.tasks.sync_storage_usage", 300],
  ["haio.applications.tasks.sync_app_traffic", 300],
  ["haio.applications.tasks.sync_app_bandwidth", 600],
  ["haio.applications.tasks.reconcile_billing_suspensions", 3600],
  ["haio.applications.tasks.send_suspension_warnings", 86400],
  ["haio.deployments.tasks.sync_provider_statuses", 30],
  ["haio.domains.tasks.sync_domain_certificates", 300],
  ["haio.antisanction.tasks.sync_quota_task", 3600],
  ["haio.antisanction.tasks.remove_expired_accounts_task", 86400],
  ["haio.haioflash.tasks.sync_all_vm_statuses", 600],
  ["haio.haioflash.tasks.collect_all_vm_stats", 600],
  ["haio.haioflash.tasks.collect_all_vm_traffic", 600],
  ["haio.haioflash.tasks.process_monthly_billing", 3600],
  ["haio.haioflash.tasks.process_hourly_billing", 3600],
  ["haio.haioflash.tasks.suspend_expired_vms", 3600],
  ["haio.haioflash.tasks.reconcile_vm_entitlements", 3600],
  ["haio.haioflash.tasks.enforce_traffic_quota", 3600],
  ["haio.haioflash.tasks.send_expiration_warnings", 3600],
  ["haio.haioflash.tasks.resume_suspended_vms", 3600],
  ["haio.dokploy.tasks.release_expired_ip_subscriptions", 3600],
  ["haio.dokploy.tasks.reclaim_orphan_networks", 86400],
  ["haio.functions.tasks.reconcile_all_functions", 60],
  ["haio.functions.tasks.scale_down_idle_functions", 300],
  ["haio.functions.tasks.collect_function_metrics", 3600],
  ["haio.campaigns.tasks.send_email_drip", 10],
  ["haio.campaigns.tasks.send_bale_drip", 120],
  ["haio.campaigns.tasks.send_no_reply_reminders", 86400],
  ["haio.campaigns.tasks.campaign_end_sweep", 86400],
  ["haio.offers.tasks.expire_campaign_grants_task", 86400],
  ["haio.billing.tasks.cancel_stale_invoices_task", 86400],
  ["haio.billing.tasks.expire_abandoned_checkouts_task", 60],
  ["haio.billing.tasks.dedicated_invoice_sweep_task", 3600],
  ["haio.android_testing.tasks.cleanup_expired_android_environments", 300],
  ["haio.android_cloud.tasks.sync_android_device_statuses", 120],
  ["haio.android_cloud.tasks.sleep_idle_android_devices", 300],
  ["haio.android_cloud.tasks.meter_android_device_usage", 60],
  ["haio.guest_agents.tasks.sweep_agent_timeouts", 30],
  ["haio.cdn.tasks.sync_cdn_inventory", 300],
  ["haio.cdn.tasks.create_cdn_renewal_invoices", 86400],
  ["haio.desktops.tasks.sync_desktop_statuses", 120],
  ["haio.wordpress.tasks.sync_wordpress_statuses", 120],
]

/** Section a client is viewing -> product cluster they are touching. */
const SECTION_PRODUCT: Record<string, ProductKey> = {
  dashboard: "platform",
  users: "platform",
  organizations: "platform",
  monitoring: "platform",
  assistant: "platform",
  settings: "platform",
  notifications: "platform",
  profile: "platform",
  invitations: "platform",
  subscriptions: "billing",
  invoices: "billing",
  proforma: "billing",
  dedicated: "billing",
  reports: "billing",
  haioflash: "haioflash",
  haiogate: "haiogate",
  tickets: "tickets",
  support: "tickets",
  campaigns: "campaigns",
  projects: "paas",
  applications: "paas",
  environments: "paas",
  deployments: "paas",
  domains: "paas",
  marketplace: "paas",
  slides: "paas",
  functions: "paas",
  brain: "platform",
}

export const SECTION_LABELS: Record<string, string> = {
  dashboard: "داشبورد",
  users: "کاربران",
  organizations: "سازمان‌ها",
  subscriptions: "اشتراک‌ها",
  invoices: "فاکتورها",
  proforma: "پیش‌فاکتورها",
  dedicated: "سرور اختصاصی",
  haioflash: "هایوفلش",
  haiogate: "هایوگیت",
  monitoring: "مونیتورینگ کاربران",
  tickets: "تیکت‌ها",
  campaigns: "کمپین‌ها",
  reports: "گزارش‌ها",
  settings: "تنظیمات",
  assistant: "دستیار هوشمند",
  brain: "مغز زیرساخت",
  projects: "پروژه‌ها",
  applications: "اپلیکیشن‌ها",
  environments: "محیط‌ها",
  deployments: "استقرارها",
  domains: "دامنه‌ها",
  billing: "حساب و قبوض",
  marketplace: "مارکت‌پلیس",
  notifications: "اعلان‌ها",
  profile: "پروفایل",
  slides: "اسلایدها",
  support: "پشتیبانی",
  invitations: "دعوت‌نامه‌ها",
  functions: "فانکشن‌ها",
}

export function productForSection(section: string | null | undefined): ProductKey {
  return SECTION_PRODUCT[(section ?? "").trim()] ?? "platform"
}

export function sectionLabel(section: string | null | undefined): string {
  const key = (section ?? "").trim()
  return key ? SECTION_LABELS[key] ?? key : "نامشخص"
}

const BACKEND_ISSUE_PRODUCT: Record<string, ProductKey> = {
  haioflash: "haioflash",
  haiogate: "haiogate",
  paas: "paas",
  billing: "billing",
  tickets: "tickets",
  platform: "platform",
}

export function productForIssueProduct(product: string | null | undefined): ProductKey {
  return BACKEND_ISSUE_PRODUCT[(product ?? "").trim()] ?? "platform"
}

/** Accepts either a panel product key or a backend diagnostics product value. */
export function normalizeProductKey(product: string | null | undefined): ProductKey {
  const value = (product ?? "").trim()
  if (value in PRODUCT_BY_KEY) return value as ProductKey
  return BACKEND_ISSUE_PRODUCT[value] ?? "platform"
}

export function severityColor(severity: IssueSeverity): string {
  if (severity === "critical") return "#fb7185"
  if (severity === "warning") return "#fbbf24"
  return "#f43f5e"
}

export function severityLabel(severity: IssueSeverity): string {
  if (severity === "critical") return "بحرانی"
  if (severity === "warning") return "هشدار"
  return "خطا"
}

function taskProduct(task: string): ProductKey {
  const value = task.toLowerCase()
  if (value.includes("haioflash")) return "haioflash"
  if (value.includes("antisanction") || value.includes("haiogate")) return "haiogate"
  if (value.includes("android") || value.includes("desktop")) return "devices"
  if (value.includes("cdn") || value.includes("wordpress")) return "hosting"
  if (value.includes("ticket")) return "tickets"
  // Applications own the "billing suspension" tasks, so check it before billing.
  if (
    value.includes("applications") ||
    value.includes("deployments") ||
    value.includes("domains") ||
    value.includes("storage") ||
    value.includes("functions") ||
    value.includes("slides")
  ) {
    return "paas"
  }
  if (
    value.includes("campaign") ||
    value.includes("offer") ||
    value.includes("drip") ||
    value.includes("no_reply")
  ) {
    return "campaigns"
  }
  if (value.includes("billing") || value.includes("invoice") || value.includes("checkout") || value.includes("dedicated")) {
    return "billing"
  }
  return "platform"
}

const FA_NUMBER = new Intl.NumberFormat("fa-IR")

export function faNum(value: number): string {
  return FA_NUMBER.format(value)
}

export function formatScheduleSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—"
  if (seconds < 60) return `${Math.round(seconds)} ثانیه`
  if (seconds < 3600) {
    const minutes = seconds / 60
    return `${Number.isInteger(minutes) ? minutes : Math.round(minutes)} دقیقه`
  }
  if (seconds < 86400) {
    const hours = seconds / 3600
    return `${Number.isInteger(hours) ? hours : Math.round(hours)} ساعت`
  }
  return `${Math.round(seconds / 86400)} روز`
}

function makeTask(
  task: string,
  scheduleSeconds: number,
  name = task,
): WorkerTask {
  const shortName = task.split(".").pop() ?? task
  return {
    id: task,
    name,
    task,
    label: TASK_LABELS[shortName] ?? shortName.replaceAll("_", " "),
    shortName,
    scheduleSeconds,
    scheduleLabel: formatScheduleSeconds(scheduleSeconds),
    product: taskProduct(task),
  }
}

/** Persian label for a raw Celery task path, used by the worker table. */
export function labelForTask(task: string | null | undefined): string {
  if (!task) return "وظیفهٔ ناشناس"
  const shortName = task.split(".").pop() ?? task
  return TASK_LABELS[shortName] ?? shortName.replaceAll("_", " ")
}

/** Product cluster for a raw Celery task path. */
export function productForTask(task: string | null | undefined): ProductKey {
  return taskProduct(task ?? "")
}

/** Human duration for finished task runs. */
export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—"
  if (ms < 1000) return `${faNum(Math.max(0, Math.round(ms)))} ms`
  if (ms < 60_000) return `${faNum(Math.round(ms / 100) / 10)} ثانیه`
  const minutes = Math.floor(ms / 60_000)
  const seconds = Math.round((ms % 60_000) / 1000)
  return `${faNum(minutes)}:${faNum(seconds).padStart(2, "۰")} دقیقه`
}

function emptyTaskMap(): Record<ProductKey, WorkerTask[]> {
  return PRODUCTS.reduce(
    (acc, product) => {
      acc[product.key] = []
      return acc
    },
    {} as Record<ProductKey, WorkerTask[]>,
  )
}

/**
 * Turn the backend scheduler registry into product worker neurons.
 * If the scheduler endpoint is unavailable we still draw the real, known
 * beat schedule so the brain is never empty.
 */
export function buildWorkerTasks(scheduler: SchedulerEntry[] | undefined | null): Record<ProductKey, WorkerTask[]> {
  const result = emptyTaskMap()

  if (scheduler && scheduler.length > 0) {
    const seen = new Set<string>()
    for (const entry of scheduler) {
      if (!entry?.task || seen.has(entry.task)) continue
      seen.add(entry.task)
      const seconds = typeof entry.schedule === "number" && entry.schedule > 0 ? entry.schedule : 300
      const worker = makeTask(entry.task, seconds, entry.name)
      result[worker.product].push(worker)
    }
  }

  // Always give every cluster a pulse: either the live registry entry or the
  // code-level fallback for that product.
  for (const [task, seconds] of FALLBACK_TASKS) {
    const worker = makeTask(task, seconds)
    if (result[worker.product].every((existing) => existing.task !== task)) {
      if (result[worker.product].length === 0) {
        result[worker.product].push(worker)
      }
    }
  }

  for (const product of PRODUCTS) {
    result[product.key].sort((a, b) => a.scheduleSeconds - b.scheduleSeconds || a.label.localeCompare(b.label))
  }

  return result
}

export function countWorkers(tasks: Record<ProductKey, WorkerTask[]>): number {
  return PRODUCTS.reduce((total, product) => total + tasks[product.key].length, 0)
}

/** Expected scheduler executions per minute across all workers. */
export function pulsesPerMinute(tasks: Record<ProductKey, WorkerTask[]>): number {
  let total = 0
  for (const product of PRODUCTS) {
    for (const worker of tasks[product.key]) {
      total += 60 / Math.max(worker.scheduleSeconds, 5)
    }
  }
  return Math.round(total)
}

export function issuesByProductKey(system: SystemSnapshot | null): Record<ProductKey, number> {
  const result = PRODUCTS.reduce(
    (acc, product) => {
      acc[product.key] = 0
      return acc
    },
    {} as Record<ProductKey, number>,
  )
  if (!system?.issues_by_product) return result
  for (const [backendKey, count] of Object.entries(system.issues_by_product)) {
    const key = BACKEND_ISSUE_PRODUCT[backendKey] ?? "platform"
    result[key] += Number(count) || 0
  }
  return result
}
