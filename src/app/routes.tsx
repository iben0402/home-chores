import type { RouteObject } from 'react-router'
import App from '../App'
import { ForgotPage } from '../features/auth/ForgotPage'
import { LoginPage } from '../features/auth/LoginPage'
import { SignUpPage } from '../features/auth/SignUpPage'
import { CreateHouseholdPage } from '../features/households/CreateHouseholdPage'
import { GetStartedPage } from '../features/households/GetStartedPage'
import { JoinCodePage } from '../features/households/JoinCodePage'
import { JoinPage } from '../features/households/JoinPage'
import { HouseholdLayout } from '../features/shell/HouseholdLayout'
import { TodayPage } from '../features/shell/TodayPage'
import { RedirectIfAuthed, RequireAuth } from './guards'
import { HomeRedirect } from './HomeRedirect'
import Placeholder from './Placeholder'

// Route table from the design spec §11. Screens not built yet are placeholders inside the shell.
const householdScreens: Array<[path: string, title: string]> = [
  ['rooms', 'Rooms'],
  ['rooms/:roomId', 'Room'],
  ['chores/new', 'New chore'],
  ['chores/:choreId', 'Chore'],
  ['history', 'History'],
  ['household', 'Household'],
]

export const routes: RouteObject[] = [
  {
    element: <App />,
    children: [
      {
        element: <RedirectIfAuthed />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/forgot', element: <ForgotPage /> },
        ],
      },
      // Redirects signed-in visitors itself, once its own sign-up has finished.
      { path: '/signup', element: <SignUpPage /> },
      // Invite links: signed out sees who invited them (5a); signed in confirms (5c).
      { path: '/join/:code', element: <JoinPage /> },
      {
        element: <RequireAuth />,
        children: [
          { path: '/', element: <HomeRedirect /> },
          { path: '/start', element: <GetStartedPage /> },
          { path: '/households/new', element: <CreateHouseholdPage /> },
          { path: '/join', element: <JoinCodePage /> },
          {
            path: '/h/:hid',
            element: <HouseholdLayout />,
            children: [
              { index: true, element: <TodayPage /> },
              ...householdScreens.map(([path, title]) => ({ path, element: <Placeholder title={title} /> })),
            ],
          },
        ],
      },
      { path: '*', element: <Placeholder title="Not found" /> },
    ],
  },
]
