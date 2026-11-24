import type { RouteObject } from 'react-router'
import App from '../App'
import { ForgotPage } from '../features/auth/ForgotPage'
import { LoginPage } from '../features/auth/LoginPage'
import { SignUpPage } from '../features/auth/SignUpPage'
import { CreateHouseholdPage } from '../features/households/CreateHouseholdPage'
import { GetStartedPage } from '../features/households/GetStartedPage'
import { JoinCodePage } from '../features/households/JoinCodePage'
import { JoinPage } from '../features/households/JoinPage'
import { HouseholdRoute } from '../features/shell/HouseholdLayout'
import { HouseholdTabPlaceholder } from '../features/shell/HouseholdTabPlaceholder'
import { TodayPage } from '../features/shell/TodayPage'
import { NewChorePage } from '../features/chores/NewChorePage'
import { HistoryPage } from '../features/history/HistoryPage'
import { ManageRoomsPage } from '../features/rooms/ManageRoomsPage'
import { RoomPage } from '../features/rooms/RoomPage'
import { RoomsPage } from '../features/rooms/RoomsPage'
import { RedirectIfAuthed, RequireAuth } from './guards'
import { HomeRedirect } from './HomeRedirect'
import Placeholder from './Placeholder'

// Route table from the design spec §11. Screens not built yet are placeholders inside the shell.
const householdScreens: Array<[path: string, title: string]> = [
  ['chores/:choreId', 'Chore'],
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
            element: <HouseholdRoute />,
            children: [
              { index: true, element: <TodayPage /> },
              { path: 'household', element: <HouseholdTabPlaceholder /> },
              { path: 'rooms', element: <RoomsPage /> },
              { path: 'chores/new', element: <NewChorePage /> },
              { path: 'history', element: <HistoryPage /> },
              { path: 'rooms/manage', element: <ManageRoomsPage /> },
              { path: 'rooms/:roomId', element: <RoomPage /> },
              ...householdScreens.map(([path, title]) => ({ path, element: <Placeholder title={title} /> })),
            ],
          },
        ],
      },
      { path: '*', element: <Placeholder title="Not found" /> },
    ],
  },
]
