import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { skipOccurrence, undoCompletion, watchChore, watchOpenOccurrences, type Chore, type Occurrence } from '../../data/chores'
import { watchHistory, type HistoryEntry } from '../../data/history'
import { watchHousehold, watchMembers } from '../../data/households'
import { addDays, dueLabel, todayISO } from '../../lib/schedule'
import { ANNA, renderApp } from '../../test/renderApp'

const today = todayISO()
const occ = (o: Partial<Occurrence> & { id: string; seq: number; dueDate: string }): Occurrence => ({
  choreId: 'bath', choreTitle: 'Bathroom', roomId: 'general', kind: 'interval', status: 'open', assigneeUid: null, createdBy: 'u1', createdByName: 'Anna Nowak', ...o,
})
const BATH: Chore = {
  id: 'bath', title: 'Bathroom', description: '', roomId: 'general', kind: 'interval', rule: { kind: 'interval', every: 1, unit: 'week' },
  lookahead: 2, nextSeq: 2, archived: false, createdBy: 'u1', createdByName: 'Anna Nowak', lastDoneAt: null,
}
const OPEN = [occ({ id: 'bath_0', seq: 0, dueDate: today, assigneeUid: 'tom' }), occ({ id: 'bath_1', seq: 1, dueDate: addDays(today, 7) })]

function admin(yes: boolean) {
  vi.mocked(watchHousehold).mockImplementation((_db, hid, cb) => {
    cb({ id: hid, name: 'Flat on Main St', adminUids: yes ? ['u1'] : ['tom'] })
    return () => {}
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  admin(true)
  vi.mocked(watchChore).mockImplementation((_db, _hid, _id, cb) => {
    cb(BATH)
    return () => {}
  })
  vi.mocked(watchOpenOccurrences).mockImplementation((_db, _hid, cb) => {
    cb(OPEN)
    return () => {}
  })
  vi.mocked(watchMembers).mockImplementation((_db, _hid, cb) => {
    cb([
      { uid: 'u1', displayName: 'Anna Nowak', color: 1 },
      { uid: 'tom', displayName: 'Tom Reid', color: 2 },
    ])
    return () => {}
  })
  vi.mocked(skipOccurrence).mockResolvedValue({ occurrenceId: 'bath_0', choreId: 'bath' })
  vi.mocked(undoCompletion).mockResolvedValue()
})

test('an admin skips from the row sheet, with a reason; the snackbar offers Undo', async () => {
  const user = userEvent.setup()
  renderApp('/h/h1', ANNA)
  await user.click(screen.getByRole('button', { name: 'Bathroom. More actions' }))
  await user.click(within(screen.getByRole('dialog', { name: 'Bathroom' })).getByRole('button', { name: /Skip this time/ }))

  const dialog = screen.getByRole('alertdialog', { name: 'Skip Bathroom today?' })
  expect(dialog).toHaveAccessibleDescription(`It’s logged as skipped in History, and Tom is no longer assigned. The next one is due ${dueLabel(addDays(today, 7), today)}.`)
  await user.type(within(dialog).getByRole('textbox', { name: /Reason/ }), 'away that weekend')
  await user.click(within(dialog).getByRole('button', { name: 'Skip' }))

  expect(skipOccurrence).toHaveBeenCalledWith(expect.anything(), 'h1', 'bath_0', { uid: 'u1', displayName: 'Anna Nowak' }, today, 'away that weekend')
  expect((await screen.findByText('Skipped')).closest('[role="status"]')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Undo' }))
  expect(undoCompletion).toHaveBeenCalledWith(expect.anything(), 'h1', { occurrenceId: 'bath_0', choreId: 'bath' })
})

test('members don’t see Skip, on the row sheet or the chore page', async () => {
  const user = userEvent.setup()
  admin(false)
  const { unmount } = renderApp('/h/h1', ANNA)
  await user.click(screen.getByRole('button', { name: 'Bathroom. More actions' }))
  expect(within(screen.getByRole('dialog', { name: 'Bathroom' })).queryByRole('button', { name: /Skip/ })).toBeNull()
  unmount()
  renderApp('/h/h1/chores/bath', ANNA)
  expect(screen.getByRole('button', { name: 'Mark done' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull()
})

test('the chore page: Skip next to Mark done, then a Skipped snackbar', async () => {
  const user = userEvent.setup()
  renderApp('/h/h1/chores/bath', ANNA)
  await user.click(screen.getByRole('button', { name: 'Skip' }))
  await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Skip' }))
  expect(skipOccurrence).toHaveBeenCalledWith(expect.anything(), 'h1', 'bath_0', expect.anything(), today, '')
  await waitFor(() => expect(screen.getByText('Skipped')).toBeInTheDocument())
})

test('after a skip: summary line, “This one’s next”, and Recently shows the skip with its reason', () => {
  const skippedDue = addDays(today, -1)
  const entries: HistoryEntry[] = [
    { id: 'bath_0', choreId: 'bath', choreTitle: 'Bathroom', roomId: 'general', kind: 'interval', seq: 0, status: 'skipped', skipReason: 'away that weekend', dueDate: skippedDue, doneBy: 'u1', doneByName: 'Anna Nowak', doneAt: new Date() },
    { id: 'old', choreId: 'bath', choreTitle: 'Bathroom', roomId: 'general', kind: 'interval', seq: -1, status: 'done', dueDate: addDays(today, -8), doneBy: 'tom', doneByName: 'Tom Reid', doneAt: new Date(Date.now() - 8 * 86400000) },
  ]
  vi.mocked(watchHistory).mockImplementation((_db, _hid, cb) => {
    cb(entries)
    return () => {}
  })
  renderApp('/h/h1/chores/bath', ANNA)
  expect(screen.getByText(new RegExp(`^${dueLabel(skippedDue, today)} skipped by you · last done .* by Tom$`))).toBeInTheDocument()
  expect(screen.getByText('This one’s next')).toBeInTheDocument()
  const recently = screen.getByRole('region', { name: 'Recently' })
  expect(recently).toHaveTextContent('Skipped by you')
  expect(recently).toHaveTextContent(`${dueLabel(skippedDue, today)} · away that weekend`)
})

test('History lists a skip with its badge, who and why', () => {
  vi.mocked(watchHistory).mockImplementation((_db, _hid, cb) => {
    cb([{ id: 'bath_0', choreId: 'bath', choreTitle: 'Bathroom', roomId: 'general', kind: 'interval', seq: 0, status: 'skipped', skipReason: 'away that weekend', dueDate: today, doneBy: 'tom', doneByName: 'Tom Reid', doneAt: new Date() }])
    return () => {}
  })
  renderApp('/h/h1/history', ANNA)
  const row = screen.getByRole('button', { name: /Bathroom/ })
  expect(row).toHaveTextContent('Skipped')
  expect(row).toHaveTextContent('Tom · away that weekend')
})
