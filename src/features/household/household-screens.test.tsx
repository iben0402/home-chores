import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { signOut, updateDisplayName } from '../../data/auth'
import {
  regenerateInviteCode,
  removeMember,
  renameHousehold,
  setAdmin,
  updateMyName,
  watchHousehold,
  watchMembers,
  watchMembership,
  watchMyHouseholds,
} from '../../data/households'
import { ANNA, renderApp } from '../../test/renderApp'

vi.mock('../../data/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/auth')>()),
  signOut: vi.fn(),
  updateDisplayName: vi.fn(),
}))

const joined = new Date(2026, 8, 3)
function household(adminUids: string[]) {
  vi.mocked(watchHousehold).mockImplementation((_db, hid, cb) => {
    cb({ id: hid, name: 'Flat on Main St', adminUids })
    return () => {}
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  household(['u1', 'maja'])
  vi.mocked(watchMembers).mockImplementation((_db, _hid, cb) => {
    cb([
      { uid: 'u1', displayName: 'Anna Nowak', color: 1, joinedAt: joined },
      { uid: 'maja', displayName: 'Maja Lis', color: 2, joinedAt: joined },
      { uid: 'tom', displayName: 'Tom Reid', color: 3, joinedAt: new Date(2026, 9, 1) },
    ])
    return () => {}
  })
  vi.mocked(watchMyHouseholds).mockImplementation((_db, _uid, cb) => {
    cb([
      { id: 'h1', name: 'Flat on Main St', adminUids: ['u1'] },
      { id: 'h2', name: 'The Nowaks', adminUids: ['mum'] },
    ])
    return () => {}
  })
  for (const fn of [removeMember, setAdmin, renameHousehold, updateMyName, updateDisplayName, signOut]) vi.mocked(fn).mockResolvedValue(undefined as never)
  vi.mocked(regenerateInviteCode).mockResolvedValue('NEWCODE2')
})

describe('Household tab', () => {
  test('people with roles, the invite, your account', () => {
    renderApp('/h/h1/household', ANNA)
    expect(screen.getByRole('heading', { name: 'Household' })).toBeInTheDocument()
    // Its own title bar, as designed (no household header above it).
    expect(screen.queryByRole('button', { name: /Switch household/ })).not.toBeInTheDocument()
    expect(screen.getByText(/^Flat on Main St · 3 people · 1 room$/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Your account/ })).toHaveAttribute('href', '/account')
    const people = screen.getByRole('list', { name: 'People' })
    expect(within(people).getAllByRole('listitem')).toHaveLength(3)
    expect(within(people).getByText('(you)')).toBeInTheDocument()
    expect(within(people).getAllByText('Admin')).toHaveLength(2)
    expect(screen.getByLabelText('Invite code: K 7 Q M 4 X R T')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Get a new code' })).toBeInTheDocument()
  })

  test('admin: make Tom an admin, then remove him (asks first)', async () => {
    const user = userEvent.setup()
    renderApp('/h/h1/household', ANNA)
    await user.click(screen.getByRole('button', { name: 'Options for Tom Reid' }))
    await user.click(screen.getByRole('button', { name: 'Make admin' }))
    expect(setAdmin).toHaveBeenCalledWith(expect.anything(), 'h1', 'tom', true)
    await user.click(screen.getByRole('button', { name: 'Options for Tom Reid' }))
    await user.click(screen.getByRole('button', { name: 'Remove from household' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Remove Tom from the household?' })
    expect(dialog).toHaveAccessibleDescription('Tom’s open chores become unassigned. Their history stays.')
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }))
    expect(removeMember).toHaveBeenCalledWith(expect.anything(), 'h1', 'tom', 'u1')
  })

  test('admin renames the household and gets a new code', async () => {
    const user = userEvent.setup()
    renderApp('/h/h1/household', ANNA)
    await user.click(screen.getByRole('button', { name: 'Rename household' }))
    const name = screen.getByLabelText('Household name')
    await user.clear(name)
    await user.type(name, 'The Nowaks')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(renameHousehold).toHaveBeenCalledWith(expect.anything(), 'h1', 'The Nowaks')
    await user.click(screen.getByRole('button', { name: 'Get a new code' }))
    expect(screen.getByRole('alertdialog', { name: 'Get a new invite code?' })).toHaveAccessibleDescription('The old code and link stop working. Anyone who hasn’t joined yet will need the new one.')
    await user.click(screen.getByRole('button', { name: 'Get new code' }))
    expect(regenerateInviteCode).toHaveBeenCalledWith(expect.anything(), 'h1', 'u1')
  })

  test('members see no admin controls and can leave', async () => {
    const user = userEvent.setup()
    household(['maja'])
    const { router } = renderApp('/h/h1/household', ANNA)
    expect(screen.queryByRole('button', { name: 'Rename household' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Options for/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Get a new code' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Leave household' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Leave Flat on Main St?' })
    expect(dialog).toHaveAccessibleDescription('Your open chores become unassigned. Your history stays. To come back, you’ll need a new invite.')
    await user.click(within(dialog).getByRole('button', { name: 'Leave' }))
    expect(removeMember).toHaveBeenCalledWith(expect.anything(), 'h1', 'u1', 'u1')
    await waitFor(() => expect(router.state.location.pathname).not.toMatch(/^\/h\/h1/))
  })

  test('the only admin can’t leave', () => {
    household(['u1'])
    renderApp('/h/h1/household', ANNA)
    expect(screen.getByRole('button', { name: 'Leave household' })).toBeDisabled()
    expect(screen.getByText('You’re the only admin.')).toBeInTheDocument()
  })
})

describe('Your account', () => {
  test('change your name everywhere; log out', async () => {
    const user = userEvent.setup()
    renderApp('/account', ANNA)
    expect(screen.getByText('You’re in 2 households. Your name is the same in each.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save name' })).toBeDisabled()
    const name = screen.getByLabelText('Your name')
    await user.clear(name)
    await user.type(name, 'Anna N.')
    await user.click(screen.getByRole('button', { name: 'Save name' }))
    expect(updateDisplayName).toHaveBeenCalledWith('Anna N.')
    expect(updateMyName).toHaveBeenCalledWith(expect.anything(), 'u1', 'Anna N.', ['h1', 'h2'])
    await user.click(screen.getByRole('button', { name: 'Log out' }))
    expect(signOut).toHaveBeenCalled()
  })
})

test('Your account: appearance (system / light / dark)', async () => {
  const user = userEvent.setup()
  localStorage.clear()
  renderApp('/account', ANNA)
  const group = screen.getByRole('radiogroup', { name: 'Appearance' })
  expect(within(group).getByRole('radio', { name: 'System' })).toBeChecked()
  await user.click(within(group).getByRole('radio', { name: 'Dark' }))
  expect(document.documentElement.dataset.theme).toBe('dark')
  expect(localStorage.getItem('theme')).toBe('dark')
})

describe('switcher', () => {
  test('lists your households with your role and switches', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/h/h1', ANNA)
    await user.click(screen.getByRole('button', { name: 'Household: Flat on Main St. Switch household' }))
    const sheet = screen.getByRole('dialog', { name: 'Your households' })
    expect(within(sheet).getByRole('radio', { name: /Flat on Main St/ })).toBeChecked()
    expect(within(sheet).getByRole('radio', { name: /The Nowaks/ })).toHaveTextContent('Member')
    expect(within(sheet).getByRole('link', { name: 'Create or join another household' })).toHaveAttribute('href', '/start')
    await user.click(within(sheet).getByRole('radio', { name: /The Nowaks/ }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/h/h2'))
  })
})

test('removed while using it: says so, offers your other household', async () => {
  let report: (member: boolean) => void = () => {}
  vi.mocked(watchMembership).mockImplementation((_db, _hid, _uid, cb) => {
    report = cb
    cb(true)
    return () => {}
  })
  renderApp('/h/h1', ANNA)
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument())
  const { act } = await import('@testing-library/react')
  act(() => report(false))
  expect(await screen.findByRole('heading', { name: 'You’re no longer in Flat on Main St' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Go to The Nowaks' })).toHaveAttribute('href', '/h/h2')
})
