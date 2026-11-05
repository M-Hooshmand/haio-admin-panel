import type { Metadata } from "next"
import localFont from "next/font/local"
import "./globals.css"

const vazir = localFont({
  src: "../../node_modules/vazirmatn/fonts/webfonts/Vazirmatn[wght].woff2",
  variable: "--font-vazir",
  display: "swap",
  preload: false,
})

export const metadata: Metadata = {
  title: "پنل مدیریت هایو",
  description: "پنل مدیریت و پشتیبانی هایوکلود",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" className={vazir.variable}>
      <body>{children}</body>
    </html>
  )
}
