"use client"

import { Smartphone } from "lucide-react"
import { ProductReportPage, type ProductReportConfig } from "@/components/product-report"

const CONFIG: ProductReportConfig = {
  product: "android_cloud",
  title: "گزارش سرویس ابری اندروید",
  subtitle:
    "همهٔ دستگاه‌های ابری اندروید خریداری‌شده: مشتری، سازمان، پلن، وضعیت، دوره، میزبان و کنسول — با فیلتر و مدیریت پلن‌ها",
  icon: Smartphone,
  sitesPath: "/staff/android-cloud/devices/",
  summaryPath: "/staff/android-cloud/summary/",
  plansPath: "/staff/android-cloud/plans/",
  entityName: "دستگاه",
  identifier: {
    label: "میزبان / شناسه دستگاه",
    value: (row) => String(row.host || row.slug || ""),
  },
  details: [
    { key: "slug", label: "شناسه دستگاه", kind: "mono" },
    { key: "device_profile", label: "پروفایل دستگاه", kind: "mono" },
    { key: "image_label", label: "تصویر اندروید" },
    { key: "api_level", label: "API Level", kind: "number" },
    { key: "android_version", label: "نسخه اندروید", kind: "mono" },
    { key: "host", label: "Host", kind: "mono" },
    { key: "console_host", label: "Console Host", kind: "mono" },
    { key: "used_device_seconds", label: "مصرف دوره (ثانیه)", kind: "number" },
    { key: "last_activity_at", label: "آخرین فعالیت", kind: "date-time" },
    { key: "assigned_username", label: "کاربر تخصیص‌یافته", kind: "mono" },
    { key: "created_by_username", label: "ثبت‌شده توسط", kind: "mono" },
    { key: "provisioned_at", label: "زمان راه‌اندازی", kind: "date-time" },
    { key: "last_error", label: "آخرین خطا" },
  ],
  planFields: [
    { key: "slug", label: "شناسه (slug)", type: "text", required: true, mono: true, placeholder: "android-pro-2" },
    { key: "name", label: "نام پلن", type: "text", required: true, placeholder: "سرویس ابری اندروید حرفه‌ای" },
    { key: "description", label: "توضیحات", type: "textarea", placeholder: "توضیح کوتاه برای صفحهٔ خرید" },
    { key: "price_monthly", label: "قیمت ماهانه (تومان)", type: "number", required: true },
    { key: "price_annual", label: "قیمت سالانه (تومان)", type: "number", required: true, help: "معمولاً ۱۰ برابر ماهانه" },
    { key: "vcpu", label: "vCPU", type: "number" },
    { key: "memory_mib", label: "حافظه (MiB)", type: "number" },
    { key: "disk_gib", label: "دیسک (GiB)", type: "number" },
    { key: "max_devices", label: "حداکثر دستگاه", type: "number" },
    { key: "max_parallel_sessions", label: "حداکثر نشست هم‌زمان", type: "number" },
    { key: "included_device_hours", label: "ساعت دستگاه در ماه", type: "number", help: "۰ = نامحدود" },
    { key: "ingress_mbps", label: "Ingress (Mbps)", type: "number" },
    { key: "egress_mbps", label: "Egress (Mbps)", type: "number" },
    { key: "sort_order", label: "ترتیب نمایش", type: "number" },
    { key: "includes_public_ip", label: "IP عمومی", type: "checkbox", help: "شامل می‌شود" },
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
    disk_gib: 32,
    max_devices: 1,
    max_parallel_sessions: 1,
    included_device_hours: 80,
    ingress_mbps: 15,
    egress_mbps: 50,
    sort_order: 0,
    includes_public_ip: false,
    is_active: true,
  },
  planNote:
    "پلن فعال بلافاصله در فهرست عمومی سرویس ابری اندروید و API خرید نمایش داده می‌شود.",
}

export default function AndroidCloudReportPage() {
  return <ProductReportPage config={CONFIG} />
}
