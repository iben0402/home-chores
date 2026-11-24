import { createContext, useContext } from 'react'
import type { AppUser } from '../../data/auth'

export type { AppUser }
export type AuthState = { user: AppUser | null; loading: boolean }

export const AuthContext = createContext<AuthState>({ user: null, loading: true })

export function useAuth(): AuthState {
  return useContext(AuthContext)
}
