import { create } from 'zustand'
import type { Usuario } from '@/types'

interface AuthState {
  token: string | null
  user: Usuario | null
  isAuthenticated: boolean
  login: (token: string, user: Usuario) => void
  logout: () => void
  setUser: (user: Usuario) => void
  setToken: (token: string) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('crm_token'),
  user: JSON.parse(localStorage.getItem('crm_user') || 'null'),
  isAuthenticated: !!localStorage.getItem('crm_token'),
  login: (token, user) => {
    localStorage.setItem('crm_token', token)
    localStorage.setItem('crm_user', JSON.stringify(user))
    set({ token, user, isAuthenticated: true })
  },
  logout: () => {
    localStorage.removeItem('crm_token')
    localStorage.removeItem('crm_user')
    set({ token: null, user: null, isAuthenticated: false })
  },
  setUser: (user) => {
    localStorage.setItem('crm_user', JSON.stringify(user))
    set({ user })
  },
  setToken: (token) => {
    localStorage.setItem('crm_token', token)
    set({ token, isAuthenticated: true })
  },
}))
