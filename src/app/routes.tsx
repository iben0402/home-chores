import type { RouteObject } from 'react-router'
import App from '../App'
import { ForgotPage } from '../features/auth/ForgotPage'
import { LoginPage } from '../features/auth/LoginPage'
import { SignUpPage } from '../features/auth/SignUpPage'
import { HomePlaceholder } from '../features/home/HomePlaceholder'
import { RedirectIfAuthed, RequireAuth } from './guards'
import Placeholder from './Placeholder'

// Route table from the design spec §11. Screens not built yet are placeholders.
const appScreens: Array<[path: string, title: string]> = [
  ['/households/new', 'New household'],
  ['/h/:hid', 'Today'],
  ['/h/:hid/rooms', 'Rooms'],
  ['/h/:hid/rooms/:roomId', 'Room'],
  ['/h/:hid/chores/new', 'New chore'],
  ['/h/:hid/chores/:choreId', 'Chore'],
  ['/h/:hid/history', 'History'],
  ['/h/:hid/household', 'Household'],
]

export const routes: RouteObject[] = [
  {
    element: <App />,
    children: [
      {
        element: <RedirectIfAuthed />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/signup', element: <SignUpPage /> },
          { path: '/forgot', element: <ForgotPage /> },
        ],
      },
      // Public: the invite flow handles signed-out visitors itself (later plan).
      { path: '/join/:code', element: <Placeholder title="Join household" /> },
      {
        element: <RequireAuth />,
        children: [
          { path: '/', element: <HomePlaceholder /> },
          ...appScreens.map(([path, title]) => ({ path, element: <Placeholder title={title} /> })),
        ],
      },
      { path: '*', element: <Placeholder title="Not found" /> },
    ],
  },
]
