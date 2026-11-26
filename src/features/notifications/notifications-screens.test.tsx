import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { watchChore } from '../../data/chores'
import { watchMyHouseholds } from '../../data/households'
import { markAllNotificationsRead, markNotificationRead, watchNotifications, type AppNotification } from '../../data/notifications'
import { ANNA, renderApp } from '../../test/renderApp'

const now = new Date()
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000)
const note = (n: Partial<AppNotification> & { id: string }): AppNotification => ({
  type: 'assigned', householdId: 'h1', householdName: 'Flat on Main St', choreId: 'vac', choreTitle: 'Vacuuming',
  fromUid: 'tom', fromName: 'Tom Reid', fromColor: 2, read: false, createdAt: minutesAgo(5), ...n,
})
function inbox(items: AppNotification[] | 'error') {
  vi.mocked(watchNotifications).mockImplementation((_db, _uid, _now, cb, onError) => {
    if (items === 'error') onError?.(new Error('offline'))
    else cb(items)
    return () => {}
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  inbox([])
})

test('the bell shows the unread count (9+ above nine) and none when all are read', () => {
  inbox(Array.from({ length: 12 }, (_, i) => note({ id: `n${i}` })))
  const { unmount } = renderApp('/h/h1', ANNA)
  const bell = screen.getByRole('button', { name: 'Notifications, 12 unread' })
  expect(bell).toHaveTextContent('9+')
  unmount()
  inbox([note({ id: 'n1', read: true })])
  renderApp('/h/h1', ANNA)
  expect(screen.getByRole('button', { name: 'Notifications' })).not.toHaveTextContent(/\d/)
})

test('the panel lists notifications by day with the design’s wording', async () => {
  const user = userEvent.setup()
  inbox([
    note({ id: 'a', dueDate: '2099-12-10' }),
    note({ id: 'r', type: 'renamed', choreTitle: 'Vacuuming', previousTitle: 'Hoovering', read: true, createdAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 18, 40) }),
    note({ id: 'x', type: 'removed', choreTitle: 'Defrost the freezer', read: true, createdAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 9, 0) }),
  ])
  renderApp('/h/h1', ANNA)
  await user.click(screen.getByRole('button', { name: 'Notifications, 1 unread' }))
  const panel = screen.getByRole('dialog', { name: 'Notifications' })
  expect(within(panel).getByText('1 unread')).toBeInTheDocument()
  expect(within(panel).getByRole('group', { name: 'Today' })).toHaveTextContent('Unread. Tom assigned you Vacuuming · Thu 10 Dec 20995 min ago')
  expect(within(panel).getByRole('group', { name: 'Yesterday' })).toHaveTextContent('Tom renamed Hoovering to VacuumingYesterday, 18:40')
  const earlier = within(panel).getByRole('group', { name: 'Earlier' })
  expect(earlier).toHaveTextContent('Tom removed Defrost the freezer')
  expect(earlier).toHaveTextContent('nothing to open')
  // A read "removed" is plain text, not a button.
  expect(within(earlier).queryByRole('button')).toBeNull()
  expect(within(panel).getByText('Showing the last 60 days.')).toBeInTheDocument()
})

test('tapping one marks it read and opens its chore; a removed chore only marks read', async () => {
  const user = userEvent.setup()
  inbox([note({ id: 'a' }), note({ id: 'x', type: 'removed', choreTitle: 'Bins', createdAt: minutesAgo(30) })])
  const { router } = renderApp('/h/h1', ANNA)
  await user.click(screen.getByRole('button', { name: 'Notifications, 2 unread' }))
  await user.click(screen.getByRole('button', { name: /Tom removed Bins/ }))
  expect(markNotificationRead).toHaveBeenCalledWith(expect.anything(), 'u1', 'x')
  expect(screen.getByRole('dialog', { name: 'Notifications' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /Tom assigned you Vacuuming/ }))
  expect(markNotificationRead).toHaveBeenCalledWith(expect.anything(), 'u1', 'a')
  await waitFor(() => expect(router.state.location.pathname).toBe('/h/h1/chores/vac'))
})

test('a notification from another household opens there, and shows which household it’s from', async () => {
  const user = userEvent.setup()
  vi.mocked(watchMyHouseholds).mockImplementation((_db, _uid, cb) => {
    cb([{ id: 'h1', name: 'Flat on Main St', adminUids: ['u1'] }, { id: 'h2', name: 'The Nowaks', adminUids: [] }])
    return () => {}
  })
  inbox([note({ id: 'a', householdId: 'h2', householdName: 'The Nowaks', choreId: 'laundry', choreTitle: 'Laundry' })])
  const { router } = renderApp('/h/h1', ANNA)
  await user.click(screen.getByRole('button', { name: 'Notifications, 1 unread' }))
  expect(screen.getByRole('button', { name: /Laundry/ })).toHaveTextContent('5 min ago · The Nowaks')
  await user.click(screen.getByRole('button', { name: /Laundry/ }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/h/h2/chores/laundry'))
})

test('mark all read', async () => {
  const user = userEvent.setup()
  inbox([note({ id: 'a' }), note({ id: 'b' })])
  renderApp('/h/h1', ANNA)
  await user.click(screen.getByRole('button', { name: 'Notifications, 2 unread' }))
  await user.click(screen.getByRole('button', { name: 'Mark all read' }))
  expect(markAllNotificationsRead).toHaveBeenCalledWith(expect.anything(), 'u1')
})

test('empty and error states; Try again re-subscribes', async () => {
  const user = userEvent.setup()
  const { unmount } = renderApp('/h/h1', ANNA)
  await user.click(screen.getByRole('button', { name: 'Notifications' }))
  expect(screen.getByRole('heading', { name: 'No notifications yet' })).toBeInTheDocument()
  unmount()

  inbox('error')
  renderApp('/h/h1', ANNA)
  await user.click(screen.getByRole('button', { name: 'Notifications' }))
  expect(screen.getByRole('heading', { name: 'Couldn’t load notifications' })).toBeInTheDocument()
  inbox([note({ id: 'a' })])
  await user.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByRole('button', { name: /Tom assigned you Vacuuming/ })).toBeInTheDocument()
})

test('Escape closes the panel and focus returns to the bell', async () => {
  const user = userEvent.setup()
  inbox([note({ id: 'a' })])
  renderApp('/h/h1', ANNA)
  const bell = screen.getByRole('button', { name: 'Notifications, 1 unread' })
  await user.click(bell)
  expect(bell).toHaveAttribute('aria-expanded', 'true')
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog', { name: 'Notifications' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Notifications, 1 unread' })).toHaveFocus()
})

test('opening a notification for a chore deleted since shows “This chore was removed”', async () => {
  const user = userEvent.setup()
  vi.mocked(watchChore).mockImplementation((_db, _hid, _id, cb) => {
    cb(null)
    return () => {}
  })
  inbox([note({ id: 'a' })])
  renderApp('/h/h1', ANNA)
  await user.click(screen.getByRole('button', { name: 'Notifications, 1 unread' }))
  await user.click(screen.getByRole('button', { name: /Tom assigned you Vacuuming/ }))
  expect(await screen.findByRole('heading', { name: 'This chore was removed' })).toBeInTheDocument()
  expect(screen.getByText('Vacuuming was deleted after this notification was sent, so there’s nothing to open.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Go to Today' })).toHaveAttribute('href', '/h/h1')
})
