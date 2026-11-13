"use client"

import { Globe } from "lucide-react"
import { ProductReportPage, type ProductReportConfig } from "@/components/product-report"

const CONFIG: ProductReportConfig = {
  product: "wordpress",
  title: "گزارش هاست مدیریت‌شده وردپرس",
  subtitle:
    "همهٔ سایت‌های وردپرس خریداری‌شده: مشتری، سازمان، پلن، وضعیت، دوره و دامنه — با جست‌وجو، فیلتر و مدیریت پلن‌ها",
  icon: Globe,
  sitesPath: "/staff/wordpress/sites/",
  summaryPath: "/staff/wordpress/summary/",
  plansPath: "/staff/wordpress/plans/",
  entityName: "سایت",
  identifier: {
    label: "دامنه اصلی",
    value: (row) => String(row.primary_domain ?? ""),
  },
  details: [
    { key: "is_trial", label: "نسخهٔ آزمایشی", kind: "bool" },
    { key: "trial_ends_at", label: "پایان آزمایش", kind: "date-time" },
    { key: "account_name", label: "هاست چندسایتی" },
    { key: "php_version", label: "نسخه PHP", kind: "mono" },
    { key: "wp_version", label: "نسخه وردپرس", kind: "mono" },
    { key: "created_by_username", label: "ثبت‌شده توسط", kind: "mono" },
    { key: "provisioned_at", label: "زمان راه‌اندازی", kind: "date-time" },
    { key: "last_error", label: "آخرین خطا" },
  ],
  planFields: [
    { key: "slug", label: "شناسه (slug)", type: "text", required: true, mono: true, placeholder: "wp-business-2" },
    { key: "name", label: "نام پلن", type: "text", required: true, placeholder: "هاست وردپرس بیزینس" },
    { key: "description", label: "توضیحات", type: "textarea", placeholder: "توضیح کوتاه برای صفحهٔ خرید" },
    { key: "price_monthly", label: "قیمت ماهانه (تومان)", type: "number", required: true },
    { key: "price_annual", label: "قیمت سالانه (تومان)", type: "number", required: true, help: "معمولاً ۱۰ برابر ماهانه" },
    { key: "vcpu", label: "vCPU", type: "number" },
    { key: "memory_mib", label: "حافظه (MiB)", type: "number" },
    { key: "disk_gib", label: "دیسک (GiB)", type: "number" },
    { key: "bandwidth_gib", label: "پهنای باند (GiB)", type: "number" },
    { key: "visits_monthly", label: "بازدید ماهانه", type: "number" },
    { key: "backup_interval_days", label: "فاصلهٔ بکاپ (روز)", type: "number" },
    { key: "db_backup_interval_hours", label: "فاصلهٔ بکاپ دیتابیس (ساعت)", type: "number", nullable: true, help: "خالی = غیرفعال" },
    { key: "max_domains", label: "حداکثر دامنه", type: "number" },
    { key: "php_versions", label: "نسخه‌های PHP", type: "php_versions", help: "با کاما جدا کنید: 8.2, 8.3" },
    { key: "max_sites", label: "حداکثر سایت", type: "number", help: "برای پلن چندسایتی" },
    { key: "trial_days", label: "روزهای آزمایشی", type: "number", help: "برای پلن آزمایشی" },
    { key: "sort_order", label: "ترتیب نمایش", type: "number" },
    { key: "staging_enabled", label: "محیط Staging", type: "checkbox", help: "فعال" },
    { key: "is_multi_site", label: "پلن چندسایتی", type: "checkbox", help: "فعال" },
    { key: "is_trial", label: "پلن آزمایشی", type: "checkbox", help: "فعال" },
    { key: "is_active", label: "فعال برای فروش", type: "checkbox", help: "فعال" },
  ],
  planDefaults: {
    slug: "",
    name: "",
    description: "",
    price_monthly: 0,
    price_annual: 0,
    vcpu: 1,
    memory_mib: 2048,
    disk_gib: 20,
    bandwidth_gib: 200,
    visits_monthly: 50000,
    backup_interval_days: 7,
    db_backup_interval_hours: "",
    max_domains: 1,
    php_versions: "8.2, 8.3",
    max_sites: 1,
    trial_days: 0,
    sort_order: 0,
    staging_enabled: false,
    is_multi_site: false,
    is_trial: false,
    is_active: true,
  },
  planNote:
    "پلن‌های چندسایتی و آزمایشی در کاتالوگ عمومی «هاست وردپرس» نمایش داده نمی‌شوند و فقط از مسیر خرید خودشان فروخته می‌شوند.",
}

export default function WordPressReportPage() {
  return <ProductReportPage config={CONFIG} />
}
