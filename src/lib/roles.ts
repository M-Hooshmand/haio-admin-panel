export type BackendRole =
  | "CUSTOMER"
  | "SUPPORT_AGENT"
  | "SUPPORT_MANAGER"
  | "ADMIN"
  | "SUPER_ADMIN"
  | "MANAGER"
  | "OFFICE"
  | "SALES"
  | "FINANCE"
  | "TECHNICAL"

export type PanelRole = "MANAGER" | "OFFICE" | "SALES" | "FINANCE" | "TECHNICAL"

export const PANEL_ROLE_LABELS: Record<PanelRole, string> = {
  MANAGER: "مدیر",
  OFFICE: "کارمند اداری",
  SALES: "کارمند فروش",
  FINANCE: "کارمند مالی",
  TECHNICAL: "بخش فنی",
}

/**
 * Backend is the source of truth for permissions. This mapping only decides
 * which shell/navigation a staff member sees, and will be replaced once the
 * backend exposes the five business roles directly.
 */
export function resolvePanelRole(role?: string | null): PanelRole | null {
  switch (role) {
    case "SUPER_ADMIN":
    case "ADMIN":
    case "MANAGER":
      return "MANAGER"
    case "SUPPORT_MANAGER":
    case "OFFICE":
      return "OFFICE"
    case "SALES":
      return "SALES"
    case "FINANCE":
      return "FINANCE"
    case "SUPPORT_AGENT":
    case "TECHNICAL":
      return "TECHNICAL"
    default:
      return null
  }
}

export interface PanelUser {
  id: number
  username?: string | null
  email?: string | null
  mobile?: string | null
  first_name?: string
  last_name?: string
  display_name?: string
  role?: BackendRole | string
  panel_role?: PanelRole | null
  panel_role_label?: string
  panel_sections?: string[]
  is_active?: boolean
  last_login?: string | null
  created_at?: string
}

export interface NavItem {
  key: string
  href: string
  title: string
  description: string
  roles: PanelRole[]
}

export const NAV_ITEMS: NavItem[] = [
  {
    key: "dashboard",
    href: "/dashboard",
    title: "داشبورد",
    description: "نمای کلی وضعیت پلتفرم",
    roles: ["MANAGER", "OFFICE", "SALES", "FINANCE", "TECHNICAL"],
  },
  {
    key: "users",
    href: "/users",
    title: "کاربران",
    description: "جست‌وجو و مدیریت حساب‌های کاربری",
    roles: ["MANAGER", "OFFICE", "SALES", "FINANCE"],
  },
  {
    key: "organizations",
    href: "/organizations",
    title: "سازمان‌ها",
    description: "سازمان‌ها، اعضا و کیف پول",
    roles: ["MANAGER", "OFFICE", "FINANCE"],
  },
  {
    key: "subscriptions",
    href: "/subscriptions",
    title: "اشتراک‌ها",
    description: "پلن‌ها و وضعیت اشتراک مشتریان",
    roles: ["MANAGER", "OFFICE", "SALES"],
  },
  {
    key: "invoices",
    href: "/invoices",
    title: "فاکتورها",
    description: "فاکتورها، پرداخت‌ها و refund",
    roles: ["MANAGER", "FINANCE"],
  },
  {
    key: "proforma",
    href: "/proforma",
    title: "صدور پیش‌فاکتور",
    description: "ساخت و خروجی پیش‌فاکتور رسمی",
    roles: ["MANAGER", "FINANCE", "SALES"],
  },
  {
    key: "dedicated",
    href: "/dedicated",
    title: "سرورهای اختصاصی",
    description: "فروش سرور اختصاصی (برمتال) و فاکتور خودکار دوره بعدی",
    roles: ["MANAGER", "OFFICE", "SALES", "FINANCE"],
  },
  {
    key: "haioflash",
    href: "/haioflash",
    title: "هایوفلش",
    description: "ماشین‌های ابری و وضعیت نودها",
    roles: ["MANAGER", "TECHNICAL"],
  },
  {
    key: "haiogate",
    href: "/haiogate",
    title: "هایوگیت",
    description: "اکانت‌های تحریم‌شکن",
    roles: ["MANAGER", "TECHNICAL"],
  },
  {
    key: "monitoring",
    href: "/monitoring",
    title: "مونیتورینگ کاربران",
    description: "کاربران آنلاین و فعال امروز",
    roles: ["MANAGER", "OFFICE", "TECHNICAL"],
  },
  {
    key: "notifications",
    href: "/notifications",
    title: "گزارش اعلان‌ها",
    description: "تاریخچه ارسال ایمیل و پیامک برای همه محصولات",
    roles: ["MANAGER", "OFFICE", "TECHNICAL"],
  },
  {
    key: "wordpress_report",
    href: "/wordpress-report",
    title: "گزارش هاست مدیریت‌شده",
    description: "خرید، وضعیت و دامنهٔ هاست‌های وردپرس + مدیریت پلن‌ها",
    roles: ["MANAGER", "OFFICE", "SALES", "FINANCE", "TECHNICAL"],
  },
  {
    key: "android_cloud_report",
    href: "/android-cloud-report",
    title: "گزارش سرویس ابری اندروید",
    description: "دستگاه‌های ابری اندروید، دوره و پلن‌ها",
    roles: ["MANAGER", "OFFICE", "SALES", "FINANCE", "TECHNICAL"],
  },
  {
    key: "brain",
    href: "/brain",
    title: "مغز زیرساخت",
    description: "نمای زندهٔ شبکهٔ عصبی محصولات و ورکرها",
    roles: ["MANAGER", "TECHNICAL"],
  },
  {
    key: "assistant",
    href: "/assistant",
    title: "دستیار هوشمند",
    description: "اجرای درخواست‌ها با هوش مصنوعی",
    roles: ["MANAGER"],
  },
  {
    key: "tickets",
    href: "/tickets",
    title: "تیکت‌ها",
    description: "صف پشتیبانی و گفت‌وگو با مشتری",
    roles: ["MANAGER", "OFFICE", "TECHNICAL"],
  },
  {
    key: "campaigns",
    href: "/campaigns",
    title: "کمپین‌ها",
    description: "کمپین‌های رشد و پیام‌های گروهی",
    roles: ["MANAGER", "SALES"],
  },
  {
    key: "reports",
    href: "/reports",
    title: "گزارش‌ها",
    description: "گزارش فروش، مصرف و فعالیت",
    roles: ["MANAGER", "SALES", "FINANCE"],
  },
  {
    key: "settings",
    href: "/settings",
    title: "تنظیمات",
    description: "تنظیمات پنل و دسترسی‌ها",
    roles: ["MANAGER"],
  },
]

export function navItemsForRole(role: PanelRole | null): NavItem[] {
  if (!role) return []
  return NAV_ITEMS.filter((item) => item.roles.includes(role))
}

/** Server-provided sections win; the role mapping is only a fallback. */
export function navItemsForUser(user: PanelUser | null): NavItem[] {
  if (Array.isArray(user?.panel_sections)) {
    const allowed = new Set(user.panel_sections)
    return NAV_ITEMS.filter((item) => allowed.has(item.key))
  }
  return navItemsForRole(resolvePanelRole(user?.panel_role ?? user?.role))
}

export function canAccessUser(user: PanelUser | null, href: string): boolean {
  return navItemsForUser(user).some((item) => item.href === href)
}

export function canAccess(role: PanelRole | null, href: string): boolean {
  if (!role) return false
  const item = NAV_ITEMS.find((entry) => entry.href === href)
  return item ? item.roles.includes(role) : false
}
