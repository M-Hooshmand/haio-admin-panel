import { create } from "zustand"
import type { PanelRole, PanelUser } from "@/lib/roles"
import { resolvePanelRole } from "@/lib/roles"
import { authService } from "@/lib/auth"
import { getAccessToken } from "@/lib/api"

interface AuthState {
  user: PanelUser | null
  role: PanelRole | null
  isLoading: boolean
  isAuthenticated: boolean
  setUser: (user: PanelUser | null) => void
  bootstrap: () => Promise<void>
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  role: null,
  isLoading: true,
  isAuthenticated: false,

  setUser: (user) =>
    set({
      user,
      role: resolvePanelRole(user?.panel_role ?? user?.role),
      isAuthenticated: Boolean(user),
      isLoading: false,
    }),

  bootstrap: async () => {
    if (!getAccessToken()) {
      set({ user: null, role: null, isAuthenticated: false, isLoading: false })
      return
    }
    try {
      const user = await authService.getMe()
      set({
        user,
        role: resolvePanelRole(user.panel_role ?? user.role),
        isAuthenticated: true,
        isLoading: false,
      })
    } catch {
      set({ user: null, role: null, isAuthenticated: false, isLoading: false })
    }
  },

  logout: () => authService.logout(),
}))
