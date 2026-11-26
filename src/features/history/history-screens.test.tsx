import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { deleteEntry, undoFromHistory, watchHistory, type HistoryEntry } from '../../data/history'
import { watchHousehold, watchMembers } from '../../data/households'
import { watchRooms } from '../../data/rooms'
import { ANNA, renderApp } from '../../test/renderApp'
import { dayLabel } from './historyModel'

const now = new Date()
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60000)
const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 20, 12)
const entry = (e: Partial<HistoryEntry> & { id: string; choreTitle: string }): HistoryEntry => ({
  choreId: e.id,
  roomId: 'general',
  kind: 'interval',
  seq: 0,
  status: 'done',
  dueDate: '2026-11-24',
  doneBy: 'u1',
  doneByName: 'Anna Nowak',
  doneAt: minutesAgo(2),
  ...e,
})
const ENTRIES = [
  entry({ id: 'bins', choreTitle: 'Bins out' }),
  entry({ id: 'plants', choreTitle: 'Water the plants', doneBy: 'tom', doneByName: 'Tom Reid', roomId: 'kitchen', doneAt: minutesAgo(90) }),
  entry({ id: 'vac', choreTitle: 'Vacuuming', doneBy: 'tom', doneByName: 'Tom Reid', doneAt: yesterday }),
]

function asAdmin(admin: boolean) {
  vi.mocked(watchHousehold).mockImplementation((_db, hid, cb) => {
    cb({ id: hid, name: 'Flat on Main St', adminUids: admin ? ['u1'] : ['tom'] })
    return () => {}
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  asAdmin(true)
  vi.mocked(watchHistory).mockImplementation((_db, _hid, cb) => {
    cb(ENTRIES)
    return () => {}
  })
  vi.mocked(watchRooms).mockImplementation((_db, _hid, cb) => {
    cb([
      { id: 'general', name: 'General', icon: 'house', order: 0, isDefault: true },
      { id: 'kitchen', name: 'Kitchen', icon: 'cooking-pot', order: 1, isDefault: false },
      { id: 'laundry', name: 'Laundry', icon: 'shirt', order: 2, isDefault: false },
    ])
    return () => {}
  })
  vi.mocked(watchMembers).mockImplementation((_db, _hid, cb) => {
    cb([
      { uid: 'u1', displayName: 'Anna Nowak', color: 1 },
      { uid: 'tom', displayName: 'Tom Reid', color: 2 },
    ])
    return () => {}
  })
})

test('day labels', () => {
  const today = new Date(2026, 10, 30, 12)
  expect(dayLabel(new Date(2026, 10, 30, 8), today)).toBe('Today')
  expect(dayLabel(new Date(2026, 10, 29, 23), today)).toBe('Yesterday')
  expect(dayLabel(new Date(2026, 10, 28, 9), today)).toBe('Sat 28 Nov')
})

test('entries grouped by day, with who and when; your recent one shows its undo time', () => {
  renderApp('/h/h1/history', ANNA)
  expect(screen.getByRole('heading', { name: 'History' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Yesterday' })).toBeInTheDocument()
  expect(screen.getByText(/· You · undo until/)).toBeInTheDocument()
  expect(screen.getAllByText(/· Tom$/)).toHaveLength(2)
})

test('empty history', () => {
  vi.mocked(watchHistory).mockImplementation((_db, _hid, cb) => {
    cb([])
    return () => {}
  })
  renderApp('/h/h1/history', ANNA)
  expect(screen.getByRole('heading', { name: 'Nothing done yet' })).toBeInTheDocument()
})

test('filter by person and room; no results; clear', async () => {
  const user = userEvent.setup()
  renderApp('/h/h1/history', ANNA)
  await user.click(screen.getByRole('button', { name: /Everyone/ }))
  const sheet = screen.getByRole('dialog', { name: 'Filter history' })
  expect(sheet).toBeInTheDocument()
  await user.click(screen.getByRole('radio', { name: 'Tom' }))
  await user.click(screen.getByRole('radio', { name: 'Laundry' }))
  await user.click(screen.getByRole('button', { name: 'Show entries' }))
  expect(screen.getByRole('heading', { name: 'No matching entries' })).toBeInTheDocument()
  expect(screen.getByText('Nothing in History matches Tom in Laundry.')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Clear filters' }))
  expect(screen.getByText('Bins out')).toBeInTheDocument()
})

test('your recent entry: Undo from its sheet', async () => {
  const user = userEvent.setup()
  vi.mocked(undoFromHistory).mockResolvedValue()
  renderApp('/h/h1/history', ANNA)
  await user.click(screen.getByRole('button', { name: /Bins out/ }))
  const sheet = screen.getByRole('dialog', { name: 'Bins out' })
  expect(sheet).toHaveTextContent('Done by you')
  await user.click(screen.getByRole('button', { name: /Undo — not done yet/ }))
  expect(undoFromHistory).toHaveBeenCalledWith(expect.anything(), 'h1', ENTRIES[0])
  expect(await screen.findByText('Bins out is back on Today')).toBeInTheDocument()
})

test('admins can delete an entry, after confirming', async () => {
  const user = userEvent.setup()
  vi.mocked(deleteEntry).mockResolvedValue()
  renderApp('/h/h1/history', ANNA)
  await user.click(screen.getByRole('button', { name: /Vacuuming/ }))
  expect(screen.queryByRole('button', { name: /Undo/ })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Delete entry' }))
  expect(screen.getByRole('alertdialog', { name: 'Delete this entry?' })).toHaveAccessibleDescription(
    'Vacuuming, done by Tom yesterday, is removed from History for everyone. Use this for entries made by mistake.',
  )
  await user.click(screen.getByRole('button', { name: 'Delete entry' }))
  await waitFor(() => expect(deleteEntry).toHaveBeenCalledWith(expect.anything(), 'h1', 'vac'))
})

test('members cannot delete entries', async () => {
  const user = userEvent.setup()
  asAdmin(false)
  renderApp('/h/h1/history', ANNA)
  await user.click(screen.getByRole('button', { name: /Vacuuming/ }))
  expect(screen.queryByRole('button', { name: 'Delete entry' })).not.toBeInTheDocument()
})
