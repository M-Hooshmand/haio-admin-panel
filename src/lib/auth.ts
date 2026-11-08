import { api, clearTokens, REFRESH_TOKEN_KEY, saveTokens } from "@/lib/api"
import type { PanelUser } from "@/lib/roles"

export interface LoginResponse {
  access: string
  refresh: string
  user: PanelUser
}

export const authService = {
  async login(username: string, password: string) {
    const { data } = await api.post<LoginResponse>("/auth/login/", { username, password })
    saveTokens(data.access, data.refresh)
    setRefreshCookie(data.refresh)
    return data.user
  },

  async getMe() {
    const { data } = await api.get<PanelUser>("/auth/me/")
    return data
  },

  logout() {
    clearTokens()
    clearRefreshCookie()
    if (typeof window !== "undefined") window.location.href = "/login"
  },
}

const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60

export function setRefreshCookie(refresh: string) {
  if (typeof document === "undefined") return
  document.cookie = `${REFRESH_COOKIE_NAME}=${encodeURIComponent(refresh)}; path=/; max-age=${REFRESH_COOKIE_MAX_AGE}; samesite=lax`
}

export function clearRefreshCookie() {
  if (typeof document === "undefined") return
  document.cookie = `${REFRESH_COOKIE_NAME}=; path=/; max-age=0; samesite=lax`
}

export const REFRESH_COOKIE_NAME = "haio_admin_refresh"
