import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router'
import { useAuth } from '../features/auth/useAuth'

/** Only same-site paths: "/h/abc" yes; "//evil.example", "/\evil", "https://…" no. */
export function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : '/'
}

/** Signed-out visitors go to /login, remembering where they were headed. */
export function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return null
  if (!user) {
    const target = location.pathname + location.search
    return <Navigate to={target === '/' ? '/login' : `/login?next=${encodeURIComponent(target)}`} replace />
  }
  return <Outlet />
}

/** Signed-in visitors skip the auth screens and go where they were headed. */
export function RedirectIfAuthed() {
  const { user, loading } = useAuth()
  const [params] = useSearchParams()
  if (loading) return null
  if (user) return <Navigate to={safeNext(params.get('next'))} replace />
  return <Outlet />
}
