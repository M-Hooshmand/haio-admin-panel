"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
  Trash2,
  UserRound,
  X,
} from "lucide-react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { JalaliDateInput } from "@/components/ui/jalali-date-input"
import { formatJalali, normalizeDigits } from "@/lib/jalali"
import { cn } from "@/lib/utils"
import { NAV_ITEMS, navItemsForUser } from "@/lib/roles"
import { useAuthStore } from "@/stores/auth-store"

// ---------------------------------------------------------------------------
// types
// ---------------------------------------------------------------------------

interface Meta {
  statuses: { value: string; label: string }[]
  kinds: { value: string; label: string }[]
  cycles: { value: string; label: string }[]
  invoice_lead_days_default: number
  vat_percent_default: number
}

interface InvoiceRef {
  id: string
  status: string | null
  status_label: string | null
  amount: number | null
  due_date: string | null
  paid_at: string | null
}

interface DedicatedServerRow {
  id: string
  customer_kind: string
  customer_kind_display: string
  user: number | null
  user_display: string | null
  can_invoice: boolean
  person_name: string
  national_code: string
  company_name: string
  company_economic_code: string
  company_reg_number: string
  company_phone: string
  company_address: string
  rep_name: string
  rep_mobile: string
  rep_email: string
  email: string
  mobile: string
  plan_name: string
  server_specs: string
  services: string
  notes: string
  price: number
  discount: number
  final_price: number
  vat_percent: number
  vat_amount: number
  total_price: number
  balance_due: number
  paid_amount: number
  paid_at: string | null
  payment_note: string
  billing_cycle: string
  billing_cycle_display: string
  start_date: string | null
  next_billing_date: string | null
  invoice_lead_days: number
  invoice_notified_at: string | null
  reminder_sent_at: string | null
  status: string
  status_display: string
  display_name: string
  contact_email: string
  contact_mobile: string
  invoice: InvoiceRef | null
  created_at: string
  updated_at: string
}

interface CustomerHit {
  id: number
  display_name: string
  username: string
  email: string
  mobile: string
}

const EMPTY: DedicatedServerRow = {
  id: "",
  customer_kind: "person",
  customer_kind_display: "حقیقی",
  user: null,
  user_display: null,
  can_invoice: true,
  person_name: "",
  national_code: "",
  company_name: "",
  company_economic_code: "",
  company_reg_number: "",
  company_phone: "",
  company_address: "",
  rep_name: "",
  rep_mobile: "",
  rep_email: "",
  email: "",
  mobile: "",
  plan_name: "",
  server_specs: "",
  services: "",
  notes: "",
  price: 0,
  discount: 0,
  final_price: 0,
  vat_percent: 10,
  vat_amount: 0,
  total_price: 0,
  balance_due: 0,
  paid_amount: 0,
  paid_at: null,
  payment_note: "",
  billing_cycle: "monthly",
  billing_cycle_display: "ماهانه",
  start_date: null,
  next_billing_date: null,
  invoice_lead_days: 7,
  invoice_notified_at: null,
  reminder_sent_at: null,
  status: "active",
  status_display: "فعال",
  display_name: "",
  contact_email: "",
  contact_mobile: "",
  invoice: null,
  created_at: "",
  updated_at: "",
}

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600 border-slate-200",
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  on_hold: "bg-amber-50 text-amber-700 border-amber-200",
  completed: "bg-sky-50 text-sky-700 border-sky-200",
  canceled: "bg-rose-50 text-rose-700 border-rose-200",
}

const INVOICE_STYLE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  canceled: "bg-slate-100 text-slate-600 border-slate-200",
  refunded: "bg-sky-50 text-sky-700 border-sky-200",
}

const PAGE_SIZE = 25

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

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

/** Parse a numeric field but keep a deliberate 0 (unlike `Number(v) || fallback`). */
function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(String(value ?? "").replace(/[^\d.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : fallback
}

function money(value: number | null | undefined): string {
  return new Intl.NumberFormat("fa-IR").format(Number(value ?? 0))
}

function toman(value: number | null | undefined): string {
  return `${money(value)} تومان`
}

/**
 * Numeric money field that keeps its own draft text so an empty box and a
 * deliberate `0` both work (the API stores 0 for either).
 */
function MoneyInput({
  value,
  onChange,
  placeholder,
}: {
  value: number
  onChange: (next: number) => void
  placeholder?: string
}) {
  const [text, setText] = useState(() => (value ? String(value) : ""))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setText(value ? String(value) : "")
  }, [value, focused])

  return (
    <Input
      dir="ltr"
      inputMode="numeric"
      placeholder={placeholder}
      value={text}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false)
        setText(value ? String(value) : "")
      }}
      onChange={(event) => {
        const raw = normalizeDigits(event.target.value).replace(/[^\d]/g, "")
        setText(raw)
        onChange(raw ? Number(raw) : 0)
      }}
    />
  )
}

function roleName(row: DedicatedServerRow): string {
  return row.person_name || row.company_name || row.display_name || "—"
}

// ---------------------------------------------------------------------------
// page
// ---------------------------------------------------------------------------

export default function DedicatedPage() {
  const { user, isLoading: authLoading } = useAuthStore()
  const [tab, setTab] = useState<"list" | "form">("list")
  const [meta, setMeta] = useState<Meta | null>(null)

  // list state
  const [rows, setRows] = useState<DedicatedServerRow[]>([])
  const [count, setCount] = useState(0)
  const [pages, setPages] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null)
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [kindFilter, setKindFilter] = useState("")

  // form state
  const [editing, setEditing] = useState<DedicatedServerRow | null>(null)
  const [form, setForm] = useState<DedicatedServerRow>({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // customer search
  const [customerQuery, setCustomerQuery] = useState("")
  const [customerHits, setCustomerHits] = useState<CustomerHit[]>([])
  const [customerSearching, setCustomerSearching] = useState(false)
  const [customerOpen, setCustomerOpen] = useState(false)

  const requestId = useRef(0)
  const customerRequestId = useRef(0)

  const setField = <K extends keyof DedicatedServerRow>(key: K, value: DedicatedServerRow[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  const fetchMeta = useCallback(async () => {
    try {
      const { data } = await api.get<Meta>("/panel/dedicated/meta/")
      setMeta(data)
    } catch {
      // the table works without option lists
    }
  }, [])

  const fetchRows = useCallback(async () => {
    const current = ++requestId.current
    setLoading(true)
    setError("")
    try {
      const params: Record<string, string | number> = { page, page_size: PAGE_SIZE }
      if (search) params.search = search
      if (statusFilter) params.status = statusFilter
      if (kindFilter) params.kind = kindFilter
      const { data } = await api.get<{ count: number; pages: number; results: DedicatedServerRow[] }>(
        "/panel/dedicated/",
        { params },
      )
      if (current !== requestId.current) return
      setRows(data.results)
      setCount(data.count)
      setPages(data.pages)
    } catch (err) {
      if (current !== requestId.current) return
      setError(extractError(err))
    } finally {
      if (current === requestId.current) setLoading(false)
    }
  }, [page, search, statusFilter, kindFilter])

  useEffect(() => {
    void fetchMeta()
  }, [fetchMeta])

  useEffect(() => {
    if (tab === "list") void fetchRows()
  }, [tab, fetchRows])

  // customer search for the linked-account picker
  useEffect(() => {
    if (tab !== "form") return
    if (!customerQuery.trim()) {
      setCustomerHits([])
      setCustomerSearching(false)
      return
    }
    setCustomerSearching(true)
    const timer = setTimeout(async () => {
      const current = ++customerRequestId.current
      try {
        const { data } = await api.get<{ results: CustomerHit[] }>("/panel/customers/", {
          params: { search: customerQuery.trim(), page_size: 10 },
        })
        if (current !== customerRequestId.current) return
        setCustomerHits(data.results ?? [])
        setCustomerOpen(true)
      } catch {
        if (current !== customerRequestId.current) return
        setCustomerHits([])
      } finally {
        if (current === customerRequestId.current) setCustomerSearching(false)
      }
    }, 350)
    return () => clearTimeout(timer)
  }, [customerQuery, tab])

  const openNew = useCallback(() => {
    setEditing(null)
    setForm({
      ...EMPTY,
      status: "draft",
      invoice_lead_days: meta?.invoice_lead_days_default ?? 7,
      vat_percent: meta?.vat_percent_default ?? 10,
    })
    setCustomerQuery("")
    setCustomerHits([])
    setMessage(null)
    setTab("form")
  }, [meta])

  const openEdit = useCallback((row: DedicatedServerRow) => {
    setEditing(row)
    setForm(row)
    setCustomerQuery("")
    setCustomerHits([])
    setMessage(null)
    setTab("form")
  }, [])

  const remove = useCallback(
    async (row: DedicatedServerRow) => {
      if (!window.confirm(`حذف «${roleName(row)}» قطعی است؟`)) return
      setDeletingId(row.id)
      try {
        await api.delete(`/panel/dedicated/${row.id}/`)
        setMessage({ kind: "ok", text: "حذف شد." })
        await fetchRows()
      } catch (err) {
        setMessage({ kind: "error", text: extractError(err) })
      } finally {
        setDeletingId(null)
      }
    },
    [fetchRows],
  )

  const save = useCallback(async () => {
    setSaving(true)
    setMessage(null)
    try {
      const payload: Record<string, unknown> = {
        customer_kind: form.customer_kind,
        user: form.user,
        person_name: form.person_name,
        national_code: form.national_code,
        company_name: form.company_name,
        company_economic_code: form.company_economic_code,
        company_reg_number: form.company_reg_number,
        company_phone: form.company_phone,
        company_address: form.company_address,
        rep_name: form.rep_name,
        rep_mobile: form.rep_mobile,
        rep_email: form.rep_email,
        email: form.email,
        mobile: form.mobile,
        plan_name: form.plan_name,
        server_specs: form.server_specs,
        services: form.services,
        notes: form.notes,
        price: toNumber(form.price, 0),
        discount: toNumber(form.discount, 0),
        vat_percent: toNumber(form.vat_percent, 10),
        paid_amount: toNumber(form.paid_amount, 0),
        paid_at: form.paid_at || null,
        payment_note: form.payment_note,
        billing_cycle: form.billing_cycle,
        start_date: form.start_date || null,
        next_billing_date: form.next_billing_date || null,
        invoice_lead_days: toNumber(form.invoice_lead_days, 7),
        status: form.status,
      }
      if (editing) {
        await api.patch(`/panel/dedicated/${editing.id}/`, payload)
        setMessage({ kind: "ok", text: "تغییرات ذخیره شد." })
      } else {
        await api.post("/panel/dedicated/", payload)
        setMessage({ kind: "ok", text: "سرور اختصاصی ثبت شد." })
      }
      setTab("list")
      void fetchRows()
    } catch (err) {
      setMessage({ kind: "error", text: extractError(err) })
    } finally {
      setSaving(false)
    }
  }, [form, editing, fetchRows])

  const sectionItem = NAV_ITEMS.find((item) => item.key === "dedicated")
  const allowed = navItemsForUser(user).some((item) => item.key === "dedicated")

  // Live money preview in the form — the same arithmetic the backend applies.
  const formNet = Math.max(toNumber(form.price) - toNumber(form.discount), 0)
  const formVatPercent = Math.min(Math.max(toNumber(form.vat_percent), 0), 100)
  const formVat = Math.round((formNet * formVatPercent) / 100)
  const formTotal = formNet + formVat

  if (authLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-col items-center gap-2 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
          <p className="text-xs">در حال بررسی دسترسی…</p>
        </div>
      </div>
    )
  }

  if (!allowed) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
        <ShieldAlert className="mx-auto h-8 w-8 text-amber-500" />
        <h2 className="mt-3 text-sm font-bold text-amber-900">دسترسی محدود</h2>
        <p className="mt-2 text-sm text-amber-800">این بخش برای نقش شما در دسترس نیست.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm leading-6 text-slate-500">
          {sectionItem?.description} — مشخصات خریدار، پلن، مبلغ اعلام‌شده، تخفیف، خدمات و
          پرداخت‌های دریافت‌شده. هر دوره، فاکتور پرداخت یک هفته زودتر از سررسید صادر و با
          ایمیل و پیامک به مشتری اعلام می‌شود.
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void fetchRows()} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            بروزرسانی
          </Button>
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4" />
            سرور جدید
          </Button>
        </div>
      </div>

      {message ? (
        <div
          className={cn(
            "rounded-xl px-4 py-3 text-sm font-medium ring-1",
            message.kind === "ok"
              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
              : "bg-rose-50 text-rose-700 ring-rose-200",
          )}
        >
          {message.text}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["list", "فهرست سرورها", Server],
            ["form", editing ? "ویرایش سرور" : "ثبت سرور جدید", Building2],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => (key === "form" ? openNew() : setTab(key))}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition",
              tab === key
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "list" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3">
            <div className="relative min-w-[240px] flex-1">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="جست‌وجو: نام، شرکت، نماینده، موبایل، ایمیل یا پلن"
                className="pr-9"
              />
            </div>
            <select
              value={kindFilter}
              onChange={(event) => {
                setKindFilter(event.target.value)
                setPage(1)
              }}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">حقیقی و حقوقی</option>
              <option value="person">حقیقی</option>
              <option value="company">حقوقی</option>
            </select>
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value)
                setPage(1)
              }}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">همه وضعیت‌ها</option>
              {(meta?.statuses ?? []).map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1360px] text-right text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">نوع</th>
                    <th className="px-4 py-3 font-medium">مشتری</th>
                    <th className="px-4 py-3 font-medium">نماینده (حقوقی)</th>
                    <th className="px-4 py-3 font-medium">پلن</th>
                    <th className="px-4 py-3 font-medium">قیمت</th>
                    <th className="px-4 py-3 font-medium">تخفیف</th>
                    <th className="px-4 py-3 font-medium">مبلغ نهایی (خالص)</th>
                    <th className="px-4 py-3 font-medium">ارزش افزوده</th>
                    <th className="px-4 py-3 font-medium">مبلغ کل</th>
                    <th className="px-4 py-3 font-medium">دریافت‌شده</th>
                    <th className="px-4 py-3 font-medium">فاکتور دوره</th>
                    <th className="px-4 py-3 font-medium">سررسید بعدی</th>
                    <th className="px-4 py-3 font-medium">وضعیت</th>
                    <th className="px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading && rows.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="px-4 py-16 text-center text-slate-400">
                        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                        در حال دریافت سرورها…
                      </td>
                    </tr>
                  ) : null}

                  {!loading && rows.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="px-4 py-16 text-center text-slate-400">
                        سروری با این فیلترها پیدا نشد.
                      </td>
                    </tr>
                  ) : null}

                  {rows.map((row) => (
                    <tr key={row.id} className="transition-colors hover:bg-slate-50/80">
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px]",
                            row.customer_kind === "company"
                              ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                              : "bg-slate-50 text-slate-600 border-slate-200",
                          )}
                        >
                          {row.customer_kind === "company" ? (
                            <Building2 className="h-3 w-3" />
                          ) : (
                            <UserRound className="h-3 w-3" />
                          )}
                          {row.customer_kind_display}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{roleName(row)}</div>
                        <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-slate-500">
                          {row.contact_mobile ? (
                            <span className="inline-flex items-center gap-1" dir="ltr">
                              <Phone className="h-3 w-3" />
                              {row.contact_mobile}
                            </span>
                          ) : null}
                          {row.contact_email ? (
                            <span className="inline-flex items-center gap-1 truncate" dir="ltr">
                              <Mail className="h-3 w-3" />
                              {row.contact_email}
                            </span>
                          ) : null}
                        </div>
                        {row.user ? (
                          <div className="mt-0.5 text-[10px] text-slate-400">
                            حساب: {row.user_display}
                          </div>
                        ) : (
                          <div className="mt-0.5 inline-flex items-center gap-1 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] text-rose-600">
                            <CircleAlert className="h-3 w-3" />
                            بدون حساب — فاکتور خودکار نمی‌خورد
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {row.customer_kind === "company" ? (
                          <div className="min-w-40">
                            <div className="text-xs font-medium text-slate-700">
                              {row.rep_name || "—"}
                            </div>
                            <div className="mt-0.5 flex flex-col gap-0.5 text-[11px] text-slate-500">
                              {row.rep_mobile ? <span dir="ltr">{row.rep_mobile}</span> : null}
                              {row.rep_email ? <span dir="ltr">{row.rep_email}</span> : null}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs font-medium text-slate-700">
                          {row.plan_name || "—"}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-400">
                          {row.billing_cycle_display}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700" dir="ltr">
                        {money(row.price)}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {row.discount ? (
                          <span className="text-rose-600" dir="ltr">
                            {money(row.discount)}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700" dir="ltr">
                        {money(row.final_price)}
                      </td>
                      <td className="px-4 py-3 text-xs" dir="ltr">
                        {row.vat_amount ? (
                          <div>
                            <span className="text-slate-700">{money(row.vat_amount)}</span>
                            <div className="text-[10px] text-slate-400">{money(row.vat_percent)}٪</div>
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-900" dir="ltr">
                        {money(row.total_price)}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {row.paid_amount ? (
                          <div>
                            <span className="text-emerald-700" dir="ltr">
                              {money(row.paid_amount)}
                            </span>
                            <div className="mt-0.5 text-[10px] text-slate-400">
                              باقی: {money(row.balance_due)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {row.invoice && row.invoice.status ? (
                          <div className="min-w-32">
                            <span
                              className={cn(
                                "inline-flex rounded-lg border px-2 py-0.5 text-[11px]",
                                INVOICE_STYLE[row.invoice.status] ??
                                  "bg-slate-100 text-slate-600 border-slate-200",
                              )}
                            >
                              {row.invoice.status_label}
                            </span>
                            <div className="mt-1 text-[10px] text-slate-400" dir="ltr">
                              {row.invoice.amount ? money(row.invoice.amount) : "—"}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="inline-flex min-w-28 flex-col gap-0.5 text-[11px] text-slate-600">
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="h-3 w-3 text-slate-400" />
                            {formatJalali(row.next_billing_date)}
                          </span>
                          <span className="text-slate-400">
                            صدور: {formatJalali(row.invoice_notified_at)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex rounded-lg border px-2 py-0.5 text-[11px]",
                            STATUS_STYLE[row.status] ??
                              "bg-slate-100 text-slate-600 border-slate-200",
                          )}
                        >
                          {row.status_display}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEdit(row)}
                            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-indigo-600"
                            title="ویرایش"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => void remove(row)}
                            disabled={deletingId === row.id}
                            className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            title="حذف"
                          >
                            {deletingId === row.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
            <span>
              {money(count)} سرور · صفحه {money(page)} از {money(pages || 1)}
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
                disabled={page >= (pages || 1) || loading}
                onClick={() => setPage((current) => current + 1)}
              >
                بعدی
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {tab === "form" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-bold text-slate-800">نوع مشتری</h2>
            <div className="flex gap-2">
              {(meta?.kinds ?? [
                { value: "person", label: "حقیقی" },
                { value: "company", label: "حقوقی" },
              ]).map((kind) => (
                <button
                  key={kind.value}
                  onClick={() => setField("customer_kind", kind.value)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition",
                    form.customer_kind === kind.value
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-slate-50 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100",
                  )}
                >
                  {kind.value === "company" ? <Building2 className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
                  {kind.label}
                </button>
              ))}
            </div>

            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-medium text-slate-500">
                حساب کاربری مرتبط (برای فاکتور خودکار — الزامی)
              </label>
              <div className="relative max-w-md">
                {form.user && form.user_display ? (
                  <div className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/60 px-3 py-2.5 text-sm">
                    <UserRound className="h-4 w-4 text-indigo-600" />
                    <span className="font-medium text-indigo-900">{form.user_display}</span>
                    <button
                      onClick={() => {
                        setField("user", null)
                        setField("user_display", null)
                        setCustomerQuery("")
                        setCustomerOpen(false)
                      }}
                      className="mr-auto rounded-lg p-1 text-indigo-400 hover:bg-white"
                      title="حذف پیوند"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={customerQuery}
                      onChange={(event) => setCustomerQuery(event.target.value)}
                      onFocus={() => setCustomerOpen(customerHits.length > 0)}
                      placeholder="جست‌وجوی حساب مشتری: نام، ایمیل، موبایل یا نام کاربری…"
                      className="pr-9"
                    />
                  </>
                )}
                {customerSearching ? (
                  <Loader2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
                ) : null}
                {customerOpen && customerHits.length > 0 && !form.user ? (
                  <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                    {customerHits.map((hit) => (
                      <button
                        key={hit.id}
                        onClick={() => {
                          setField("user", hit.id)
                          setField("user_display", hit.display_name || hit.username)
                          setCustomerOpen(false)
                          if (!form.email) setField("email", hit.email)
                          if (!form.mobile) setField("mobile", hit.mobile)
                        }}
                        className="block w-full px-3 py-2.5 text-right text-sm hover:bg-indigo-50"
                      >
                        <div className="font-medium text-slate-800">
                          {hit.display_name || hit.username}
                        </div>
                        <div className="mt-0.5 flex gap-3 text-[11px] text-slate-500">
                          {hit.email ? <span dir="ltr">{hit.email}</span> : null}
                          {hit.mobile ? <span dir="ltr">{hit.mobile}</span> : null}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              {!form.user ? (
                <p className="mt-1.5 text-[11px] text-amber-600">
                  بدون پیوند حساب، فاکتور دوره بعد صادر نمی‌شود.
                </p>
              ) : null}
            </div>
          </div>

          {form.customer_kind === "person" ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="mb-3 text-sm font-bold text-slate-800">مشخصات مشتری</h2>
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">نام مشتری *</label>
                  <Input
                    value={form.person_name}
                    onChange={(event) => setField("person_name", event.target.value)}
                    placeholder="نام و نام خانوادگی"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">کد ملی</label>
                  <Input
                    value={form.national_code}
                    onChange={(event) => setField("national_code", event.target.value)}
                    inputMode="numeric"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">موبایل</label>
                  <Input
                    value={form.mobile}
                    onChange={(event) => setField("mobile", event.target.value)}
                    inputMode="tel"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">ایمیل</label>
                  <Input
                    value={form.email}
                    onChange={(event) => setField("email", event.target.value)}
                    type="email"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="mb-3 text-sm font-bold text-slate-800">مشخصات شرکت</h2>
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-500">نام شرکت *</label>
                    <Input
                      value={form.company_name}
                      onChange={(event) => setField("company_name", event.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-500">شناسه ملی / کد اقتصادی</label>
                    <Input
                      value={form.company_economic_code}
                      onChange={(event) => setField("company_economic_code", event.target.value)}
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-500">شماره ثبت</label>
                    <Input
                      value={form.company_reg_number}
                      onChange={(event) => setField("company_reg_number", event.target.value)}
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-500">تلفن شرکت</label>
                    <Input
                      value={form.company_phone}
                      onChange={(event) => setField("company_phone", event.target.value)}
                      dir="ltr"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1.5 block text-xs font-medium text-slate-500">آدرس</label>
                    <Input
                      value={form.company_address}
                      onChange={(event) => setField("company_address", event.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5 ring-1 ring-indigo-100">
                <h2 className="mb-3 text-sm font-bold text-slate-800">نماینده شرکت (تشخیص صرف‌شده)</h2>
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-500">نام نماینده *</label>
                    <Input
                      value={form.rep_name}
                      onChange={(event) => setField("rep_name", event.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-500">موبایل نماینده *</label>
                    <Input
                      value={form.rep_mobile}
                      onChange={(event) => setField("rep_mobile", event.target.value)}
                      inputMode="tel"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-500">ایمیل نماینده *</label>
                    <Input
                      value={form.rep_email}
                      onChange={(event) => setField("rep_email", event.target.value)}
                      type="email"
                      dir="ltr"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-bold text-slate-800">پلن و مشخصات سرور</h2>
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">پلن درخواستی</label>
                <Input
                  value={form.plan_name}
                  onChange={(event) => setField("plan_name", event.target.value)}
                  placeholder="مثلاً EPYC 32GB / Dual 1TB"
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-slate-500">مشخصات سرور (سخت‌افزار، موقعیت، پهنای‌باند)</label>
                <textarea
                  value={form.server_specs}
                  onChange={(event) => setField("server_specs", event.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>
              <div className="md:col-span-3">
                <label className="mb-1.5 block text-xs font-medium text-slate-500">
                  خدمات توافقی (نصب، مهاجرت، مانیتورینگ و…) و مبلغ دریافتی بابت آن
                </label>
                <textarea
                  value={form.services}
                  onChange={(event) => setField("services", event.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
                  placeholder="مثلاً: نصب و راه‌اندازی شامل پرداخت ۲۰۰٬۰۰۰ تومان"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-bold text-slate-800">مبلغ و دوره پرداخت</h2>
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">قیمت اعلام‌شده (تومان) *</label>
                <MoneyInput value={form.price} onChange={(next) => setField("price", next)} placeholder="0" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">تخفیف (تومان)</label>
                <MoneyInput value={form.discount} onChange={(next) => setField("discount", next)} placeholder="0" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">مبلغ خالص دوره</label>
                <div className="flex h-11 items-center rounded-xl bg-slate-50 px-3.5 text-sm font-semibold text-slate-900 ring-1 ring-slate-100">
                  <span dir="ltr">{money(formNet)}</span>
                  <span className="mr-1.5 text-[10px] font-normal text-slate-400">تومان</span>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">ارزش افزوده (٪)</label>
                <MoneyInput value={form.vat_percent} onChange={(next) => setField("vat_percent", next)} placeholder="10" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">مبلغ ارزش افزوده</label>
                <div className="flex h-11 items-center rounded-xl bg-slate-50 px-3.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-100">
                  <span dir="ltr">{money(formVat)}</span>
                  <span className="mr-1.5 text-[10px] font-normal text-slate-400">تومان</span>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">مبلغ کل قابل پرداخت</label>
                <div className="flex h-11 items-center rounded-xl bg-emerald-50 px-3.5 text-sm font-bold text-emerald-800 ring-1 ring-emerald-100">
                  <span dir="ltr">{money(formTotal)}</span>
                  <span className="mr-1.5 text-[10px] font-normal text-emerald-600">تومان</span>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">دریافت‌شده تاکنون</label>
                <MoneyInput value={form.paid_amount} onChange={(next) => setField("paid_amount", next)} placeholder="0" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">تاریخ آخرین دریافت</label>
                <JalaliDateInput value={form.paid_at} onChange={(iso) => setField("paid_at", iso)} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">یادداشت پرداخت</label>
                <Input
                  value={form.payment_note}
                  onChange={(event) => setField("payment_note", event.target.value)}
                  placeholder="کارت‌به‌کارت / نقدی"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">دوره فاکتور بعدی</label>
                <select
                  value={form.billing_cycle}
                  onChange={(event) => setField("billing_cycle", event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                >
                  {(meta?.cycles ?? [{ value: "monthly", label: "ماهانه" }]).map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">تاریخ شروع (شمسی)</label>
                <JalaliDateInput value={form.start_date} onChange={(iso) => setField("start_date", iso)} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">
                  سررسید دوره بعد (شمسی) — فاکتور ۱ هفته قبل صادر می‌شود
                </label>
                <JalaliDateInput
                  value={form.next_billing_date}
                  onChange={(iso) => setField("next_billing_date", iso)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">چند روز قبل صادر شود</label>
                <MoneyInput
                  value={form.invoice_lead_days}
                  onChange={(next) => setField("invoice_lead_days", next)}
                  placeholder="7"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">وضعیت</label>
                <select
                  value={form.status}
                  onChange={(event) => setField("status", event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                >
                  {(meta?.statuses ?? []).map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-slate-500">توضیحات</label>
                <textarea
                  value={form.notes}
                  onChange={(event) => setField("notes", event.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setTab("list")}>
              انصراف
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {editing ? "ذخیره تغییرات" : "ثبت سرور اختصاصی"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
