"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CornerDownLeft,
  Loader2,
  MessageSquare,
  Paperclip,
  RefreshCw,
  Search,
  Send,
  Ticket as TicketIcon,
  UserCheck,
  X,
} from "lucide-react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface TicketRow {
  id: string
  subject: string
  status: string
  status_display: string
  category?: string | null
  category_name?: string
  label?: string | null
  label_name?: string
  product_type?: string
  product_name?: string | null
  comment_count: number
  attachment?: string | null
  attachment_name?: string | null
  last_reply_at?: string
  created_at: string
  updated_at: string
  completed_at?: string | null
  user_name?: string
  user_email?: string
  user_mobile?: string
}

interface TicketComment {
  id: string
  body: string
  author_name: string
  is_staff: boolean
  created_at: string
  attachment?: string | null
  attachment_name?: string | null
}

interface TicketDetail extends TicketRow {
  body: string
  agent_name?: string | null
  satisfied?: boolean | null
  comments: TicketComment[]
}

interface MetaOption {
  id: string
  name: string
  color?: string
}

interface TicketMeta {
  statuses: { value: string; label: string }[]
  categories: MetaOption[]
  labels: MetaOption[]
  counts: Record<string, number>
  total: number
  open: number
}

interface Page<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

const STATUS_STYLES: Record<string, string> = {
  "1": "bg-sky-50 text-sky-700 border-sky-200",
  "2": "bg-amber-50 text-amber-700 border-amber-200",
  "3": "bg-violet-50 text-violet-700 border-violet-200",
  "4": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "5": "bg-orange-50 text-orange-700 border-orange-200",
  "6": "bg-indigo-50 text-indigo-700 border-indigo-200",
  "7": "bg-slate-100 text-slate-500 border-slate-200",
}

const PRODUCT_LABELS: Record<string, string> = {
  paas: "پلتفرم",
  haioflash: "هایوفلش",
  haiogate: "هایوگیت",
  other: "سایر",
}

function extractError(error: unknown): string {
  const data = (error as { response?: { data?: unknown } })?.response?.data
  if (typeof data === "string") return data
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>
    if (typeof record.detail === "string") return record.detail
    for (const value of Object.values(record)) {
      if (typeof value === "string") return value
      if (Array.isArray(value) && typeof value[0] === "string") return value[0]
    }
  }
  return "خطایی رخ داد. دوباره تلاش کنید."
}

function formatTime(value?: string | null, withTime = true): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString("fa-IR", withTime ? { dateStyle: "short", timeStyle: "short" } : { dateStyle: "short" })
}

export default function TicketsPage() {
  const [meta, setMeta] = useState<TicketMeta | null>(null)
  const [rows, setRows] = useState<TicketRow[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("open")
  const [category, setCategory] = useState("")
  const [productType, setProductType] = useState("")

  const [selectedId, setSelectedId] = useState<string | null>(null)

  const pageSize = 20

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  const fetchMeta = useCallback(async () => {
    try {
      const { data } = await api.get<TicketMeta>("/panel/tickets/meta/")
      setMeta(data)
    } catch {
      /* meta is optional chrome — the queue still works */
    }
  }, [])

  const fetchRows = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const params: Record<string, string | number> = { page, page_size: pageSize }
      if (search) params.search = search
      if (statusFilter) params.status = statusFilter
      if (category) params.category = category
      if (productType) params.product_type = productType
      const { data } = await api.get<Page<TicketRow>>("/panel/tickets/", { params })
      setRows(data.results)
      setCount(data.count)
    } catch (err) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter, category, productType])

  useEffect(() => {
    fetchMeta()
  }, [fetchMeta])

  useEffect(() => {
    fetchRows()
  }, [fetchRows])

  const refreshAll = () => {
    fetchRows()
    fetchMeta()
  }

  const pages = Math.max(1, Math.ceil(count / pageSize))

  const statusTabs = useMemo(() => {
    if (!meta) return []
    return [
      { value: "open", label: "باز", count: meta.open },
      ...meta.statuses.map((item) => ({
        value: item.value,
        label: item.label,
        count: meta.counts[item.value] ?? 0,
      })),
    ]
  }, [meta])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <TicketIcon className="h-4 w-4" />
          <span>{meta ? `${meta.total.toLocaleString("fa-IR")} تیکت ثبت شده` : "در حال دریافت آمار…"}</span>
          {meta ? (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
              {meta.open.toLocaleString("fa-IR")} باز
            </span>
          ) : null}
        </div>
        <Button variant="outline" size="sm" onClick={refreshAll} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          بروزرسانی
        </Button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          {statusTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => {
                setStatusFilter(tab.value)
                setPage(1)
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs transition-colors",
                statusFilter === tab.value
                  ? "bg-indigo-50 font-medium text-indigo-700"
                  : "text-slate-600 hover:bg-slate-50",
              )}
            >
              {tab.label}
              <span className="rounded-md bg-white/70 px-1.5 py-0.5 text-[10px] text-slate-500">
                {tab.count.toLocaleString("fa-IR")}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 md:grid-cols-[1fr_180px_180px]">
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="جستجو در موضوع، متن یا مشخصات مشتری…"
            className="pr-9"
          />
        </div>
        <select
          value={category}
          onChange={(event) => {
            setCategory(event.target.value)
            setPage(1)
          }}
          className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100"
        >
          <option value="">همه بخش‌ها</option>
          {meta?.categories.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <select
          value={productType}
          onChange={(event) => {
            setProductType(event.target.value)
            setPage(1)
          }}
          className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100"
        >
          <option value="">همه محصولات</option>
          {Object.entries(PRODUCT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-right text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">موضوع</th>
              <th className="px-4 py-3 font-medium">مشتری</th>
              <th className="px-4 py-3 font-medium">وضعیت</th>
              <th className="px-4 py-3 font-medium">بخش</th>
              <th className="px-4 py-3 font-medium">پاسخ‌ها</th>
              <th className="px-4 py-3 font-medium">آخرین فعالیت</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center text-slate-400">
                  <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                  در حال دریافت تیکت‌ها…
                </td>
              </tr>
            ) : null}

            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center text-slate-400">
                  تیکتی با این فیلترها پیدا نشد.
                </td>
              </tr>
            ) : null}

            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => setSelectedId(row.id)}
                className="cursor-pointer transition-colors hover:bg-slate-50/80"
              >
                <td className="max-w-[280px] px-4 py-3">
                  <div className="truncate font-medium text-slate-800">{row.subject}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
                    <span className="font-mono">{row.id.slice(0, 8)}</span>
                    {row.product_name ? <span>· {row.product_name}</span> : null}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-slate-700">{row.user_name || "—"}</div>
                  <div className="text-[11px] text-slate-400">{row.user_email || row.user_mobile || ""}</div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex rounded-lg border px-2 py-1 text-[11px]",
                      STATUS_STYLES[row.status] ?? "border-slate-200 bg-slate-50 text-slate-600",
                    )}
                  >
                    {row.status_display}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{row.category_name || "—"}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 text-slate-600">
                    <MessageSquare className="h-3.5 w-3.5 text-slate-400" />
                    {row.comment_count.toLocaleString("fa-IR")}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{formatTime(row.last_reply_at || row.updated_at)}</td>
                <td className="px-4 py-3 text-left">
                  <ChevronLeft className="h-4 w-4 text-slate-300" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          صفحه {page.toLocaleString("fa-IR")} از {pages.toLocaleString("fa-IR")}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            <ChevronRight className="h-4 w-4" />
            قبلی
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pages || loading}
            onClick={() => setPage((current) => current + 1)}
          >
            بعدی
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {selectedId ? (
        <TicketDrawer
          ticketId={selectedId}
          statuses={meta?.statuses ?? []}
          onClose={() => setSelectedId(null)}
          onChanged={refreshAll}
        />
      ) : null}
    </div>
  )
}

function TicketDrawer({
  ticketId,
  statuses,
  onClose,
  onChanged,
}: {
  ticketId: string
  statuses: { value: string; label: string }[]
  onClose: () => void
  onChanged: () => void
}) {
  const [ticket, setTicket] = useState<TicketDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [reply, setReply] = useState("")
  const [sending, setSending] = useState(false)
  const [busy, setBusy] = useState(false)
  const bodyRef = useRef<HTMLDivElement | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const { data } = await api.get<TicketDetail>(`/panel/tickets/${ticketId}/`)
      setTicket(data)
    } catch (err) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }, [ticketId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [ticket?.comments.length])

  const submitReply = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!reply.trim()) return
    setSending(true)
    setError("")
    try {
      const { data } = await api.post<TicketDetail>(`/panel/tickets/${ticketId}/comments/`, {
        body: reply.trim(),
      })
      setTicket(data)
      setReply("")
      onChanged()
    } catch (err) {
      setError(extractError(err))
    } finally {
      setSending(false)
    }
  }

  const changeStatus = async (status: string) => {
    setBusy(true)
    setError("")
    try {
      const { data } = await api.patch<TicketDetail>(`/panel/tickets/${ticketId}/`, { status })
      setTicket(data)
      onChanged()
    } catch (err) {
      setError(extractError(err))
    } finally {
      setBusy(false)
    }
  }

  const claim = async () => {
    setBusy(true)
    setError("")
    try {
      const { data } = await api.post<TicketDetail>(`/panel/tickets/${ticketId}/claim/`)
      setTicket(data)
      onChanged()
    } catch (err) {
      setError(extractError(err))
    } finally {
      setBusy(false)
    }
  }

  const closeTicket = async () => {
    setBusy(true)
    setError("")
    try {
      const { data } = await api.post<TicketDetail>(`/panel/tickets/${ticketId}/close/`)
      setTicket(data)
      onChanged()
    } catch (err) {
      setError(extractError(err))
    } finally {
      setBusy(false)
    }
  }

  const download = async (url: string, name?: string | null) => {
    try {
      const relative = url.replace(/^\/api\/v1/, "")
      const response = await api.get(relative, { responseType: "blob" })
      const href = URL.createObjectURL(response.data as Blob)
      const anchor = document.createElement("a")
      anchor.href = href
      anchor.download = name || "attachment"
      anchor.click()
      URL.revokeObjectURL(href)
    } catch (err) {
      setError(extractError(err))
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-start bg-slate-900/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2 text-[11px] text-slate-400">
              <span className="font-mono">{ticketId.slice(0, 8)}</span>
              {ticket ? <span>· {formatTime(ticket.created_at)}</span> : null}
            </div>
            <h2 className="truncate text-base font-bold text-slate-900">
              {ticket?.subject || "در حال بارگذاری…"}
            </h2>
            {ticket ? (
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                <span
                  className={cn(
                    "rounded-lg border px-2 py-0.5",
                    STATUS_STYLES[ticket.status] ?? "border-slate-200 bg-slate-50 text-slate-600",
                  )}
                >
                  {ticket.status_display}
                </span>
                {ticket.category_name ? (
                  <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-slate-600">{ticket.category_name}</span>
                ) : null}
                {ticket.product_name ? (
                  <span className="rounded-lg bg-indigo-50 px-2 py-0.5 text-indigo-600">{ticket.product_name}</span>
                ) : null}
              </div>
            ) : null}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-2.5 text-xs">
          {ticket ? (
            <>
              <span className="text-slate-500">مشتری:</span>
              <span className="font-medium text-slate-700">{ticket.user_name}</span>
              <span className="text-slate-400">{ticket.user_email || ticket.user_mobile || ""}</span>
              {ticket.agent_name ? (
                <span className="ml-auto text-slate-400">کارشناس: {ticket.agent_name}</span>
              ) : null}
            </>
          ) : null}
        </div>

        {error ? <div className="bg-rose-50 px-4 py-2 text-xs text-rose-700">{error}</div> : null}

        <div ref={bodyRef} className="flex-1 space-y-3 overflow-y-auto p-4 scrollbar-thin">
          {loading && !ticket ? (
            <div className="flex justify-center py-16 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : null}

          {ticket ? (
            <>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="mb-2 flex items-center gap-2 text-[11px] text-slate-400">
                  <span className="font-medium text-slate-600">{ticket.user_name}</span>
                  <span>{formatTime(ticket.created_at)}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{ticket.body}</p>
                {ticket.attachment ? (
                  <button
                    onClick={() => download(ticket.attachment as string, ticket.attachment_name)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs text-indigo-600 ring-1 ring-slate-200"
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                    {ticket.attachment_name || "پیوست"}
                  </button>
                ) : null}
              </div>

              {ticket.comments.map((comment) => (
                <div
                  key={comment.id}
                  className={cn(
                    "rounded-2xl p-4",
                    comment.is_staff
                      ? "bg-indigo-50/70 ring-1 ring-indigo-100"
                      : "bg-slate-50",
                  )}
                >
                  <div className="mb-2 flex items-center gap-2 text-[11px] text-slate-400">
                    <span className="font-medium text-slate-600">{comment.author_name}</span>
                    {comment.is_staff ? (
                      <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] text-indigo-700">کارشناس</span>
                    ) : null}
                    <span>{formatTime(comment.created_at)}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{comment.body}</p>
                  {comment.attachment ? (
                    <button
                      onClick={() => download(comment.attachment as string, comment.attachment_name)}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs text-indigo-600 ring-1 ring-slate-200"
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      {comment.attachment_name || "پیوست"}
                    </button>
                  ) : null}
                </div>
              ))}
            </>
          ) : null}
        </div>

        <div className="space-y-3 border-t border-slate-100 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={ticket?.status || ""}
              onChange={(event) => changeStatus(event.target.value)}
              disabled={busy || !ticket}
              className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100"
            >
              {statuses.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <Button variant="outline" size="sm" onClick={claim} disabled={busy || !ticket}>
              <UserCheck className="h-3.5 w-3.5" />
              گرفتن تیکت
            </Button>
            <Button variant="outline" size="sm" onClick={closeTicket} disabled={busy || !ticket}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              بستن
            </Button>
          </div>

          <form onSubmit={submitReply} className="space-y-2">
            <textarea
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              placeholder="پاسخ خود را بنویسید…"
              rows={3}
              className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-100"
            />
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <CornerDownLeft className="h-3 w-3" />
                پاسخ در بک‌اند ثبت و برای مشتری ارسال می‌شود.
              </span>
              <Button type="submit" size="sm" disabled={sending || !reply.trim()}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                ارسال پاسخ
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
