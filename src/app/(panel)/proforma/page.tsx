"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Calculator,
  CheckCircle2,
  FileText,
  History,
  Loader2,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type Tab = "list" | "form" | "logs"

interface ItemForm {
  title: string
  subtitle: string
  quantity: string
  unit_price: string
}

interface InvoiceItem extends ItemForm {
  id: string
  row: number
  total: number
  quantity_display: string
  unit_price_display: string
  total_display: string
}

interface Invoice {
  id: string
  number: string
  title: string
  issued_at: string
  issued_at_jalali: string
  status: "draft" | "issued" | "canceled"
  status_display: string
  buyer_name: string
  buyer_org: string
  buyer_phone: string
  buyer_econ: string
  buyer_address: string
  buyer_postal: string
  seller_name: string
  seller_brand: string
  seller_national_id: string
  seller_phone: string
  seller_address: string
  seller_econ: string
  seller_bank: string
  seller_sheba: string
  tax_percent: string
  subtotal: number
  subtotal_display: string
  tax_amount: number
  tax_amount_display: string
  total: number
  total_display: string
  notes: string
  created_by_name?: string
  created_at: string
  items: InvoiceItem[]
}

interface Meta {
  next_number: string
  today: string
  today_jalali: string
  tax_percent: string
  seller: {
    name: string
    brand: string
    national_id: string
    phone: string
    address: string
    econ: string
    bank: string
    sheba: string
  }
}

interface LogRow {
  id: number
  action: string
  number: string
  detail: Record<string, unknown>
  ip: string
  created_at: string
  user_name: string
}

const STATUS_LABELS: Record<string, string> = {
  draft: "پیش‌نویس",
  issued: "صادر شده",
  canceled: "لغو شده",
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-amber-50 text-amber-700 ring-amber-200",
  issued: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  canceled: "bg-slate-100 text-slate-600 ring-slate-200",
}

const ACTION_LABELS: Record<string, string> = {
  create: "صدور",
  update: "ویرایش",
  delete: "حذف",
  print: "خروجی / چاپ",
}

const emptyItem = (): ItemForm => ({
  title: "",
  subtitle: "",
  quantity: "1",
  unit_price: "",
})

function money(value: number | string): string {
  const number = Number(value || 0)
  return new Intl.NumberFormat("fa-IR").format(Number.isFinite(number) ? number : 0)
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

export default function ProformaPage() {
  const [tab, setTab] = useState<Tab>("list")
  const [meta, setMeta] = useState<Meta | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [loadingList, setLoadingList] = useState(false)

  const [editing, setEditing] = useState<Invoice | null>(null)
  const [number, setNumber] = useState("")
  const [issuedDate, setIssuedDate] = useState("")
  const [status, setStatus] = useState("issued")
  const [buyerName, setBuyerName] = useState("")
  const [buyerOrg, setBuyerOrg] = useState("")
  const [buyerPhone, setBuyerPhone] = useState("")
  const [buyerEcon, setBuyerEcon] = useState("")
  const [buyerAddress, setBuyerAddress] = useState("")
  const [buyerPostal, setBuyerPostal] = useState("")
  const [taxPercent, setTaxPercent] = useState("10")
  const [notes, setNotes] = useState("")
  const [items, setItems] = useState<ItemForm[]>([emptyItem()])

  const [saving, setSaving] = useState(false)
  const [printingId, setPrintingId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null)

  const [logs, setLogs] = useState<LogRow[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)

  const totals = useMemo(() => {
    const subtotal = items.reduce(
      (sum, item) => sum + Math.round(Number(item.quantity || 0) * Number(item.unit_price || 0)),
      0,
    )
    const tax = Math.round((subtotal * Number(taxPercent || 0)) / 100)
    return { subtotal, tax, total: subtotal + tax }
  }, [items, taxPercent])

  const loadMeta = useCallback(async () => {
    try {
      const { data } = await api.get<Meta>("/panel/proforma/meta/")
      setMeta(data)
      setNumber((current) => current || data.next_number)
      setIssuedDate((current) => current || data.today_jalali)
      setTaxPercent((current) => (current === "10" ? data.tax_percent : current))
    } catch (error) {
      setMessage({ kind: "error", text: extractError(error) })
    }
  }, [])

  const loadList = useCallback(async () => {
    setLoadingList(true)
    try {
      const { data } = await api.get<{ count: number; results: Invoice[] }>("/panel/proforma/", {
        params: { page, page_size: 20, search: search || undefined, status: statusFilter || undefined },
      })
      setInvoices(data.results)
      setCount(data.count)
    } catch (error) {
      setMessage({ kind: "error", text: extractError(error) })
    } finally {
      setLoadingList(false)
    }
  }, [page, search, statusFilter])

  const loadLogs = useCallback(async () => {
    setLoadingLogs(true)
    try {
      const { data } = await api.get<{ results: LogRow[] }>("/panel/proforma/logs/", {
        params: { limit: 200 },
      })
      setLogs(data.results)
    } catch (error) {
      setMessage({ kind: "error", text: extractError(error) })
    } finally {
      setLoadingLogs(false)
    }
  }, [])

  useEffect(() => {
    void loadMeta()
  }, [loadMeta])

  useEffect(() => {
    void loadList()
  }, [loadList])

  useEffect(() => {
    if (tab === "logs") void loadLogs()
  }, [tab, loadLogs])

  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(null), 5000)
    return () => clearTimeout(timer)
  }, [message])

  function resetForm() {
    setEditing(null)
    setNumber(meta?.next_number ?? "")
    setIssuedDate(meta?.today_jalali ?? "")
    setStatus("issued")
    setBuyerName("")
    setBuyerOrg("")
    setBuyerPhone("")
    setBuyerEcon("")
    setBuyerAddress("")
    setBuyerPostal("")
    setTaxPercent(meta?.tax_percent ?? "10")
    setNotes("")
    setItems([emptyItem()])
  }

  function startCreate() {
    resetForm()
    setMessage(null)
    setTab("form")
  }

  function startEdit(invoice: Invoice) {
    setEditing(invoice)
    setNumber(invoice.number)
    setIssuedDate(invoice.issued_at_jalali)
    setStatus(invoice.status)
    setBuyerName(invoice.buyer_name)
    setBuyerOrg(invoice.buyer_org)
    setBuyerPhone(invoice.buyer_phone)
    setBuyerEcon(invoice.buyer_econ)
    setBuyerAddress(invoice.buyer_address)
    setBuyerPostal(invoice.buyer_postal)
    setTaxPercent(String(Number(invoice.tax_percent)))
    setNotes(invoice.notes)
    setItems(
      invoice.items.map((item) => ({
        title: item.title,
        subtitle: item.subtitle,
        quantity: String(Number(item.quantity)),
        unit_price: String(item.unit_price),
      })),
    )
    setMessage(null)
    setTab("form")
  }

  function updateItem(index: number, patch: Partial<ItemForm>) {
    setItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    )
  }

  function removeItem(index: number) {
    setItems((current) => (current.length === 1 ? [emptyItem()] : current.filter((_, i) => i !== index)))
  }

  async function save() {
    if (!buyerName.trim()) {
      setMessage({ kind: "error", text: "نام خریدار را وارد کنید." })
      return
    }
    if (items.some((item) => !item.title.trim())) {
      setMessage({ kind: "error", text: "شرح همه ردیف‌ها را وارد کنید." })
      return
    }
    setSaving(true)
    setMessage(null)
    const payload = {
      number: number.trim() || undefined,
      issued_at: editing ? editing.issued_at : undefined,
      status,
      buyer_name: buyerName,
      buyer_org: buyerOrg,
      buyer_phone: buyerPhone,
      buyer_econ: buyerEcon,
      buyer_address: buyerAddress,
      buyer_postal: buyerPostal,
      tax_percent: taxPercent,
      notes,
      items: items.map((item) => ({
        title: item.title,
        subtitle: item.subtitle,
        quantity: item.quantity || "0",
        unit_price: Number(item.unit_price || 0),
      })),
    }
    try {
      if (editing) {
        await api.patch(`/panel/proforma/${editing.id}/`, payload)
        setMessage({ kind: "ok", text: "پیش‌فاکتور ویرایش شد." })
      } else {
        await api.post("/panel/proforma/", payload)
        setMessage({ kind: "ok", text: "پیش‌فاکتور صادر شد." })
        resetForm()
      }
      setTab("list")
      setPage(1)
      await loadList()
    } catch (error) {
      setMessage({ kind: "error", text: extractError(error) })
    } finally {
      setSaving(false)
    }
  }

  async function printInvoice(id: string) {
    setPrintingId(id)
    try {
      const response = await api.get(`/panel/proforma/${id}/print/`, { responseType: "blob" })
      const url = URL.createObjectURL(response.data as Blob)
      const win = window.open(url, "_blank")
      if (!win) {
        setMessage({ kind: "error", text: "مرورگر پنجره چاپ را مسدود کرد." })
      }
      setTimeout(() => URL.revokeObjectURL(url), 120_000)
    } catch (error) {
      setMessage({ kind: "error", text: extractError(error) })
    } finally {
      setPrintingId(null)
    }
  }

  async function removeInvoice(invoice: Invoice) {
    if (!window.confirm(`پیش‌فاکتور ${invoice.number} حذف شود؟`)) return
    try {
      await api.delete(`/panel/proforma/${invoice.id}/`)
      setMessage({ kind: "ok", text: "پیش‌فاکتور حذف شد." })
      await loadList()
    } catch (error) {
      setMessage({ kind: "error", text: extractError(error) })
    }
  }

  const pages = Math.max(1, Math.ceil(count / 20))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">صدور پیش‌فاکتور</h1>
          <p className="text-sm text-slate-500">ساخت، ویرایش و خروجی PDF پیش‌فاکتور رسمی</p>
        </div>
        <Button onClick={startCreate}>
          <Plus className="h-4 w-4" />
          پیش‌فاکتور جدید
        </Button>
      </div>

      {message && (
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
      )}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["list", "فهرست پیش‌فاکتورها", FileText],
            ["form", editing ? "ویرایش پیش‌فاکتور" : "صدور پیش‌فاکتور", Calculator],
            ["logs", "لاگ صدور", History],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
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
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                placeholder="جست‌وجو بر اساس شماره، خریدار یا سازمان"
                className="pr-9"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value)
                setPage(1)
              }}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">همه وضعیت‌ها</option>
              <option value="issued">صادر شده</option>
              <option value="draft">پیش‌نویس</option>
              <option value="canceled">لغو شده</option>
            </select>
            <Button variant="outline" onClick={() => void loadList()}>
              <RefreshCw className={cn("h-4 w-4", loadingList && "animate-spin")} />
              به‌روزرسانی
            </Button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">شماره</th>
                  <th className="px-4 py-3 font-medium">تاریخ</th>
                  <th className="px-4 py-3 font-medium">خریدار</th>
                  <th className="px-4 py-3 font-medium">مبلغ کل</th>
                  <th className="px-4 py-3 font-medium">وضعیت</th>
                  <th className="px-4 py-3 font-medium">صادرکننده</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-800" dir="ltr">
                      {invoice.number}
                    </td>
                    <td className="num px-4 py-3 text-slate-600">{invoice.issued_at_jalali}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800">{invoice.buyer_name}</div>
                      {invoice.buyer_org && <div className="text-xs text-slate-500">{invoice.buyer_org}</div>}
                    </td>
                    <td className="num px-4 py-3 font-semibold text-slate-800">
                      {invoice.total_display}
                      <span className="mr-1 text-[10px] font-normal text-slate-400">تومان</span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
                          STATUS_STYLES[invoice.status],
                        )}
                      >
                        {STATUS_LABELS[invoice.status] ?? invoice.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{invoice.created_by_name || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => void printInvoice(invoice.id)}
                          disabled={printingId === invoice.id}
                          className="rounded-lg p-2 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
                          title="خروجی PDF"
                        >
                          {printingId === invoice.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Printer className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => startEdit(invoice)}
                          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                          title="ویرایش"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => void removeInvoice(invoice)}
                          className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                          title="حذف"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!invoices.length && !loadingList && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">
                      هنوز پیش‌فاکتوری صادر نشده است.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>
              {count.toLocaleString("fa-IR")} پیش‌فاکتور — صفحه {page} از {pages.toLocaleString("fa-IR")}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                قبلی
              </Button>
              <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                بعدی
              </Button>
            </div>
          </div>
        </div>
      )}

      {tab === "form" && (
        <div className="space-y-4">
          <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">شماره پیش‌فاکتور</label>
              <Input value={number} onChange={(event) => setNumber(event.target.value)} dir="ltr" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">تاریخ</label>
              <Input value={issuedDate} readOnly className="num bg-slate-50" dir="ltr" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">وضعیت</label>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="issued">صادر شده</option>
                <option value="draft">پیش‌نویس</option>
                <option value="canceled">لغو شده</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">درصد مالیات</label>
              <Input
                value={taxPercent}
                onChange={(event) => setTaxPercent(event.target.value)}
                inputMode="decimal"
                dir="ltr"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-bold text-slate-800">اطلاعات خریدار</h2>
            <div className="grid gap-3 md:grid-cols-3">
              <Input placeholder="نام خریدار *" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} />
              <Input placeholder="نام سازمان / شرکت" value={buyerOrg} onChange={(e) => setBuyerOrg(e.target.value)} />
              <Input placeholder="تلفن" value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value)} dir="ltr" />
              <Input
                placeholder="شماره اقتصادی / شناسه ملی"
                value={buyerEcon}
                onChange={(e) => setBuyerEcon(e.target.value)}
                dir="ltr"
              />
              <Input placeholder="کد پستی" value={buyerPostal} onChange={(e) => setBuyerPostal(e.target.value)} dir="ltr" />
              <Input placeholder="آدرس" value={buyerAddress} onChange={(e) => setBuyerAddress(e.target.value)} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800">ردیف‌های پیش‌فاکتور</h2>
              <Button variant="outline" size="sm" onClick={() => setItems((current) => [...current, emptyItem()])}>
                <Plus className="h-4 w-4" />
                ردیف جدید
              </Button>
            </div>
            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="grid gap-2 rounded-xl bg-slate-50 p-3 md:grid-cols-12">
                  <div className="md:col-span-4">
                    <Input
                      placeholder="شرح خدمت یا محصول *"
                      value={item.title}
                      onChange={(e) => updateItem(index, { title: e.target.value })}
                    />
                    <Input
                      placeholder="توضیح تکمیلی (اختیاری)"
                      value={item.subtitle}
                      onChange={(e) => updateItem(index, { subtitle: e.target.value })}
                      className="mt-2"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Input
                      placeholder="تعداد"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, { quantity: e.target.value })}
                      inputMode="decimal"
                      dir="ltr"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <Input
                      placeholder="قیمت واحد (تومان)"
                      value={item.unit_price}
                      onChange={(e) => updateItem(index, { unit_price: e.target.value })}
                      inputMode="numeric"
                      dir="ltr"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 md:col-span-3">
                    <span className="num text-sm font-semibold text-slate-700">
                      {money(Number(item.quantity || 0) * Number(item.unit_price || 0))}
                      <span className="mr-1 text-[10px] font-normal text-slate-400">تومان</span>
                    </span>
                    <button
                      onClick={() => removeItem(index)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      title="حذف ردیف"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <label className="mb-1.5 block text-xs font-medium text-slate-500">توضیحات</label>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={5}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="توضیحات تکمیلی پیش‌فاکتور…"
              />
            </div>
            <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-5 text-sm">
              <div className="flex items-center justify-between text-slate-600">
                <span>جمع کل</span>
                <span className="num font-semibold">{money(totals.subtotal)} تومان</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>مالیات ({money(taxPercent)}٪)</span>
                <span className="num font-semibold">{money(totals.tax)} تومان</span>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-dashed border-slate-200 pt-3 text-base font-bold text-slate-900">
                <span>مبلغ قابل پرداخت</span>
                <span className="num">{money(totals.total)} تومان</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setTab("list")}>
              انصراف
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {editing ? "ذخیره تغییرات" : "ثبت و صدور پیش‌فاکتور"}
            </Button>
          </div>
        </div>
      )}

      {tab === "logs" && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-bold text-slate-800">لاگ صدور پیش‌فاکتور</h2>
            <Button variant="outline" size="sm" onClick={() => void loadLogs()}>
              <RefreshCw className={cn("h-4 w-4", loadingLogs && "animate-spin")} />
              به‌روزرسانی
            </Button>
          </div>
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">زمان</th>
                <th className="px-4 py-3 font-medium">کاربر</th>
                <th className="px-4 py-3 font-medium">عملیات</th>
                <th className="px-4 py-3 font-medium">شماره</th>
                <th className="px-4 py-3 font-medium">مبلغ</th>
                <th className="px-4 py-3 font-medium">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((row) => (
                <tr key={row.id}>
                  <td className="num px-4 py-3 text-xs text-slate-500">
                    {new Date(row.created_at).toLocaleString("fa-IR")}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.user_name || "—"}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                      {ACTION_LABELS[row.action] ?? row.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs" dir="ltr">
                    {row.number || "—"}
                  </td>
                  <td className="num px-4 py-3 text-slate-700">
                    {typeof row.detail?.total === "number" ? money(row.detail.total as number) : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400" dir="ltr">
                    {row.ip || "—"}
                  </td>
                </tr>
              ))}
              {!logs.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-400">
                    لاگی ثبت نشده است.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
