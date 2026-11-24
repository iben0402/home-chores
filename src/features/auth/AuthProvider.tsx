import { onAuthStateChanged, type User } from 'firebase/auth'
import { useEffect, useState, type ReactNode } from 'react'
import { onProfileChange } from '../../data/auth'
import { auth } from '../../lib/firebase'
import { AuthContext, type AuthState } from './useAuth'

function snapshot(user: User | null) {
  return user ? { uid: user.uid, email: user.email, displayName: user.displayName } : null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true })

  useEffect(() => {
    const offAuth = onAuthStateChanged(auth, (user) => setState({ user: snapshot(user), loading: false }))
    const offProfile = onProfileChange(() => setState({ user: snapshot(auth.currentUser), loading: false }))
    return () => {
      offAuth()
      offProfile()
    }
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}
