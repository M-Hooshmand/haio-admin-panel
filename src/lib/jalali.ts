// Minimal, dependency-free Jalali (Solar Hijri) ⇆ Gregorian conversion.
// Algorithm from jalaali-js (MIT) — accurate for the 1200–1500 Jalali range.

const GREGORIAN_DAYS_IN_MONTH = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]

export const JALALI_MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
]

function div(a: number, b: number): number {
  return Math.trunc(a / b)
}

export function toJalali(gy: number, gm: number, gd: number): [number, number, number] {
  let jy = gy <= 1600 ? 0 : 979
  let year = gy
  year -= gy <= 1600 ? 621 : 1600
  const gy2 = gm > 2 ? year + 1 : year
  let days =
    365 * year +
    div(gy2 + 3, 4) -
    div(gy2 + 99, 100) +
    div(gy2 + 399, 400) -
    80 +
    gd +
    GREGORIAN_DAYS_IN_MONTH[gm - 1]
  jy += 33 * div(days, 12053)
  days %= 12053
  jy += 4 * div(days, 1461)
  days %= 1461
  if (days > 365) {
    jy += div(days - 1, 365)
    days = (days - 1) % 365
  }
  const jm = days < 186 ? 1 + div(days, 31) : 7 + div(days - 186, 30)
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30)
  return [jy, jm, jd]
}

export function toGregorian(jy: number, jm: number, jd: number): [number, number, number] {
  let gy = jy <= 979 ? 621 : 1600
  let year = jy
  year -= jy <= 979 ? 0 : 979
  let days =
    365 * year +
    div(year, 33) * 8 +
    div((year % 33) + 3, 4) +
    78 +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186)
  gy += 400 * div(days, 146097)
  days %= 146097
  if (days > 36524) {
    gy += 100 * div(--days, 36524)
    days %= 36524
    if (days >= 365) days++
  }
  gy += 4 * div(days, 1461)
  days %= 1461
  if (days > 365) {
    gy += div(days - 1, 365)
    days = (days - 1) % 365
  }
  let gd = days + 1
  const leap = (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0
  const monthLengths = [0, 31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  let gm = 1
  for (gm = 1; gm <= 12; gm++) {
    if (gd <= monthLengths[gm]) break
    gd -= monthLengths[gm]
  }
  return [gy, gm, gd]
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/

/** "2026-11-09" (or a full ISO timestamp) → "۱۸ آبان ۱۴۰۵". */
export function formatJalali(value?: string | null): string {
  if (!value) return "—"
  const match = ISO_DATE.exec(value)
  if (!match) return "—"
  const [jy, jm, jd] = toJalali(Number(match[1]), Number(match[2]), Number(match[3]))
  return `${jdn(jd)} ${JALALI_MONTHS[jm - 1]} ${jdn(jy)}`
}

/** "2026-11-09" → "۱۴۰۵/۰۸/۱۸" for compact cells. */
export function formatJalaliShort(value?: string | null): string {
  if (!value) return "—"
  const match = ISO_DATE.exec(value)
  if (!match) return "—"
  const [jy, jm, jd] = toJalali(Number(match[1]), Number(match[2]), Number(match[3]))
  return `${jdn(jy)}/${jdn(jm, 2)}/${jdn(jd, 2)}`
}

/**
 * Gregorian ISO → Jalali text for an editable input ("1405/08/18").
 * ASCII digits keep the caret stable while typing.
 */
export function isoToJalaliText(iso?: string | null): string {
  if (!iso) return ""
  const match = ISO_DATE.exec(iso)
  if (!match) return ""
  const [jy, jm, jd] = toJalali(Number(match[1]), Number(match[2]), Number(match[3]))
  return `${jy}/${pad2(jm)}/${pad2(jd)}`
}

/** "1405/08/18" → "2026-11-09"; returns null when the date is not valid. */
export function jalaliTextToIso(text: string): string | null {
  const parts = normalizeDigits(text)
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
  if (parts.length !== 3) return null
  const [jy, jm, jd] = parts.map((part) => Number(part))
  if (!Number.isFinite(jy) || !Number.isFinite(jm) || !Number.isFinite(jd)) return null
  if (jy < 1200 || jy > 1600 || jm < 1 || jm > 12 || jd < 1 || jd > 31) return null
  const [gy, gm, gd] = toGregorian(jy, jm, jd)
  const [jy2, jm2, jd2] = toJalali(gy, gm, gd)
  if (jy2 !== jy || jm2 !== jm || jd2 !== jd) return null
  return `${gy}-${pad2(gm)}-${pad2(gd)}`
}

export function todayIso(): string {
  const now = new Date()
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
}

export function normalizeDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
}

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value)
}

function jdn(value: number, minWidth = 1): string {
  return value.toLocaleString("fa-IR", { minimumIntegerDigits: minWidth, useGrouping: false })
}
