import { api, clearTokens, saveTokens } from "@/lib/api"
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
    return data.user
  },

  async getMe() {
    const { data } = await api.get<PanelUser>("/auth/me/")
    return data
  },

  logout() {
    clearTokens()
    if (typeof window !== "undefined") window.location.href = "/login"
  },
}
