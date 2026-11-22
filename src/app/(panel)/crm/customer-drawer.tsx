"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  BadgeCheck,
  CalendarClock,
  Check,
  CreditCard,
  Loader2,
  MessageSquare,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  StickyNote,
  Ticket,
  X,
} from "lucide-react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { JalaliDateInput } from "@/components/ui/jalali-date-input"
import { cn } from "@/lib/utils"
import {
  type CrmMeta,
  type CustomerDetail,
  type FollowUp,
  extractError,
  formatDate,
  formatDateTime,
  formatMoney,
  isOverdue,
} from "./types"

interface Props {
  customerId: number
  meta: CrmMeta | null
  initialFollowUpId?: string | null
  onClose: () => void
  onChanged: () => void
}

const INVOICE_STATUS_STYLES: Record<string, string> = {
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  canceled: "bg-rose-50 text-rose-700 border-rose-200",
  refunded: "bg-slate-50 text-slate-600 border-slate-200",
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] font-medium text-slate-500">{children}</span>
}

function Badge({
  children,
  tone = "slate",
}: {
  children: React.ReactNode
  tone?: "slate" | "emerald" | "rose" | "amber" | "indigo"
}) {
  const styles = {
    slate: "bg-slate-100 text-slate-600",
    emerald: "bg-emerald-50 text-emerald-700",
    rose: "bg-rose-50 text-rose-700",
    amber: "bg-amber-50 text-amber-700",
    indigo: "bg-indigo-50 text-indigo-700",
  }[tone]
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", styles)}>
      {children}
    </span>
  )
}

function Section({
  title,
  icon,
  action,
  children,
}: {
  title: string
  icon: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
          {icon}
          {title}
        </h3>
        {action}
      </header>
      {children}
    </section>
  )
}

function FollowUpLine({
  item,
  busy,
  highlighted,
  onOpen,
  onComplete,
  onSnooze,
  onReopen,
  onCancel,
}: {
  item: FollowUp
  busy: boolean
  highlighted: boolean
  onOpen: () => void
  onComplete: () => void
  onSnooze: (days: number) => void
  onReopen: () => void
  onCancel: () => void
}) {
  const open = item.status === "open"
  const snoozed = item.status === "snoozed"
  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        highlighted ? "border-indigo-300 bg-indigo-50/50" : "border-slate-200 bg-white",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={open && isOverdue(item.due_at) ? "rose" : "indigo"}>
          {item.kind_label}
        </Badge>
        <span className="text-xs font-medium text-slate-700">{item.status_label}</span>
        <span className="text-[11px] text-slate-500">
          موعد: {formatDate(item.due_at)}
          {snoozed && item.snoozed_until
            ? ` · یادآوری: ${formatDate(item.snoozed_until)}`
            : ""}
        </span>
        {item.outcome_label ? <Badge tone="emerald">{item.outcome_label}</Badge> : null}
      </div>
      <p className="mt-1.5 text-xs leading-5 text-slate-700">{item.reason}</p>
      {item.note ? (
        <p className="mt-1 rounded-lg bg-slate-50 px-2 py-1.5 text-[11px] leading-5 text-slate-600">
          {item.note}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-[11px]" onClick={onOpen}>
          <Phone className="h-3 w-3" />
          پروفایل و تماس
        </Button>
        {open ? (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 px-2 text-[11px]"
              disabled={busy}
              onClick={onComplete}
            >
              <Check className="h-3 w-3" />
              انجام شد
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[11px]"
              disabled={busy}
              onClick={() => onSnooze(7)}
            >
              ۱ هفته بعد
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[11px]"
              disabled={busy}
              onClick={() => onSnooze(30)}
            >
              ۱ ماه بعد
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[11px] text-slate-500"
              disabled={busy}
              onClick={onCancel}
            >
              حذف از لیست
            </Button>
          </>
        ) : null}
        {snoozed ? (
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 px-2 text-[11px]"
            disabled={busy}
            onClick={onReopen}
          >
            <RotateCcw className="h-3 w-3" />
            برگرداندن به امروز
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export function CustomerDrawer({
  customerId,
  meta,
  initialFollowUpId,
  onClose,
  onChanged,
}: Props) {
  const [detail, setDetail] = useState<CustomerDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)

  const [persona, setPersona] = useState("")
  const [tagsText, setTagsText] = useState("")
  const [doNotCall, setDoNotCall] = useState(false)
  const [outcome, setOutcome] = useState("answered")
  const [noteBody, setNoteBody] = useState("")
  const [completeOutcome, setCompleteOutcome] = useState("answered")
  const [completeNote, setCompleteNote] = useState("")
  const [nextDays, setNextDays] = useState("0")
  const [reminderDays, setReminderDays] = useState("7")
  const [reminderDue, setReminderDue] = useState<string | null>(null)
  const [reminderReason, setReminderReason] = useState("پیگیری تلفنی")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get<CustomerDetail>(`/panel/crm/customers/${customerId}/`)
      setDetail(data)
      setPersona(data.profile.persona || "")
      setTagsText((data.profile.tags || []).join("، "))
      setDoNotCall(Boolean(data.profile.do_not_call))
      setError(null)
    } catch (err) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }, [customerId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const flash = (message: string) => {
    setSaved(message)
    window.setTimeout(() => setSaved(null), 2500)
  }

  const refresh = async (message?: string) => {
    await load()
    onChanged()
    if (message) flash(message)
  }

  const saveProfile = async () => {
    setBusy(true)
    try {
      const tags = tagsText
        .split(/[،,]/)
        .map((tag) => tag.trim())
        .filter(Boolean)
      await api.patch(`/panel/crm/customers/${customerId}/profile/`, {
        persona,
        tags,
        do_not_call: doNotCall,
      })
      await refresh("شرح حال ذخیره شد.")
    } catch (err) {
      setError(extractError(err))
    } finally {
      setBusy(false)
    }
  }

  const submitCall = async () => {
    if (!noteBody.trim()) return
    setBusy(true)
    try {
      await api.post(`/panel/crm/customers/${customerId}/notes/`, {
        body: noteBody,
        outcome,
        kind: "call",
      })
      setNoteBody("")
      await refresh("گزارش تماس ثبت شد.")
    } catch (err) {
      setError(extractError(err))
    } finally {
      setBusy(false)
    }
  }

  const act = async (followup: FollowUp, action: string, payload: Record<string, unknown> = {}) => {
    setBusy(true)
    try {
      await api.post(`/panel/crm/followups/${followup.id}/${action}/`, payload)
      await refresh()
    } catch (err) {
      setError(extractError(err))
    } finally {
      setBusy(false)
    }
  }

  const completeFromForm = async (followup: FollowUp) => {
    setBusy(true)
    try {
      await api.post(`/panel/crm/followups/${followup.id}/complete/`, {
        outcome: completeOutcome,
        note: completeNote,
        next_days: nextDays === "0" ? undefined : Number(nextDays),
      })
      setCompleteNote("")
      await refresh("تماس ثبت و پیگیری بسته شد.")
    } catch (err) {
      setError(extractError(err))
    } finally {
      setBusy(false)
    }
  }

  const createReminder = async () => {
    setBusy(true)
    try {
      await api.post("/panel/crm/followups/", {
        user_id: customerId,
        reason: reminderReason || "پیگیری تلفنی",
        due_at: reminderDue || undefined,
        due_days: reminderDue ? undefined : Number(reminderDays || 7),
      })
      await refresh("یادآوری ساخته شد.")
    } catch (err) {
      setError(extractError(err))
    } finally {
      setBusy(false)
    }
  }

  const openFollowups = useMemo(
    () => (detail?.followups ?? []).filter((item) => item.status === "open"),
    [detail],
  )
  const initialFollowup = useMemo(
    () => (detail?.followups ?? []).find((item) => item.id === initialFollowUpId) || null,
    [detail, initialFollowUpId],
  )

  return (
    <div className="fixed inset-0 z-50 flex">
      <button
        type="button"
        aria-label="بستن"
        className="flex-1 bg-slate-900/40 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <aside className="flex h-full w-full max-w-3xl flex-col overflow-hidden border-l border-slate-200 bg-slate-50 shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                {detail?.customer.display_name || "در حال بارگذاری…"}
              </h2>
              {detail?.profile.do_not_call ? <Badge tone="rose">تماس نگیرید</Badge> : null}
              {(detail?.segment_labels ?? []).map((label) => (
                <Badge key={label} tone="indigo">
                  {label}
                </Badge>
              ))}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
              {detail?.customer.mobile ? (
                <a
                  href={`tel:${detail.customer.mobile}`}
                  className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:underline"
                  dir="ltr"
                >
                  <Phone className="h-3 w-3" />
                  {detail.customer.mobile}
                </a>
              ) : null}
              {detail?.customer.email ? <span dir="ltr">{detail.customer.email}</span> : null}
              {detail ? <span>عضویت: {formatDate(detail.customer.created_at)}</span> : null}
              {detail?.customer.last_login ? (
                <span>آخرین ورود: {formatDateTime(detail.customer.last_login)}</span>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {saved ? (
          <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-700">
            {saved}
          </div>
        ) : null}
        {error ? (
          <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="flex-1 space-y-3 overflow-y-auto p-3 md:p-4">
          {loading && !detail ? (
            <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              در حال دریافت پرونده مشتری…
            </div>
          ) : null}

          {detail ? (
            <>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <Label>مجموع پرداخت</Label>
                  <p className="mt-0.5 text-sm font-bold text-slate-900">
                    {formatMoney(detail.stats.total_paid)}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {detail.stats.paid_count} فاکتور پرداخت‌شده
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <Label>فاکتور رهاشده</Label>
                  <p className="mt-0.5 text-sm font-bold text-rose-700">
                    {formatMoney(detail.stats.abandoned_value)}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {detail.stats.abandoned_count} فاکتور
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <Label>تیکت‌ها</Label>
                  <p className="mt-0.5 text-sm font-bold text-slate-900">
                    {detail.stats.ticket_total}
                    {detail.stats.ticket_open ? (
                      <span className="ms-1 text-[11px] font-normal text-amber-600">
                        ({detail.stats.ticket_open} باز)
                      </span>
                    ) : null}
                  </p>
                  <p className="text-[10px] text-slate-500">آخرین: {formatDate(detail.ticket_summary.last_at)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <Label>آخرین تماس</Label>
                  <p className="mt-0.5 text-sm font-bold text-slate-900">
                    {detail.profile.last_contacted_at
                      ? formatDate(detail.profile.last_contacted_at)
                      : "—"}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {detail.profile.last_contact_outcome_label || "ثبت نشده"}
                  </p>
                </div>
              </div>

              <Section
                title="شرح حال مشتری"
                icon={<StickyNote className="h-4 w-4 text-amber-500" />}
                action={
                  <Button size="sm" className="h-8 gap-1.5" onClick={() => void saveProfile()} disabled={busy}>
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    ذخیره
                  </Button>
                }
              >
                <textarea
                  value={persona}
                  onChange={(event) => setPersona(event.target.value)}
                  rows={3}
                  placeholder="مثلاً: مشتری حساس به تأخیر، همیشه عصبانی است؛ قبل از تماس وضعیت سرویس را چک کن. آخرین بار برای تمدید تخفیف خواست."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-6 text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
                />
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    value={tagsText}
                    onChange={(event) => setTagsText(event.target.value)}
                    placeholder="برچسب‌ها با ویرگول جدا شوند: وفادار، تخفیف‌خواه، عصبی"
                    className="h-9 flex-1 text-xs"
                  />
                  <label className="flex items-center gap-1.5 text-[11px] text-slate-600">
                    <input
                      type="checkbox"
                      checked={doNotCall}
                      onChange={(event) => setDoNotCall(event.target.checked)}
                      className="h-3.5 w-3.5 rounded border-slate-300"
                    />
                    تماس نگیرید
                  </label>
                </div>
              </Section>

              {openFollowups.length ? (
                <Section
                  title="پیگیری‌های باز"
                  icon={<CalendarClock className="h-4 w-4 text-indigo-500" />}
                >
                  <div className="space-y-2">
                    {openFollowups.map((item) => (
                      <div key={item.id}>
                        <FollowUpLine
                          item={item}
                          busy={busy}
                          highlighted={item.id === initialFollowUpId}
                          onOpen={() => void load()}
                          onComplete={() => void act(item, "complete")}
                          onSnooze={(days) => void act(item, "snooze", { days })}
                          onReopen={() => void act(item, "reopen")}
                          onCancel={() => void act(item, "cancel")}
                        />
                        {initialFollowup?.id === item.id ? (
                          <div className="mt-2 rounded-xl border border-indigo-200 bg-indigo-50/60 p-3">
                            <p className="mb-2 text-[11px] font-medium text-indigo-800">
                              ثبت نتیجه همین تماس
                            </p>
                            <div className="grid gap-2 sm:grid-cols-2">
                              <select
                                value={completeOutcome}
                                onChange={(event) => setCompleteOutcome(event.target.value)}
                                className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs"
                              >
                                {(meta?.outcomes ?? detail.outcomes).map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                              <select
                                value={nextDays}
                                onChange={(event) => setNextDays(event.target.value)}
                                className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs"
                              >
                                <option value="0">بدون یادآوری بعدی</option>
                                <option value="7">یادآوری یک هفته بعد</option>
                                <option value="14">یادآوری دو هفته بعد</option>
                                <option value="30">یادآوری یک ماه بعد</option>
                              </select>
                            </div>
                            <textarea
                              value={completeNote}
                              onChange={(event) => setCompleteNote(event.target.value)}
                              rows={2}
                              placeholder="خلاصه مکالمه…"
                              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs leading-5 outline-none focus:border-indigo-400"
                            />
                            <Button
                              size="sm"
                              className="mt-2 h-8 gap-1"
                              disabled={busy}
                              onClick={() => void completeFromForm(item)}
                            >
                              <Check className="h-3.5 w-3.5" />
                              ثبت و بستن پیگیری
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </Section>
              ) : null}

              <Section
                title="ثبت گزارش تماس / یادداشت"
                icon={<Phone className="h-4 w-4 text-emerald-600" />}
              >
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select
                    value={outcome}
                    onChange={(event) => setOutcome(event.target.value)}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs sm:w-44"
                  >
                    {(meta?.outcomes ?? detail.outcomes).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <Input
                    value={noteBody}
                    onChange={(event) => setNoteBody(event.target.value)}
                    placeholder="چه گفت؟ چه قرار شد؟ (مثلاً: گفت تا آخر هفته پرداخت می‌کند)"
                    className="h-9 flex-1 text-xs"
                  />
                  <Button
                    size="sm"
                    className="h-9 gap-1.5"
                    disabled={busy || !noteBody.trim()}
                    onClick={() => void submitCall()}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    ثبت
                  </Button>
                </div>

                <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
                    <CalendarClock className="h-3.5 w-3.5" />
                    یادآوری بعدی (از لیست امروز خط می‌خورد و در بایگانی می‌آید)
                  </p>
                  <div className="grid gap-2 sm:grid-cols-4">
                    <Input
                      value={reminderReason}
                      onChange={(event) => setReminderReason(event.target.value)}
                      placeholder="دلیل پیگیری"
                      className="h-9 text-xs"
                    />
                    <select
                      value={reminderDays}
                      onChange={(event) => {
                        setReminderDays(event.target.value)
                        setReminderDue(null)
                      }}
                      className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs"
                      disabled={Boolean(reminderDue)}
                    >
                      {(meta?.snooze_options ?? [
                        { days: 7, label: "یک هفته" },
                        { days: 14, label: "دو هفته" },
                        { days: 30, label: "یک ماه" },
                      ]).map((option) => (
                        <option key={option.days} value={option.days}>
                          {option.label} بعد
                        </option>
                      ))}
                    </select>
                    <JalaliDateInput
                      value={reminderDue}
                      onChange={setReminderDue}
                      placeholder="یا تاریخ دقیق"
                      className="[&_input]:h-9 [&_input]:text-xs"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 gap-1.5"
                      disabled={busy}
                      onClick={() => void createReminder()}
                    >
                      <CalendarClock className="h-3.5 w-3.5" />
                      ساخت یادآوری
                    </Button>
                  </div>
                </div>
              </Section>

              <Section
                title="شرح حال از تیکت‌ها"
                icon={<Ticket className="h-4 w-4 text-indigo-500" />}
              >
                <p className="rounded-xl bg-indigo-50 px-3 py-2 text-[11px] leading-6 text-indigo-900">
                  {detail.ticket_summary.summary || "تیکتی ثبت نشده است."}
                </p>
                <div className="mt-2 space-y-1.5">
                  {detail.tickets.slice(0, 6).map((ticket) => (
                    <div key={ticket.id} className="rounded-lg border border-slate-200 px-3 py-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-medium text-slate-800">{ticket.subject}</span>
                        <Badge tone={ticket.is_open ? "amber" : "slate"}>{ticket.status_label}</Badge>
                      </div>
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        {formatDateTime(ticket.created_at)} · {ticket.comment_count} پیام
                        {ticket.last_comment ? ` · آخرین: ${ticket.last_comment.side_label}` : ""}
                      </p>
                      {ticket.last_comment ? (
                        <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-slate-600">
                          {ticket.last_comment.body}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </Section>

              <Section
                title="فاکتورها و پرداخت‌ها"
                icon={<CreditCard className="h-4 w-4 text-slate-500" />}
              >
                <div className="space-y-1.5">
                  {detail.invoices.slice(0, 10).map((invoice) => (
                    <div
                      key={invoice.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2"
                    >
                      <div>
                        <p className="text-xs font-medium text-slate-800">
                          {invoice.product}
                          {invoice.product_name ? ` · ${invoice.product_name}` : ""}
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-500">
                          {formatDate(invoice.created_at)} · {invoice.attempts} تلاش پرداخت
                          {invoice.reached_gateway ? " · درگاه دیده شده" : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          {formatMoney(invoice.amount)}
                        </span>
                        <span
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[10px]",
                            INVOICE_STATUS_STYLES[invoice.status] ?? "border-slate-200 bg-slate-50 text-slate-600",
                          )}
                        >
                          {invoice.status_label}
                        </span>
                      </div>
                    </div>
                  ))}
                  {detail.invoices.length === 0 ? (
                    <p className="py-2 text-center text-[11px] text-slate-400">فاکتوری ندارد.</p>
                  ) : null}
                </div>
              </Section>

              <Section
                title="تاریخچه یادداشت‌ها"
                icon={<MessageSquare className="h-4 w-4 text-slate-500" />}
              >
                <div className="space-y-2">
                  {detail.notes.map((note) => (
                    <div key={note.id} className="rounded-lg border border-slate-200 px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={note.kind === "call" ? "emerald" : "slate"}>
                          {note.kind_label}
                        </Badge>
                        {note.outcome_label ? <Badge tone="indigo">{note.outcome_label}</Badge> : null}
                        <span className="text-[10px] text-slate-500">
                          {note.author || "سیستم"} · {formatDateTime(note.created_at)}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] leading-5 text-slate-700">{note.body}</p>
                    </div>
                  ))}
                  {detail.notes.length === 0 ? (
                    <p className="py-2 text-center text-[11px] text-slate-400">
                      هنوز یادداشتی ندارد.
                    </p>
                  ) : null}
                </div>
              </Section>

              <p className="flex items-center gap-1.5 pb-2 text-[10px] text-slate-400">
                <BadgeCheck className="h-3 w-3" />
                شرح حال و یادداشت‌ها برای همهٔ کارشناسان پنل قابل مشاهده است.
              </p>
            </>
          ) : null}
        </div>
      </aside>
    </div>
  )
}
