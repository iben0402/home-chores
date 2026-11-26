import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { archiveChore, assignOccurrence, createChore, deleteChore, updateChore, watchChore, watchOpenOccurrences, type Chore, type Occurrence } from '../../data/chores'
import { watchHousehold, watchMembers } from '../../data/households'
import { watchRooms } from '../../data/rooms'
import { addDays, todayISO } from '../../lib/schedule'
import { ANNA, renderApp } from '../../test/renderApp'

const today = todayISO()
const occ = (o: Partial<Occurrence> & { id: string; choreId: string; choreTitle: string; dueDate: string }): Occurrence => ({
  roomId: 'kitchen', kind: 'interval', seq: 0, status: 'open', assigneeUid: null, createdBy: 'u1', createdByName: 'Anna Nowak', ...o,
})
const VAC: Chore = {
  id: 'vac', title: 'Vacuuming', description: 'Under the sofa too', roomId: 'kitchen', kind: 'interval',
  rule: { kind: 'interval', every: 1, unit: 'week' }, lookahead: 2, nextSeq: 2, archived: false,
  createdBy: 'u1', createdByName: 'Anna Nowak', lastDoneAt: null,
}
const KETTLE: Chore = { ...VAC, id: 'kettle', title: 'Descale the kettle', description: '', kind: 'oneoff', rule: { kind: 'oneoff' }, lookahead: 1, nextSeq: 1, createdBy: 'tom', createdByName: 'Tom Reid' }
const OCCURRENCES = [
  occ({ id: 'vac0', choreId: 'vac', choreTitle: 'Vacuuming', dueDate: today }),
  occ({ id: 'vac1', choreId: 'vac', choreTitle: 'Vacuuming', dueDate: addDays(today, 7), seq: 1, assigneeUid: 'tom' }),
  occ({ id: 'kettle0', choreId: 'kettle', choreTitle: 'Descale the kettle', dueDate: today, kind: 'oneoff', createdBy: 'tom', createdByName: 'Tom Reid', assigneeUid: 'tom' }),
]

function role(admin: boolean) {
  vi.mocked(watchHousehold).mockImplementation((_db, hid, cb) => {
    cb({ id: hid, name: 'Flat on Main St', adminUids: admin ? ['u1'] : ['tom'] })
    return () => {}
  })
}
function chore(c: Chore | null) {
  vi.mocked(watchChore).mockImplementation((_db, _hid, _id, cb) => {
    cb(c)
    return () => {}
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  role(true)
  chore(VAC)
  vi.mocked(watchOpenOccurrences).mockImplementation((_db, _hid, cb) => {
    cb(OCCURRENCES)
    return () => {}
  })
  vi.mocked(watchRooms).mockImplementation((_db, _hid, cb) => {
    cb([
      { id: 'general', name: 'General', icon: 'house', order: 0, isDefault: true },
      { id: 'kitchen', name: 'Kitchen', icon: 'cooking-pot', order: 1, isDefault: false },
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
  for (const fn of [assignOccurrence, updateChore, deleteChore, archiveChore]) vi.mocked(fn).mockResolvedValue()
})

describe('assigning from Today', () => {
  test('tap a row: the sheet offers Take it, Assign to… and Open chore', async () => {
    const user = userEvent.setup()
    renderApp('/h/h1', ANNA)
    await user.click(screen.getByRole('button', { name: 'Vacuuming. More actions' }))
    const sheet = screen.getByRole('dialog', { name: 'Vacuuming' })
    expect(sheet).toHaveTextContent('Kitchen · Today · nobody yet')
    expect(within(sheet).getByRole('button', { name: 'Take it' })).toBeInTheDocument()
    expect(within(sheet).getByRole('link', { name: 'Open chore' })).toHaveAttribute('href', '/h/h1/chores/vac')
    await user.click(within(sheet).getByRole('button', { name: 'Assign to…' }))
    const picker = screen.getByRole('dialog', { name: 'Assign to…' })
    await user.click(within(picker).getByRole('radio', { name: /Tom Reid/ }))
    expect(assignOccurrence).toHaveBeenCalledWith(expect.anything(), 'h1', 'vac0', 'tom', 'u1')
    expect(await screen.findByText('Assigned to Tom')).toBeInTheDocument()
  })

  test('tap an assignee avatar to reassign; members can’t unassign someone else', async () => {
    const user = userEvent.setup()
    role(false)
    renderApp('/h/h1', ANNA)
    await user.click(screen.getByRole('button', { name: 'Assigned to Tom Reid. Change' }))
    const picker = screen.getByRole('dialog', { name: 'Assign to…' })
    expect(within(picker).queryByRole('radio', { name: /Nobody yet/ })).not.toBeInTheDocument()
    await user.click(within(picker).getByRole('radio', { name: /Anna Nowak/ }))
    expect(assignOccurrence).toHaveBeenCalledWith(expect.anything(), 'h1', 'kettle0', 'u1', 'u1')
  })
})

describe('chore page', () => {
  test('details, the next times each with an assignee, and Edit for admins', async () => {
    const user = userEvent.setup()
    renderApp('/h/h1/chores/vac', ANNA)
    expect(screen.getByRole('heading', { name: 'Vacuuming' })).toBeInTheDocument()
    expect(screen.getByText('Due again 1 week after someone last did it.')).toBeInTheDocument()
    expect(screen.getByText('Under the sofa too')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Next 2 times/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /: assigned to Tom\. Change/ }))
    await user.click(within(screen.getByRole('dialog', { name: 'Assign to…' })).getByRole('radio', { name: /Nobody yet/ }))
    expect(assignOccurrence).toHaveBeenCalledWith(expect.anything(), 'h1', 'vac1', null, 'u1')
    expect(screen.getByRole('link', { name: 'Edit chore' })).toHaveAttribute('href', '/h/h1/chores/vac/edit')
  })

  test('a deleted chore says so', () => {
    chore(null)
    renderApp('/h/h1/chores/gone', ANNA)
    expect(screen.getByRole('heading', { name: 'We couldn’t find that' })).toBeInTheDocument()
  })

  test('members can’t edit repeating chores', () => {
    role(false)
    renderApp('/h/h1/chores/vac', ANNA)
    expect(screen.queryByRole('link', { name: 'Edit chore' })).not.toBeInTheDocument()
  })
})

describe('editing', () => {
  test('admin edits a repeating chore: schedule and how many to show', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/h/h1/chores/vac/edit', ANNA)
    const title = screen.getByLabelText('What needs doing?')
    expect(title).toHaveValue('Vacuuming')
    await user.clear(title)
    await user.type(title, 'Hoover')
    await user.click(within(screen.getByRole('group', { name: 'Number of upcoming times' })).getByRole('button', { name: 'Increase' }))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(updateChore).toHaveBeenCalledWith(expect.anything(), 'h1', 'vac', {
      title: 'Hoover', description: 'Under the sofa too', roomId: 'kitchen',
      rule: { kind: 'interval', every: 1, unit: 'week' }, lookahead: 3,
    }, today, 'u1')
    await waitFor(() => expect(router.state.location.pathname).toBe('/h/h1/chores/vac'))
  })

  test('admin archives a repeating chore after confirming', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/h/h1/chores/vac/edit', ANNA)
    await user.click(screen.getByRole('button', { name: 'Archive chore' }))
    expect(screen.getByRole('alertdialog', { name: 'Archive Vacuuming?' })).toHaveAccessibleDescription('Its 2 upcoming times are removed. History stays.')
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Archive' }))
    expect(archiveChore).toHaveBeenCalledWith(expect.anything(), 'h1', 'vac', 'u1')
    await waitFor(() => expect(router.state.location.pathname).toBe('/h/h1'))
  })

  test('the creator of a one-off edits and deletes it', async () => {
    const user = userEvent.setup()
    role(false)
    chore({ ...KETTLE, createdBy: 'u1', createdByName: 'Anna Nowak' })
    renderApp('/h/h1/chores/kettle/edit', ANNA)
    expect(screen.getByText('You added this one-off chore, so you can change or delete it.')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Who does it?'), 'u1')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(updateChore).toHaveBeenCalledWith(expect.anything(), 'h1', 'kettle', expect.objectContaining({ title: 'Descale the kettle', dueDate: today }), today, 'u1')
    expect(assignOccurrence).toHaveBeenCalledWith(expect.anything(), 'h1', 'kettle0', 'u1', 'u1')
  })

  test('deleting a one-off asks first', async () => {
    const user = userEvent.setup()
    chore(KETTLE)
    renderApp('/h/h1/chores/kettle/edit', ANNA)
    await user.click(screen.getByRole('button', { name: 'Delete chore' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Delete Descale the kettle?' })
    expect(dialog).toHaveAccessibleDescription('It’s removed from everyone’s list. Nothing is added to History.')
    await user.click(within(dialog).getByRole('button', { name: 'Delete chore' }))
    expect(deleteChore).toHaveBeenCalledWith(expect.anything(), 'h1', 'kettle', 'u1')
  })

  test('someone else’s one-off can’t be edited by a member', async () => {
    role(false)
    chore(KETTLE)
    const { router } = renderApp('/h/h1/chores/kettle/edit', ANNA)
    await waitFor(() => expect(router.state.location.pathname).toBe('/h/h1/chores/kettle'))
  })
})

test('New chore: pick who it’s for', async () => {
  const user = userEvent.setup()
  vi.mocked(createChore).mockResolvedValue('c1')
  role(false)
  renderApp('/h/h1/chores/new', ANNA)
  await user.type(screen.getByLabelText('What needs doing?'), 'Clean your dishes')
  await user.selectOptions(screen.getByLabelText('For'), 'tom')
  await user.click(screen.getByRole('button', { name: 'Add chore' }))
  expect(createChore).toHaveBeenCalledWith(expect.anything(), 'h1', expect.anything(), expect.objectContaining({ title: 'Clean your dishes', assigneeUid: 'tom' }))
})
