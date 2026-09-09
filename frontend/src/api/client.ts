import axios from 'axios'

/**
 * Shared Axios instance for the ResumeAI API.
 *
 * - Base URL comes from an env var (never hard-coded secrets/hosts).
 * - A request interceptor attaches the JWT from localStorage.
 * - A response interceptor clears a stale token on 401 so the app can redirect
 *   to login.
 */
const TOKEN_KEY = 'resumeai_token'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
})

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

apiClient.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  // File uploads must not inherit the JSON default: the browser needs to set
  // multipart/form-data itself so it can include the boundary.
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearToken()
    }
    return Promise.reject(error)
  },
)

/** Normalize an Axios error into a readable message for the UI. */
export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.error ?? error.message ?? fallback
  }
  return fallback
}
