import { act, render, screen } from '@testing-library/react'
import { watchAuth, type AppUser } from '../../data/auth'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './useAuth'

vi.mock('../../data/auth', () => ({ watchAuth: vi.fn() }))

function Probe() {
  const { user, loading } = useAuth()
  return <p>{loading ? 'loading' : (user?.displayName ?? 'signed out')}</p>
}

test('follows auth and profile changes from watchAuth', () => {
  let emit!: (user: AppUser | null) => void
  const stop = vi.fn()
  vi.mocked(watchAuth).mockImplementation((cb) => {
    emit = cb
    return stop
  })
  const { unmount } = render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  )
  expect(screen.getByText('loading')).toBeInTheDocument()
  act(() => emit({ uid: 'u1', email: 'anna@example.com', displayName: null }))
  expect(screen.getByText('signed out')).toBeInTheDocument()
  act(() => emit({ uid: 'u1', email: 'anna@example.com', displayName: 'Anna Nowak' }))
  expect(screen.getByText('Anna Nowak')).toBeInTheDocument()
  unmount()
  expect(stop).toHaveBeenCalled()
})
