import { createContext, useContext } from 'react'

export type AppUser = { uid: string; email: string | null; displayName: string | null }
export type AuthState = { user: AppUser | null; loading: boolean }

export const AuthContext = createContext<AuthState>({ user: null, loading: true })

export function useAuth(): AuthState {
  return useContext(AuthContext)
}
