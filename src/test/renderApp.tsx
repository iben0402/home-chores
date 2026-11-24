import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { routes } from '../app/routes'
import { AuthContext, type AppUser } from '../features/auth/useAuth'

export const ANNA: AppUser = { uid: 'u1', email: 'anna@example.com', displayName: 'Anna Nowak' }

/** Render the real route table at `path`, with a fixed auth state. */
export function renderApp(path: string, user: AppUser | null = null) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const view = render(
    <AuthContext.Provider value={{ user, loading: false }}>
      <RouterProvider router={router} />
    </AuthContext.Provider>,
  )
  return { ...view, router }
}
