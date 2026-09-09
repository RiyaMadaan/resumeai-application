import { apiClient } from './client'
import type { AuthResponse, User } from '@/types/user'

/** Auth API calls. */
export const authApi = {
  async register(name: string, email: string, password: string): Promise<AuthResponse> {
    const { data } = await apiClient.post<AuthResponse>('/auth/register', {
      name,
      email,
      password,
    })
    return data
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    const { data } = await apiClient.post<AuthResponse>('/auth/login', { email, password })
    return data
  },

  async me(): Promise<User> {
    const { data } = await apiClient.get<{ user: User }>('/auth/me')
    return data.user
  },
}
