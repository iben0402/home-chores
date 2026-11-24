import { act, render } from '@testing-library/react'
import { useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { routes } from '../app/routes'
import { AuthContext, type AppUser } from '../features/auth/useAuth'

export const ANNA: AppUser = { uid: 'u1', email: 'anna@example.com', displayName: 'Anna Nowak' }

/** Render the real route table at `path`. `setUser` changes the signed-in user mid-test. */
export function renderApp(path: string, user: AppUser | null = null) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  let setCurrent: (next: AppUser | null) => void = () => {}
  function Harness() {
    const [current, set] = useState(user)
    setCurrent = set
    return (
      <AuthContext.Provider value={{ user: current, loading: false }}>
        <RouterProvider router={router} />
      </AuthContext.Provider>
    )
  }
  const view = render(<Harness />)
  return { ...view, router, setUser: (next: AppUser | null) => act(() => setCurrent(next)) }
}
