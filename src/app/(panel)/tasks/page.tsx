"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import axios from "axios"
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleDashed,
  Inbox,
  LayoutList,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  SquareKanban,
  Trash2,
  UserRound,
  X,
} from "lucide-react"
import { api } from "@/lib/api"
import { useAuthStore } from "@/stores/auth-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { JalaliDateInput } from "@/components/ui/jalali-date-input"
import { formatJalali, todayIso } from "@/lib/jalali"
import { cn } from "@/lib/utils"

/* ─────────────────────────────── types ─────────────────────────────── */

type Status = "todo" | "in_progress" | "blocked" | "done"
type Priority = "low" | "normal" | "high" | "urgent"

interface Task {
  id: string
  title: string
  description: string
  status: Status
  status_display: string
  priority: Priority
  priority_display: string
  assignee: number | null
  assignee_name: string
  created_by: number | null
  created_by_name: string
  due_date: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

interface Member {
  id: number
  email: string
  name: string
  role: string
  tier: string
}

interface Summary {
  total: number
  open: number
  overdue: number
  mine_open: number
  by_status: Record<Status, number>
}

interface TaskPayload {
  title: string
  description: string
  status: Status
  priority: Priority
  assignee: number | null
  due_date: string | null
}

/* ─────────────────────────────── meta ─────────────────────────────── */

const STATUS_ORDER: Status[] = ["todo", "in_progress", "blocked", "done"]

const STATUS_META: Record<
  Status,
  { label: string; dot: string; header: string; soft: string }
> = {
  todo: {
    label: "انجام نشده",
    dot: "bg-slate-400",
    header: "text-slate-700",
    soft: "bg-slate-100 text-slate-600",
  },
  in_progress: {
    label: "در دست اقدام",
    dot: "bg-indigo-500",
    header: "text-indigo-700",
    soft: "bg-indigo-50 text-indigo-700",
  },
  blocked: {
    label: "متوقف",
    dot: "bg-amber-500",
    header: "text-amber-700",
    soft: "bg-amber-50 text-amber-700",
  },
  done: {
    label: "انجام شده",
    dot: "bg-emerald-500",
    header: "text-emerald-700",
    soft: "bg-emerald-50 text-emerald-700",
  },
}

const PRIORITY_ORDER: Priority[] = ["urgent", "high", "normal", "low"]

const PRIORITY_META: Record<Priority, { label: string; className: string }> = {
  urgent: { label: "فوری", className: "border-rose-200 bg-rose-50 text-rose-700" },
  high: { label: "زیاد", className: "border-orange-200 bg-orange-50 text-orange-700" },
  normal: { label: "معمولی", className: "border-sky-200 bg-sky-50 text-sky-700" },
  low: { label: "کم", className: "border-slate-200 bg-slate-50 text-slate-600" },
}

const PRIORITY_RANK: Record<Priority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
}

function faNum(value: number): string {
  return value.toLocaleString("fa-IR")
}

function initials(name: string): string {
  const trimmed = name.trim()
  return trimmed ? trimmed.slice(0, 1) : "?"
}

function isOverdue(task: Task): boolean {
  return Boolean(task.due_date && task.due_date < todayIso() && task.status !== "done")
}

function nextStatus(status: Status): Status {
  if (status === "todo") return "in_progress"
  if (status === "blocked") return "in_progress"
  if (status === "in_progress") return "done"
  return "todo"
}

function nextStatusLabel(status: Status): string {
  if (status === "todo") return "شروع کار"
  if (status === "blocked") return "رفع توقف"
  if (status === "in_progress") return "انجام شد"
  return "بازگشت به انجام‌نشده"
}

function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) return "ارتباط با سرور برقرار نشد."
    if (error.response.status === 403) {
      return "دسترسی به بخش تسک‌ها برای نقش شما مجاز نیست."
    }
    const data = error.response.data as unknown
    if (typeof data === "string" && data.trim()) return data
    if (data && typeof data === "object") {
      const detail = (data as { detail?: unknown }).detail
      if (typeof detail === "string") return detail
      for (const value of Object.values(data as Record<string, unknown>)) {
        if (typeof value === "string" && value.trim()) return value
        if (Array.isArray(value) && value.length) return String(value[0])
      }
    }
  }
  return "خطا در ارتباط با سرور."
}

/* ─────────────────────────────── small pieces ─────────────────────────────── */

function PriorityBadge({ priority }: { priority: Priority }) {
  const meta = PRIORITY_META[priority] ?? PRIORITY_META.normal
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
        meta.className,
      )}
    >
      {meta.label}
    </span>
  )
}

function StatusPill({ status }: { status: Status }) {
  const meta = STATUS_META[status]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
        meta.soft,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  )
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
      {initials(name)}
    </span>
  )
}

function StatCard({
  label,
  value,
  hint,
  tone,
  active,
  onClick,
}: {
  label: string
  value: number
  hint: string
  tone: string
  active?: boolean
  onClick?: () => void
}) {
  const Component = onClick ? "button" : "div"
  return (
    <Component
      onClick={onClick}
      className={cn(
        "rounded-2xl border bg-white p-4 text-right transition",
        active
          ? "border-indigo-300 ring-2 ring-indigo-100"
          : "border-slate-200 hover:border-slate-300",
        onClick && "cursor-pointer",
      )}
    >
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold tabular-nums", tone)}>{faNum(value)}</p>
      <p className="mt-1 text-[10px] text-slate-400">{hint}</p>
    </Component>
  )
}

function EmptyColumn({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-white/60 px-3 py-8 text-center">
      <Inbox className="h-5 w-5 text-slate-300" />
      <p className="text-[11px] text-slate-400">{label}</p>
    </div>
  )
}

/* ─────────────────────────────── task card ─────────────────────────────── */

function TaskCard({
  task,
  dragging,
  onEdit,
  onAdvance,
  onDragStart,
  onDragEnd,
}: {
  task: Task
  dragging: boolean
  onEdit: () => void
  onAdvance: () => void
  onDragStart: (event: React.DragEvent<HTMLDivElement>) => void
  onDragEnd: () => void
}) {
  const overdue = isOverdue(task)
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "group cursor-grab rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition active:cursor-grabbing",
        "hover:border-slate-300 hover:shadow-md",
        dragging && "opacity-40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <PriorityBadge priority={task.priority} />
          {task.due_date ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]",
                overdue
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-slate-200 bg-white text-slate-500",
              )}
            >
              <CalendarDays className="h-3 w-3" />
              {formatJalali(task.due_date)}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="ویرایش تسک"
            title="ویرایش"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onAdvance}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"
            aria-label={nextStatusLabel(task.status)}
            title={nextStatusLabel(task.status)}
          >
            {task.status === "in_progress" ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <ArrowLeft className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={onEdit}
        className="mt-2 block w-full text-right text-sm font-medium leading-6 text-slate-800 hover:text-indigo-700"
      >
        {task.title}
      </button>

      {task.description ? (
        <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-slate-500">
          {task.description}
        </p>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
        {task.assignee_name ? (
          <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-slate-600">
            <Avatar name={task.assignee_name} />
            <span className="truncate">{task.assignee_name}</span>
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[11px] text-slate-400">
            <UserRound className="h-3.5 w-3.5" />
            بدون مسئول
          </span>
        )}
        {overdue ? (
          <span className="flex items-center gap-1 text-[10px] font-medium text-rose-600">
            <AlertTriangle className="h-3 w-3" />
            عقب‌افتاده
          </span>
        ) : null}
      </div>
    </div>
  )
}

/* ─────────────────────────────── drawer ─────────────────────────────── */

function TaskDrawer({
  open,
  task,
  members,
  defaultStatus,
  defaultAssignee,
  onClose,
  onSaved,
  onDeleted,
}: {
  open: boolean
  task: Task | null
  members: Member[]
  defaultStatus: Status
  defaultAssignee: number | null
  onClose: () => void
  onSaved: (task: Task, created: boolean) => void
  onDeleted: (task: Task) => void
}) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState<Status>(defaultStatus)
  const [priority, setPriority] = useState<Priority>("normal")
  const [assignee, setAssignee] = useState<number | null>(defaultAssignee)
  const [dueDate, setDueDate] = useState<string | null>(todayIso())
  const [memberQuery, setMemberQuery] = useState("")
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setTitle(task?.title ?? "")
    setDescription(task?.description ?? "")
    setStatus(task?.status ?? defaultStatus)
    setPriority(task?.priority ?? "normal")
    setAssignee(task ? task.assignee : defaultAssignee)
    setDueDate(task ? task.due_date : todayIso())
    setMemberQuery("")
    setSaving(false)
    setDeleting(false)
    setConfirmDelete(false)
    setError("")
  }, [open, task, defaultStatus, defaultAssignee])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  const filteredMembers = useMemo(() => {
    const query = memberQuery.trim().toLowerCase()
    if (!query) return members
    return members.filter(
      (member) =>
        member.name.toLowerCase().includes(query) ||
        member.email.toLowerCase().includes(query),
    )
  }, [members, memberQuery])

  const save = async () => {
    const cleanTitle = title.trim()
    if (!cleanTitle) {
      setError("عنوان تسک را بنویسید.")
      return
    }
    setSaving(true)
    setError("")
    const payload: TaskPayload = {
      title: cleanTitle,
      description: description.trim(),
      status,
      priority,
      assignee,
      due_date: dueDate,
    }
    try {
      if (task) {
        const { data } = await api.patch<Task>(`/panel/tasks/${task.id}/`, payload)
        onSaved(data, false)
      } else {
        const { data } = await api.post<Task>("/panel/tasks/", payload)
        onSaved(data, true)
      }
      onClose()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!task) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setDeleting(true)
    setError("")
    try {
      await api.delete(`/panel/tasks/${task.id}/`)
      onDeleted(task)
      onClose()
    } catch (caught) {
      setError(errorMessage(caught))
      setDeleting(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-40 flex justify-start bg-slate-900/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-lg flex-col bg-slate-50 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white p-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {task ? "ویرایش تسک" : "تسک جدید"}
            </h2>
            <p className="mt-1 text-[11px] text-slate-400">
              {task
                ? `ساخته‌شده توسط ${task.created_by_name || "—"} · ${new Date(
                    task.created_at,
                  ).toLocaleString("fa-IR")}`
                : "تسک با ابزارهای هوش مصنوعی مشترک است؛ اینجا بدون مصرف توکن."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            aria-label="بستن"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4 scrollbar-thin">
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              عنوان <span className="text-rose-500">*</span>
            </label>
            <Input
              value={title}
              maxLength={200}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="مثلاً ساخت پنل روناک برای بقایی"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              توضیحات
            </label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="جزئیات کار، لینک‌ها یا شرط انجام..."
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">
                وضعیت
              </label>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as Status)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              >
                {STATUS_ORDER.map((value) => (
                  <option key={value} value={value}>
                    {STATUS_META[value].label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">
                اولویت
              </label>
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as Priority)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              >
                {PRIORITY_ORDER.map((value) => (
                  <option key={value} value={value}>
                    {PRIORITY_META[value].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              سررسید
            </label>
            <JalaliDateInput value={dueDate} onChange={setDueDate} />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              مسئول
            </label>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center gap-2 border-b border-slate-100 px-3">
                <Search className="h-4 w-4 shrink-0 text-slate-300" />
                <input
                  value={memberQuery}
                  onChange={(event) => setMemberQuery(event.target.value)}
                  placeholder="جست‌وجوی هم‌تیمی…"
                  className="h-10 w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                />
              </div>
              <div className="max-h-48 overflow-y-auto p-1 scrollbar-thin">
                <button
                  type="button"
                  onClick={() => setAssignee(null)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-right text-xs transition",
                    assignee === null
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-600 hover:bg-slate-50",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <UserRound className="h-3.5 w-3.5" />
                    بدون مسئول
                  </span>
                  {assignee === null ? <Check className="h-3.5 w-3.5" /> : null}
                </button>
                {filteredMembers.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => setAssignee(member.id)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-right transition",
                      assignee === member.id
                        ? "bg-indigo-50 text-indigo-700"
                        : "hover:bg-slate-50",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Avatar name={member.name} />
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-medium">
                          {member.name}
                        </span>
                        <span className="block truncate text-[10px] text-slate-400" dir="ltr">
                          {member.email}
                        </span>
                      </span>
                    </span>
                    {assignee === member.id ? (
                      <Check className="h-3.5 w-3.5 shrink-0" />
                    ) : null}
                  </button>
                ))}
                {filteredMembers.length === 0 ? (
                  <p className="px-3 py-4 text-center text-[11px] text-slate-400">
                    هم‌تیمی پیدا نشد.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-white p-4">
          {task ? (
            <Button
              type="button"
              variant={confirmDelete ? "destructive" : "ghost"}
              size="sm"
              onClick={remove}
              disabled={deleting || saving}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {confirmDelete ? "مطمئنم؛ حذف شود" : "حذف تسک"}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              انصراف
            </Button>
            <Button type="button" size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {task ? "ذخیره تغییرات" : "ساخت تسک"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────── page ─────────────────────────────── */

const PAGE_SIZE = 100

export default function TasksPage() {
  const { user } = useAuthStore()

  const [tasks, setTasks] = useState<Task[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [count, setCount] = useState(0)

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [flash, setFlash] = useState("")

  const [view, setView] = useState<"board" | "list">("board")
  const [scope, setScope] = useState<"all" | "mine">("all")
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [assigneeFilter, setAssigneeFilter] = useState("")
  const [priorityFilter, setPriorityFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [drawerStatus, setDrawerStatus] = useState<Status>("todo")
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<Status | null>(null)

  const requestSeq = useRef(0)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showFlash = useCallback((message: string) => {
    setFlash(message)
    if (flashTimer.current) clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFlash(""), 3000)
  }, [])

  useEffect(() => {
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => clearTimeout(timer)
  }, [search])

  const loadSummary = useCallback(async () => {
    try {
      const { data } = await api.get<Summary>("/panel/tasks/summary/")
      setSummary(data)
    } catch {
      // The board itself surfaces the error; a failed counter must not blank it.
    }
  }, [])

  const load = useCallback(
    async (silent = false) => {
      const seq = ++requestSeq.current
      if (silent) setRefreshing(true)
      else setLoading(true)
      setError("")

      const params: Record<string, string | number> = { page_size: PAGE_SIZE }
      if (scope === "mine") params.mine = "1"
      if (overdueOnly) params.overdue = "1"
      if (debouncedSearch) params.search = debouncedSearch
      if (assigneeFilter) params.assignee = assigneeFilter
      if (priorityFilter) params.priority = priorityFilter
      if (statusFilter) params.status = statusFilter

      try {
        const { data } = await api.get<{ count: number; results: Task[] } | Task[]>(
          "/panel/tasks/",
          { params },
        )
        if (seq !== requestSeq.current) return
        if (Array.isArray(data)) {
          setTasks(data)
          setCount(data.length)
        } else {
          setTasks(data.results ?? [])
          setCount(data.count ?? 0)
        }
      } catch (caught) {
        if (seq === requestSeq.current) setError(errorMessage(caught))
      } finally {
        if (seq === requestSeq.current) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    },
    [scope, overdueOnly, debouncedSearch, assigneeFilter, priorityFilter, statusFilter],
  )

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void loadSummary()
    api
      .get<Member[] | { results: Member[] }>("/panel/tasks/members/")
      .then(({ data }) => setMembers(Array.isArray(data) ? data : data.results ?? []))
      .catch(() => undefined)
  }, [loadSummary])

  const refresh = useCallback(() => {
    void load(true)
    void loadSummary()
  }, [load, loadSummary])

  const patchTask = useCallback(
    async (task: Task, patch: Partial<TaskPayload>) => {
      const previous = tasks
      setTasks((rows) =>
        rows.map((row) => (row.id === task.id ? { ...row, ...patch } : row)),
      )
      try {
        const { data } = await api.patch<Task>(`/panel/tasks/${task.id}/`, patch)
        setTasks((rows) => rows.map((row) => (row.id === task.id ? data : row)))
        void loadSummary()
        showFlash("تسک به‌روز شد.")
      } catch (caught) {
        setTasks(previous)
        setError(errorMessage(caught))
      }
    },
    [tasks, loadSummary, showFlash],
  )

  const openCreate = (status: Status = "todo") => {
    setEditing(null)
    setDrawerStatus(status)
    setDrawerOpen(true)
  }

  const openEdit = (task: Task) => {
    setEditing(task)
    setDrawerStatus(task.status)
    setDrawerOpen(true)
  }

  const onSaved = useCallback(
    (task: Task, created: boolean) => {
      setTasks((rows) => {
        const exists = rows.some((row) => row.id === task.id)
        return exists ? rows.map((row) => (row.id === task.id ? task : row)) : [task, ...rows]
      })
      void loadSummary()
      showFlash(created ? "تسک ساخته شد." : "تغییرات ذخیره شد.")
    },
    [loadSummary, showFlash],
  )

  const onDeleted = useCallback(
    (task: Task) => {
      setTasks((rows) => rows.filter((row) => row.id !== task.id))
      void loadSummary()
      showFlash("تسک حذف شد.")
    },
    [loadSummary, showFlash],
  )

  const moveTask = useCallback(
    (taskId: string, status: Status) => {
      const task = tasks.find((row) => row.id === taskId)
      if (!task || task.status === status) return
      void patchTask(task, { status })
    },
    [tasks, patchTask],
  )

  const columns = useMemo(() => {
    const grouped: Record<Status, Task[]> = {
      todo: [],
      in_progress: [],
      blocked: [],
      done: [],
    }
    for (const task of tasks) grouped[task.status].push(task)
    for (const status of STATUS_ORDER) {
      grouped[status].sort((a, b) => {
        const byPriority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
        if (byPriority !== 0) return byPriority
        return (a.due_date ?? "9999-12-31").localeCompare(b.due_date ?? "9999-12-31")
      })
    }
    return grouped
  }, [tasks])

  const truncated = count > tasks.length
  const filtersActive = Boolean(
    scope === "mine" || overdueOnly || debouncedSearch || assigneeFilter || priorityFilter || statusFilter,
  )

  const clearFilters = () => {
    setScope("all")
    setOverdueOnly(false)
    setSearch("")
    setAssigneeFilter("")
    setPriorityFilter("")
    setStatusFilter("")
  }

  const selfId = user?.id ?? null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">تخته تسک‌های تیم</h2>
          <p className="mt-1 text-xs text-slate-500">
            همان تختهٔ مشترک با ابزارهای هوش مصنوعی — اینجا مستقیم و بدون مصرف توکن.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={refreshing || loading}
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            به‌روزرسانی
          </Button>
          <Button size="sm" onClick={() => openCreate()}>
            <Plus className="h-4 w-4" />
            تسک جدید
          </Button>
        </div>
      </div>

      {error ? (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <span className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </span>
          <button onClick={() => setError("")} className="text-rose-400 hover:text-rose-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {flash ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          {flash}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="تسک‌های باز"
          value={summary?.open ?? 0}
          hint="همهٔ کارهای انجام‌نشده"
          tone="text-slate-900"
        />
        <StatCard
          label="کارهای من"
          value={summary?.mine_open ?? 0}
          hint={scope === "mine" ? "فیلتر فعال است؛ برای برداشتن کلیک کنید" : "کلیک کنید تا فقط کارهای شما دیده شود"}
          tone="text-indigo-700"
          active={scope === "mine"}
          onClick={() => setScope((current) => (current === "mine" ? "all" : "mine"))}
        />
        <StatCard
          label="عقب‌افتاده"
          value={summary?.overdue ?? 0}
          hint={overdueOnly ? "فیلتر فعال است؛ برای برداشتن کلیک کنید" : "سررسید گذشته و هنوز باز"}
          tone="text-rose-600"
          active={overdueOnly}
          onClick={() => setOverdueOnly((current) => !current)}
        />
        <StatCard
          label="انجام‌شده"
          value={summary?.by_status?.done ?? 0}
          hint={`از ${faNum(summary?.total ?? 0)} تسک`}
          tone="text-emerald-700"
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-300" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="جست‌وجو در عنوان، توضیحات یا مسئول…"
              className="pr-9"
            />
          </div>

          <select
            value={assigneeFilter}
            onChange={(event) => setAssigneeFilter(event.target.value)}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-400"
          >
            <option value="">همهٔ مسئول‌ها</option>
            {selfId ? <option value={String(selfId)}>فقط من</option> : null}
            <option value="unassigned">بدون مسئول</option>
            {members.map((member) => (
              <option key={member.id} value={String(member.id)}>
                {member.name}
              </option>
            ))}
          </select>

          <select
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value)}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-400"
          >
            <option value="">همهٔ اولویت‌ها</option>
            {PRIORITY_ORDER.map((value) => (
              <option key={value} value={value}>
                {PRIORITY_META[value].label}
              </option>
            ))}
          </select>

          {view === "list" ? (
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-400"
            >
              <option value="">همهٔ وضعیت‌ها</option>
              {STATUS_ORDER.map((value) => (
                <option key={value} value={value}>
                  {STATUS_META[value].label}
                </option>
              ))}
            </select>
          ) : null}

          {filtersActive ? (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4" />
              پاک‌کردن فیلترها
            </Button>
          ) : null}

          <div className="mr-auto flex items-center rounded-xl border border-slate-200 p-0.5">
            <button
              type="button"
              onClick={() => {
                setView("board")
                setStatusFilter("")
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition",
                view === "board"
                  ? "bg-slate-900 text-white"
                  : "text-slate-500 hover:bg-slate-100",
              )}
            >
              <SquareKanban className="h-3.5 w-3.5" />
              تخته
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition",
                view === "list"
                  ? "bg-slate-900 text-white"
                  : "text-slate-500 hover:bg-slate-100",
              )}
            >
              <LayoutList className="h-3.5 w-3.5" />
              فهرست
            </button>
          </div>
        </div>

        {truncated ? (
          <p className="mt-2 text-[11px] text-amber-600">
            {faNum(tasks.length)} تسک از {faNum(count)} نمایش داده شده؛ برای دیدن بقیه فیلترها را باریک‌تر کنید.
          </p>
        ) : null}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-16 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
          <p className="text-xs">در حال بارگذاری تخته…</p>
        </div>
      ) : view === "board" ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {STATUS_ORDER.map((status) => {
            const meta = STATUS_META[status]
            const rows = columns[status]
            return (
              <div
                key={status}
                onDragOver={(event) => {
                  event.preventDefault()
                  setDragOver(status)
                }}
                onDragLeave={() => setDragOver((current) => (current === status ? null : current))}
                onDrop={(event) => {
                  event.preventDefault()
                  const taskId = event.dataTransfer.getData("text/plain")
                  setDragOver(null)
                  setDraggingId(null)
                  if (taskId) moveTask(taskId, status)
                }}
                className={cn(
                  "flex min-h-[240px] flex-col rounded-2xl border border-slate-200 bg-slate-100/60 p-2.5 transition",
                  dragOver === status && "border-indigo-300 bg-indigo-50/70 ring-2 ring-indigo-100",
                )}
              >
                <div className="mb-2 flex items-center justify-between gap-2 px-1">
                  <div className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full", meta.dot)} />
                    <span className={cn("text-xs font-bold", meta.header)}>{meta.label}</span>
                    <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                      {faNum(rows.length)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openCreate(status)}
                    className="rounded-lg p-1 text-slate-400 transition hover:bg-white hover:text-indigo-600"
                    aria-label={`تسک جدید در ${meta.label}`}
                    title="تسک جدید"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex flex-1 flex-col gap-2">
                  {rows.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      dragging={draggingId === task.id}
                      onEdit={() => openEdit(task)}
                      onAdvance={() => moveTask(task.id, nextStatus(task.status))}
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/plain", task.id)
                        event.dataTransfer.effectAllowed = "move"
                        setDraggingId(task.id)
                      }}
                      onDragEnd={() => setDraggingId(null)}
                    />
                  ))}
                  {rows.length === 0 ? (
                    <EmptyColumn label="چیزی نیست. از سکوت لذت ببرید." />
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-right text-sm">
              <thead className="bg-slate-50 text-[11px] text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">تسک</th>
                  <th className="px-4 py-3 font-medium">مسئول</th>
                  <th className="px-4 py-3 font-medium">وضعیت</th>
                  <th className="px-4 py-3 font-medium">اولویت</th>
                  <th className="px-4 py-3 font-medium">سررسید</th>
                  <th className="px-4 py-3 font-medium">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...tasks]
                  .sort(
                    (a, b) =>
                      STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
                      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
                  )
                  .map((task) => (
                    <tr key={task.id} className="hover:bg-slate-50/70">
                      <td className="max-w-[320px] px-4 py-3">
                        <button
                          type="button"
                          onClick={() => openEdit(task)}
                          className="block truncate text-right font-medium text-slate-800 hover:text-indigo-700"
                        >
                          {task.title}
                        </button>
                        {task.description ? (
                          <p className="mt-0.5 truncate text-[11px] text-slate-400">
                            {task.description}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        {task.assignee_name ? (
                          <span className="flex items-center gap-1.5 text-[11px] text-slate-600">
                            <Avatar name={task.assignee_name} />
                            {task.assignee_name}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={task.status}
                          onChange={(event) =>
                            void patchTask(task, { status: event.target.value as Status })
                          }
                          className={cn(
                            "h-8 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-medium outline-none focus:border-indigo-400",
                            STATUS_META[task.status].header,
                          )}
                        >
                          {STATUS_ORDER.map((value) => (
                            <option key={value} value={value}>
                              {STATUS_META[value].label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <PriorityBadge priority={task.priority} />
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 text-[11px]",
                            isOverdue(task) ? "font-medium text-rose-600" : "text-slate-600",
                          )}
                        >
                          <CalendarDays className="h-3.5 w-3.5" />
                          {formatJalali(task.due_date)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(task)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            aria-label="ویرایش"
                            title="ویرایش"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveTask(task.id, nextStatus(task.status))}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"
                            aria-label={nextStatusLabel(task.status)}
                            title={nextStatusLabel(task.status)}
                          >
                            {task.status === "in_progress" ? (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowLeft className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-14 text-center">
              <CircleDashed className="h-7 w-7 text-slate-300" />
              <p className="text-sm text-slate-500">
                {filtersActive ? "با این فیلترها تسکی پیدا نشد." : "هنوز تسکی روی تخته نیست."}
              </p>
              {!filtersActive ? (
                <Button size="sm" className="mt-2" onClick={() => openCreate()}>
                  <Plus className="h-4 w-4" />
                  ساخت اولین تسک
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="mt-2" onClick={clearFilters}>
                  پاک‌کردن فیلترها
                </Button>
              )}
            </div>
          ) : null}
        </div>
      )}

      <TaskDrawer
        open={drawerOpen}
        task={editing}
        members={members}
        defaultStatus={drawerStatus}
        defaultAssignee={selfId}
        onClose={() => setDrawerOpen(false)}
        onSaved={onSaved}
        onDeleted={onDeleted}
      />
    </div>
  )
}
