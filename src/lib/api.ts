import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios"

export const API_BASE = "/api/v1"
export const ACCESS_TOKEN_KEY = "haio_admin_access"
export const REFRESH_TOKEN_KEY = "haio_admin_refresh"

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { "Content-Type": "application/json", "X-Haio-Panel": "admin" },
})

export function saveTokens(access: string, refresh: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, access)
  localStorage.setItem(REFRESH_TOKEN_KEY, refresh)
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

export function getAccessToken() {
  return typeof window === "undefined" ? null : localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function getRefreshToken() {
  return typeof window === "undefined" ? null : localStorage.getItem(REFRESH_TOKEN_KEY)
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken()
  if (!refresh) return null
  try {
    const { data } = await axios.post(`${API_BASE}/auth/refresh/`, { refresh })
    const access = data?.access as string | undefined
    if (!access) return null
    localStorage.setItem(ACCESS_TOKEN_KEY, access)
    return access
  } catch {
    clearTokens()
    return null
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined
    const status = error.response?.status

    if (status === 401 && original && !original._retry && !original.url?.includes("/auth/")) {
      original._retry = true
      if (!refreshPromise) refreshPromise = refreshAccessToken()
      const token = await refreshPromise
      refreshPromise = null
      if (token) {
        original.headers.Authorization = `Bearer ${token}`
        return api(original)
      }
      if (typeof window !== "undefined") window.location.href = "/login"
    }

    return Promise.reject(error)
  },
)
