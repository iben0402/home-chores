import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { watchHousehold } from '../../data/households'
import { addRoom, deleteRoom, reorderRooms, updateRoom, watchRooms, type Room } from '../../data/rooms'
import { ANNA, renderApp } from '../../test/renderApp'

const ROOMS: Room[] = [
  { id: 'general', name: 'General', icon: 'house', order: 0, isDefault: true },
  { id: 'kitchen', name: 'Kitchen', icon: 'cooking-pot', order: 1, isDefault: false },
  { id: 'bath', name: 'Bathroom', icon: 'bath', order: 2, isDefault: false },
]

function asMember() {
  vi.mocked(watchHousehold).mockImplementation((_db, hid, cb) => {
    cb({ id: hid, name: 'Flat on Main St', adminUids: ['someone-else'] })
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
})

describe('Rooms tab', () => {
  test('shows each room; admins get Manage rooms', () => {
    renderApp('/h/h1/rooms', ANNA)
    expect(screen.getByRole('heading', { name: 'Rooms' })).toBeInTheDocument()
    expect(screen.getByText('Open chores in each room. Tap a room to see them.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Kitchen, 0 open' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Manage rooms' })).toHaveAttribute('href', '/h/h1/rooms/manage')
  })

  test('members do not see Manage rooms', () => {
    asMember()
    renderApp('/h/h1/rooms', ANNA)
    expect(screen.getByRole('button', { name: 'Kitchen, 0 open' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Manage rooms' })).not.toBeInTheDocument()
  })

  test('a room opens its page (empty for now) with Add chore to that room', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/h/h1/rooms', ANNA)
    await user.click(screen.getByRole('button', { name: 'Kitchen, 0 open' }))
    expect(router.state.location.pathname).toBe('/h/h1/rooms/kitchen')
    expect(screen.getByRole('heading', { name: 'Kitchen' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Nothing in Kitchen' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Add chore to Kitchen' })).toHaveAttribute('href', '/h/h1/chores/new?room=kitchen')
  })

  test('an unknown room says so', () => {
    renderApp('/h/h1/rooms/nope', ANNA)
    expect(screen.getByRole('heading', { name: 'We couldn’t find that' })).toBeInTheDocument()
  })
})

describe('Manage rooms', () => {
  test('members are sent back to Rooms', async () => {
    asMember()
    const { router } = renderApp('/h/h1/rooms/manage', ANNA)
    await waitFor(() => expect(router.state.location.pathname).toBe('/h/h1/rooms'))
  })

  test('General can be renamed but has no delete or reorder', () => {
    renderApp('/h/h1/rooms/manage', ANNA)
    expect(screen.getByText('Always first · can’t be deleted')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rename General' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete General' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reorder General' })).not.toBeInTheDocument()
  })

  test('add a room: name required, icon chosen', async () => {
    const user = userEvent.setup()
    vi.mocked(addRoom).mockResolvedValue('hall')
    renderApp('/h/h1/rooms/manage', ANNA)
    await user.click(screen.getByRole('button', { name: 'Add a room' }))
    const sheet = screen.getByRole('dialog', { name: 'Add a room' })
    expect(sheet).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add room' }))
    expect(screen.getByLabelText('Room name')).toHaveAccessibleDescription('Give the room a name.')
    await user.type(screen.getByLabelText('Room name'), 'Hallway')
    await user.click(screen.getByRole('radio', { name: 'Bath' }))
    await user.click(screen.getByRole('button', { name: 'Add room' }))
    expect(addRoom).toHaveBeenCalledWith(expect.anything(), 'h1', { name: 'Hallway', icon: 'bath' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  test('rename General shows its hint and saves', async () => {
    const user = userEvent.setup()
    vi.mocked(updateRoom).mockResolvedValue()
    renderApp('/h/h1/rooms/manage', ANNA)
    await user.click(screen.getByRole('button', { name: 'Rename General' }))
    const input = screen.getByLabelText('Room name')
    expect(input).toHaveValue('General')
    expect(input).toHaveAccessibleDescription('General can’t be deleted. Chores from deleted rooms move here.')
    await user.clear(input)
    await user.type(input, 'Everywhere')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(updateRoom).toHaveBeenCalledWith(expect.anything(), 'h1', 'general', { name: 'Everywhere' })
  })

  test('delete asks first', async () => {
    const user = userEvent.setup()
    vi.mocked(deleteRoom).mockResolvedValue()
    renderApp('/h/h1/rooms/manage', ANNA)
    await user.click(screen.getByRole('button', { name: 'Delete Kitchen' }))
    expect(screen.getByRole('alertdialog', { name: 'Delete Kitchen?' })).toHaveAccessibleDescription('It has no chores.')
    expect(deleteRoom).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Delete room' }))
    expect(deleteRoom).toHaveBeenCalledWith(expect.anything(), 'h1', 'kitchen')
  })

  test('keyboard reorder moves, saves and announces', async () => {
    const user = userEvent.setup()
    vi.mocked(reorderRooms).mockResolvedValue()
    renderApp('/h/h1/rooms/manage', ANNA)
    screen.getByRole('button', { name: 'Reorder Bathroom' }).focus()
    await user.keyboard('{ArrowUp}')
    expect(reorderRooms).toHaveBeenCalledWith(expect.anything(), 'h1', ['bath', 'kitchen'])
    expect(screen.getByText('Bathroom, moved to position 2 of 3.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reorder Bathroom' })).toHaveFocus()
  })
})
