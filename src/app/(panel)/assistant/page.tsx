"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Clock,
  Cog,
  History,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
} from "lucide-react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface AiTask {
  id: number
  prompt: string
  status: "queued" | "running" | "done" | "failed"
  output: string
  error: string
  exit_code: number | null
  duration_seconds: number | null
  created_by_name: string
  created_at: string
  started_at: string | null
  finished_at: string | null
}

const MAX_PROMPT = 20000

const STATUS_STYLES: Record<AiTask["status"], { label: string; className: string }> = {
  queued: {
    label: "در صف",
    className: "bg-amber-50 text-amber-700 ring-amber-200",
  },
  running: {
    label: "در حال اجرا",
    className: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  },
  done: {
    label: "انجام شد",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
  failed: {
    label: "ناموفق",
    className: "bg-rose-50 text-rose-700 ring-rose-200",
  },
}

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso))
  } catch {
    return ""
  }
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return ""
  if (seconds < 60) return `${seconds.toLocaleString("fa-IR")} ثانیه`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  if (minutes < 60) return `${minutes.toLocaleString("fa-IR")} دقیقه${rest ? ` و ${rest.toLocaleString("fa-IR")} ثانیه` : ""}`
  const hours = Math.floor(minutes / 60)
  return `${hours.toLocaleString("fa-IR")} ساعت و ${(minutes % 60).toLocaleString("fa-IR")} دقیقه`
}

function extractError(error: unknown): string {
  const data = (error as { response?: { data?: unknown } })?.response?.data
  if (typeof data === "string") return data
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>
    if (typeof record.detail === "string") return record.detail
    for (const value of Object.values(record)) {
      if (typeof value === "string") return value
    }
  }
  const message = (error as { message?: string })?.message
  return message || "خطای نامشخص"
}

function StatusBadge({ status }: { status: AiTask["status"] }) {
  const style = STATUS_STYLES[status]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1",
        style.className,
      )}
    >
      {status === "running" ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : status === "done" ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : status === "failed" ? (
        <CircleAlert className="h-3 w-3" />
      ) : (
        <Clock className="h-3 w-3" />
      )}
      {style.label}
    </span>
  )
}

const OUTPUT_PREVIEW_CHARS = 6000

function LongText({ text, ltr = true }: { text: string; ltr?: boolean }) {
  const [full, setFull] = useState(false)
  const tooLong = text.length > OUTPUT_PREVIEW_CHARS
  const shown = tooLong && !full ? `${text.slice(0, OUTPUT_PREVIEW_CHARS)}…` : text
  return (
    <div>
      <pre
        dir={ltr ? "ltr" : undefined}
        className={cn(
          "max-h-96 overflow-y-auto whitespace-pre-wrap break-words font-mono text-left text-xs leading-5 text-slate-800",
          !ltr && "text-right",
        )}
      >
        {shown}
      </pre>
      {tooLong && (
        <button
          type="button"
          onClick={() => setFull(!full)}
          className="mt-2 text-xs font-medium text-indigo-600 hover:text-indigo-700"
        >
          {full ? "بستن" : `نمایش کامل (${text.length.toLocaleString("fa-IR")} کاراکتر)`}
        </button>
      )}
    </div>
  )
}

function TaskCard({ task, defaultOpen }: { task: AiTask; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const active = task.status === "queued" || task.status === "running"

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-start justify-between gap-3 p-4 text-right"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={task.status} />
            <span className="text-xs text-slate-500">{formatDateTime(task.created_at)}</span>
            {task.duration_seconds != null && task.status === "done" && (
              <span className="text-xs text-slate-400">· {formatDuration(task.duration_seconds)}</span>
            )}
          </div>
          <p className={cn("mt-2 truncate text-sm text-slate-800", !open && "max-w-xl")}>
            {active && <span className="text-slate-400">… </span>}
            {task.prompt.length > 120 && !open ? `${task.prompt.slice(0, 120)}…` : task.prompt}
          </p>
          <p className="mt-1 text-xs text-slate-400">{task.created_by_name || "—"}</p>
        </div>
        <span className="mt-1 shrink-0 text-slate-400">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>
      {open && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3">
          {task.status === "failed" && task.error && (
            <div className="mb-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-rose-100">
              <p className="font-medium">خطا</p>
              <div className="mt-1">
                <LongText text={task.error} />
              </div>
            </div>
          )}
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <Bot className="h-3.5 w-3.5" /> خروجی هوش مصنوعی
            </p>
            {task.output ? (
              <LongText text={task.output} ltr={false} />
            ) : (
              <p className="text-sm text-slate-400">
                {active ? "در حال اجراست…" : "خروجی ثبت نشده است."}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function AssistantPage() {
  const [tasks, setTasks] = useState<AiTask[]>([])
  const [prompt, setPrompt] = useState("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true)
    try {
      const { data } = await api.get<AiTask[]>("/panel/assistant/tasks/", { params: { limit: 50 } })
      setTasks(Array.isArray(data) ? data : [])
      setError("")
    } catch (err) {
      setError(extractError(err))
    } finally {
      if (showSpinner) setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(true)
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await api.get<AiTask[]>("/panel/assistant/tasks/", { params: { limit: 50 } })
        if (Array.isArray(data)) setTasks(data)
      } catch {
        // silent — next tick retries
      }
    }, 5000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [load])

  useEffect(() => {
    const hasActive = tasks.some((t) => t.status === "queued" || t.status === "running")
    if (!hasActive && expandedId && !tasks.some((t) => t.id === expandedId)) setExpandedId(null)
  }, [tasks, expandedId])

  const submit = async () => {
    const trimmed = prompt.trim()
    if (!trimmed) return
    setSubmitting(true)
    setError("")
    try {
      const { data } = await api.post<AiTask>("/panel/assistant/tasks/", { prompt: trimmed })
      setPrompt("")
      setTasks((prev) => [data, ...prev])
      setExpandedId(data.id)
    } catch (err) {
      setError(extractError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const activeCount = tasks.filter((t) => t.status === "queued" || t.status === "running").length
  const doneCount = tasks.filter((t) => t.status === "done").length

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">دستیار هوشمند</h1>
          <p className="mt-1 text-sm text-slate-500">
            درخواست را بنویسید؛ هوش مصنوعی روی سرور اجرا و نتیجه اینجا ثبت می‌شود.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => load(true)} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          به‌روزرسانی
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">در جریان</p>
          <p className="mt-1 text-2xl font-bold text-indigo-600">{activeCount.toLocaleString("fa-IR")}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">انجام‌شده</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{doneCount.toLocaleString("fa-IR")}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">کل درخواست‌ها</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{tasks.length.toLocaleString("fa-IR")}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label htmlFor="assistant-prompt" className="mb-2 flex items-center gap-1.5 text-sm font-medium text-slate-700">
          <Sparkles className="h-4 w-4 text-indigo-500" /> درخواست جدید
        </label>
        <textarea
          id="assistant-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value.slice(0, MAX_PROMPT))}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") submit()
          }}
          rows={4}
          dir="auto"
          placeholder="مثال: فهرست مشتریانی که سرورشان تعلیق شده را استخراج کن و یک پیام تمدید مناسب برایشان بنویس."
          className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-400">
            {prompt.length.toLocaleString("fa-IR")} از {MAX_PROMPT.toLocaleString("fa-IR")} کاراکتر · اجرا در پس‌زمینه، تا چند دقیقه طول می‌کشد
          </p>
          <Button onClick={submit} disabled={submitting || !prompt.trim()}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            ارسال درخواست
          </Button>
        </div>
        {error && (
          <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-rose-100">{error}</p>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="flex items-center gap-1.5 text-sm font-medium text-slate-600">
          <History className="h-4 w-4" /> تاریخچه
        </h2>
        {loading ? (
          <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-10 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400">
            هنوز درخواستی ثبت نشده است.
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard key={task.id} task={task} defaultOpen={task.id === expandedId} />
          ))
        )}
      </div>
    </div>
  )
}
