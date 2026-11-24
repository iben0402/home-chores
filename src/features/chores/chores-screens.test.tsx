import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { completeOccurrence, createChore, takeOccurrence, undoCompletion, watchOpenOccurrences, type Occurrence } from '../../data/chores'
import { watchHousehold, watchMembers } from '../../data/households'
import { watchRooms, type Room } from '../../data/rooms'
import { addDays, todayISO } from '../../lib/schedule'
import { ANNA, renderApp } from '../../test/renderApp'

const today = todayISO()
const ROOMS: Room[] = [
  { id: 'general', name: 'General', icon: 'house', order: 0, isDefault: true },
  { id: 'kitchen', name: 'Kitchen', icon: 'cooking-pot', order: 1, isDefault: false },
]
const occ = (o: Partial<Occurrence> & { id: string; choreId: string; choreTitle: string; dueDate: string }): Occurrence => ({
  roomId: 'kitchen',
  kind: 'interval',
  seq: 0,
  status: 'open',
  assigneeUid: null,
  createdBy: 'u1',
  createdByName: 'Anna Nowak',
  ...o,
})
const OCCURRENCES = [
  occ({ id: 'bins1', choreId: 'bins', choreTitle: 'Bins out', dueDate: addDays(today, -1), roomId: 'general', assigneeUid: 'tom' }),
  occ({ id: 'dish', choreId: 'dish', choreTitle: 'Clean your dishes in the sink', dueDate: today, kind: 'oneoff', assigneeUid: 'u1', createdBy: 'tom', createdByName: 'Tom Reid' }),
  occ({ id: 'vac1', choreId: 'vac', choreTitle: 'Vacuuming', dueDate: addDays(today, 10) }),
]

function withChores(list = OCCURRENCES) {
  vi.mocked(watchOpenOccurrences).mockImplementation((_db, _hid, cb) => {
    cb(list)
    return () => {}
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(watchHousehold).mockImplementation((_db, hid, cb) => {
    cb({ id: hid, name: 'Flat on Main St', adminUids: ['u1'] })
    return () => {}
  })
  vi.mocked(watchRooms).mockImplementation((_db, _hid, cb) => {
    cb(ROOMS)
    return () => {}
  })
  vi.mocked(watchMembers).mockImplementation((_db, _hid, cb) => {
    cb([
      { uid: 'u1', displayName: 'Anna Nowak', color: 1 },
      { uid: 'tom', displayName: 'Tom Reid', color: 2 },
    ])
    return () => {}
  })
  withChores([])
})

describe('Today', () => {
  test('no chores yet: the new-household empty state', () => {
    renderApp('/h/h1', ANNA)
    expect(screen.getByRole('heading', { name: 'Your household is ready' })).toBeInTheDocument()
  })

  test('sections, filters with counts, who raised a one-off, Take it', () => {
    withChores()
    renderApp('/h/h1', ANNA)
    expect(screen.getByRole('radio', { name: /Everyone/ })).toHaveTextContent('Everyone3')
    expect(screen.getByRole('heading', { name: /Overdue · 1/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Today · 1/ })).toBeInTheDocument()
    expect(screen.getByText('from Tom')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Take it: Vacuuming' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'New chore' })).toHaveAttribute('href', '/h/h1/chores/new')
  })

  test('Mine shows only what is assigned to you', async () => {
    const user = userEvent.setup()
    withChores()
    renderApp('/h/h1', ANNA)
    await user.click(screen.getByRole('radio', { name: /Mine/ }))
    expect(screen.getByText('Clean your dishes in the sink')).toBeInTheDocument()
    expect(screen.queryByText('Vacuuming')).not.toBeInTheDocument()
  })

  test('tick off: done by you, with Undo', async () => {
    const user = userEvent.setup()
    withChores()
    const token = { occurrenceId: 'vac1', choreId: 'vac', previousDates: [], toppedUpId: 't', previousLastDoneAt: null }
    vi.mocked(completeOccurrence).mockResolvedValue(token)
    vi.mocked(undoCompletion).mockResolvedValue()
    renderApp('/h/h1', ANNA)
    await user.click(screen.getByRole('checkbox', { name: 'Mark done: Vacuuming' }))
    expect(completeOccurrence).toHaveBeenCalledWith(expect.anything(), 'h1', 'vac1', { uid: 'u1', displayName: 'Anna Nowak' }, today)
    expect(await screen.findByText('Vacuuming — done')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(undoCompletion).toHaveBeenCalledWith(expect.anything(), 'h1', token)
  })

  test('Take it assigns to you', async () => {
    const user = userEvent.setup()
    withChores()
    vi.mocked(takeOccurrence).mockResolvedValue()
    renderApp('/h/h1', ANNA)
    await user.click(screen.getByRole('button', { name: 'Take it: Vacuuming' }))
    expect(takeOccurrence).toHaveBeenCalledWith(expect.anything(), 'h1', 'vac1', 'u1')
    expect(await screen.findByText('You took Vacuuming')).toBeInTheDocument()
  })
})

describe('New chore', () => {
  test('member: a one-off, room preselected from the link', async () => {
    const user = userEvent.setup()
    vi.mocked(watchHousehold).mockImplementation((_db, hid, cb) => {
      cb({ id: hid, name: 'Flat on Main St', adminUids: ['tom'] })
      return () => {}
    })
    vi.mocked(createChore).mockResolvedValue('c1')
    const { router } = renderApp('/h/h1/chores/new?room=kitchen', ANNA)
    expect(screen.queryByRole('radiogroup', { name: 'How often' })).not.toBeInTheDocument()
    expect(screen.getByText(/Repeating chores are set up by an admin/)).toBeInTheDocument()
    expect(screen.getByLabelText('Room')).toHaveValue('kitchen')
    await user.click(screen.getByRole('button', { name: 'Add chore' }))
    expect(screen.getByLabelText('What needs doing?')).toHaveAccessibleDescription('Say what needs doing.')
    await user.type(screen.getByLabelText('What needs doing?'), 'Clean your dishes in the sink')
    await user.click(screen.getByRole('button', { name: 'Add chore' }))
    expect(createChore).toHaveBeenCalledWith(expect.anything(), 'h1', { uid: 'u1', displayName: 'Anna Nowak' }, {
      title: 'Clean your dishes in the sink',
      description: '',
      roomId: 'kitchen',
      rule: { kind: 'oneoff' },
      startISO: today,
    })
    await waitFor(() => expect(router.state.location.pathname).toBe('/h/h1'))
  })

  test('admin: a repeating chore from the schedule editor', async () => {
    const user = userEvent.setup()
    vi.mocked(createChore).mockResolvedValue('c2')
    renderApp('/h/h1/chores/new', ANNA)
    await user.type(screen.getByLabelText('What needs doing?'), 'Bins out')
    await user.click(screen.getByRole('radio', { name: 'On set days' }))
    await user.click(screen.getByRole('button', { name: 'Add repeating chore' }))
    expect(createChore).toHaveBeenCalledWith(expect.anything(), 'h1', expect.anything(), expect.objectContaining({
      title: 'Bins out',
      roomId: 'general',
      rule: { kind: 'calendar', freq: 'weekly', weekdays: [1] },
      startISO: today,
    }))
  })
})

describe('Rooms with chores', () => {
  test('cards count open and overdue chores; the room lists its chores', async () => {
    const user = userEvent.setup()
    withChores()
    renderApp('/h/h1/rooms', ANNA)
    expect(screen.getByRole('button', { name: 'General, 1 open, 1 overdue' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Kitchen, 2 open' }))
    expect(screen.getByText('2 open')).toBeInTheDocument()
    const list = screen.getAllByRole('list')
    expect(within(list[0]).getByText('Clean your dishes in the sink')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Add chore' })).toHaveAttribute('href', '/h/h1/chores/new?room=kitchen')
  })

  test('deleting a room says how many chores move', async () => {
    const user = userEvent.setup()
    withChores()
    renderApp('/h/h1/rooms/manage', ANNA)
    expect(screen.getByText('2 chores')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Delete Kitchen' }))
    expect(screen.getByRole('alertdialog', { name: 'Delete Kitchen?' })).toHaveAccessibleDescription('Its 2 chores move to General. Their history stays.')
  })
})
