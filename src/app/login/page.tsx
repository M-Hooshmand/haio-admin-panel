"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AxiosError } from "axios"
import { Loader2, LockKeyhole, ShieldCheck, User } from "lucide-react"
import { authService } from "@/lib/auth"
import { useAuthStore } from "@/stores/auth-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

function extractError(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as Record<string, unknown> | undefined
    if (data) {
      const first = Object.values(data)[0]
      if (typeof first === "string") return first
      if (Array.isArray(first) && typeof first[0] === "string") return first[0]
    }
    if (error.response?.status === 401) return "نام کاربری یا رمز عبور اشتباه است."
    if (!error.response) return "ارتباط با سرور برقرار نشد."
  }
  return "ورود ناموفق بود. دوباره تلاش کنید."
}

export default function LoginPage() {
  const router = useRouter()
  const setUser = useAuthStore((state) => state.setUser)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const user = await authService.login(username.trim(), password)
      setUser(user)
      router.replace("/dashboard")
    } catch (err) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl md:grid-cols-2">
        <div className="relative hidden flex-col justify-between bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600 p-10 text-white md:flex">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-lg font-bold">پنل مدیریت هایو</p>
              <p className="text-xs text-indigo-100">HaioCloud Control Panel</p>
            </div>
          </div>

          <div className="space-y-4">
            <h1 className="text-2xl font-bold leading-relaxed">
              همه‌چیز در یک نگاه،
              <br />
              با دسترسی متناسب با نقش شما
            </h1>
            <p className="text-sm leading-7 text-indigo-100">
              داده‌ها مستقیماً از سرور مرکزی خوانده می‌شوند؛ سطح دسترسی هر بخش
              بر اساس نقش شما تعیین می‌شود.
            </p>
          </div>

          <p className="text-xs text-indigo-200">
            © {new Date().getFullYear()} HaioCloud — Internal Staff Panel
          </p>
        </div>

        <div className="p-8 md:p-12">
          <div className="mb-8 md:hidden">
            <p className="text-lg font-bold text-slate-900">پنل مدیریت هایو</p>
            <p className="text-xs text-slate-500">ورود کارکنان</p>
          </div>

          <h2 className="text-2xl font-bold text-slate-900">ورود به پنل</h2>
          <p className="mt-2 text-sm text-slate-500">
            با حساب کاری خود وارد شوید.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium text-slate-700">
                ایمیل یا نام کاربری
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="ایمیل یا نام کاربری خود را وارد کنید"
                  className="pr-10"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-slate-700">
                رمز عبور
              </label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  className="pr-10"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            {error ? (
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loading ? "در حال ورود..." : "ورود"}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-400">
            دسترسی فقط برای کارکنان مجاز هایوکلود.
          </p>
        </div>
      </div>
    </main>
  )
}
