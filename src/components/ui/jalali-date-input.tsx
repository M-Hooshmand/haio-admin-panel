"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarDays } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  formatJalali,
  isoToJalaliText,
  jalaliTextToIso,
  normalizeDigits,
  todayIso,
} from "@/lib/jalali"

interface JalaliDateInputProps {
  /** Gregorian ISO date ("YYYY-MM-DD") or null. */
  value: string | null
  onChange: (iso: string | null) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

/**
 * A date field that accepts and displays the Persian (Jalali) calendar while
 * the API keeps receiving Gregorian ISO dates.
 */
export function JalaliDateInput({
  value,
  onChange,
  placeholder = "۱۴۰۵/۰۸/۱۸",
  disabled,
  className,
}: JalaliDateInputProps) {
  const [text, setText] = useState(() => isoToJalaliText(value))
  const [focused, setFocused] = useState(false)

  // Keep the field in sync when the form is opened for another record.
  useEffect(() => {
    if (focused) return
    setText(isoToJalaliText(value))
  }, [value, focused])

  const preview = useMemo(() => {
    const iso = jalaliTextToIso(text)
    return iso ? formatJalali(iso) : ""
  }, [text])

  const commit = (next: string) => {
    setText(next)
    onChange(jalaliTextToIso(next))
  }

  return (
    <div className={cn("space-y-1", className)}>
      <div className="relative">
        <Input
          dir="ltr"
          inputMode="numeric"
          value={text}
          disabled={disabled}
          placeholder={placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false)
            const iso = jalaliTextToIso(text)
            if (iso) setText(isoToJalaliText(iso))
          }}
          onChange={(event) => {
            const next = normalizeDigits(event.target.value).replace(/[^\d/]/g, "")
            commit(next.slice(0, 10))
          }}
          className="pl-9"
        />
        <CalendarDays className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-300" />
      </div>
      <div className="flex items-center justify-between gap-2 text-[10px]">
        <span className={cn("text-slate-400", !preview && "text-slate-300")}>
          {preview || "تاریخ شمسی، مثلاً ۱۴۰۵/۰۸/۱۸"}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="text-indigo-600 hover:text-indigo-700"
            onClick={() => {
              const iso = todayIso()
              setText(isoToJalaliText(iso))
              onChange(iso)
            }}
          >
            امروز
          </button>
          {text ? (
            <button
              type="button"
              className="text-slate-400 hover:text-rose-600"
              onClick={() => {
                setText("")
                onChange(null)
              }}
            >
              پاک‌کردن
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
