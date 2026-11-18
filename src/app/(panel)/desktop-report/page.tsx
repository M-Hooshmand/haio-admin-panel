"use client"

import { Monitor } from "lucide-react"
import { ProductReportPage, type ProductReportConfig } from "@/components/product-report"

const CONFIG: ProductReportConfig = {
  product: "desktop",
  title: "دسکتاپ مجازی",
  subtitle:
    "همهٔ دسکتاپ‌های مجازی خریداری‌شده: مشتری، سازمان، پلن رایگان یا پولی، وضعیت، دوره و میزبان — با جست‌وجو، فیلتر و مدیریت پلن‌ها",
  icon: Monitor,
  sitesPath: "/staff/desktops/report/",
  summaryPath: "/staff/desktops/summary/",
  plansPath: "/staff/desktops/plans/",
  entityName: "دسکتاپ",
  trialFilter: true,
  identifier: {
    label: "میزبان / شناسه دسکتاپ",
    value: (row) => String(row.host || row.slug || ""),
  },
  details: [
    { key: "slug", label: "شناسه دسکتاپ", kind: "mono" },
    { key: "is_trial", label: "پلن رایگان (آزمایشی)", kind: "bool" },
    { key: "trial_ends_at", label: "پایان دورهٔ رایگان", kind: "date-time" },
    { key: "template_id", label: "قالب دسکتاپ", kind: "mono" },
    { key: "version", label: "نسخه", kind: "mono" },
    { key: "host", label: "Host", kind: "mono" },
    { key: "plan_seats", label: "تعداد صندلی پلن", kind: "number" },
    { key: "assigned_username", label: "کاربر تخصیص‌یافته", kind: "mono" },
    { key: "created_by_username", label: "ثبت‌شده توسط", kind: "mono" },
    { key: "provisioned_at", label: "زمان راه‌اندازی", kind: "date-time" },
    { key: "last_error", label: "آخرین خطا" },
  ],
  planFields: [
    { key: "slug", label: "شناسه (slug)", type: "text", required: true, mono: true, placeholder: "desktop-pro-2" },
    { key: "name", label: "نام پلن", type: "text", required: true, placeholder: "دسکتاپ مجازی حرفه‌ای" },
    { key: "description", label: "توضیحات", type: "textarea", placeholder: "توضیح کوتاه برای صفحهٔ خرید" },
    { key: "price_monthly", label: "قیمت ماهانه (تومان)", type: "number", required: true },
    { key: "price_annual", label: "قیمت سالانه (تومان)", type: "number", required: true, help: "معمولاً ۱۰ برابر ماهانه" },
    { key: "vcpu", label: "vCPU", type: "number" },
    { key: "memory_mib", label: "حافظه (MiB)", type: "number" },
    { key: "disk_gib", label: "دیسک (GiB)", type: "number" },
    { key: "snapshots", label: "تعداد اسنپ‌شات", type: "number" },
    { key: "seats", label: "تعداد صندلی", type: "number" },
    { key: "ingress_mbps", label: "Ingress (Mbps)", type: "number" },
    { key: "egress_mbps", label: "Egress (Mbps)", type: "number" },
    { key: "trial_minutes", label: "دقیقه‌های آزمایشی", type: "number", help: "برای پلن رایگان (آزمایشی)" },
    { key: "sort_order", label: "ترتیب نمایش", type: "number" },
    { key: "is_trial", label: "پلن رایگان (آزمایشی)", type: "checkbox", help: "فعال" },
    { key: "is_active", label: "فعال برای فروش", type: "checkbox", help: "فعال" },
  ],
  planDefaults: {
    slug: "",
    name: "",
    description: "",
    price_monthly: 0,
    price_annual: 0,
    vcpu: 2,
    memory_mib: 4096,
    disk_gib: 40,
    snapshots: 1,
    seats: 1,
    ingress_mbps: 15,
    egress_mbps: 50,
    trial_minutes: 0,
    sort_order: 0,
    is_trial: false,
    is_active: true,
  },
  planNote:
    "پلن رایگان (آزمایشی) در کاتالوگ عمومی نمایش داده نمی‌شود و هر کاربر فقط یک دسکتاپ رایگان می‌تواند بگیرد.",
}

export default function DesktopReportPage() {
  return <ProductReportPage config={CONFIG} />
}
