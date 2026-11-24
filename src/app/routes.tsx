import type { RouteObject } from 'react-router'
import App from '../App'
import Placeholder from './Placeholder'

// Route table from the design spec §11. Each screen is a placeholder until its feature plan lands.
const screens: Array<[path: string, title: string]> = [
  ['/', 'Chours'],
  ['/login', 'Log in'],
  ['/signup', 'Sign up'],
  ['/join/:code', 'Join household'],
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
      ...screens.map(([path, title]) => ({ path, element: <Placeholder title={title} /> })),
      { path: '*', element: <Placeholder title="Not found" /> },
    ],
  },
]
