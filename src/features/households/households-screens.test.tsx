import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { updateDisplayName } from '../../data/auth'
import {
  createHousehold,
  findInvite,
  getHouseholdPreview,
  isMember,
  joinHousehold,
  watchMembership,
  watchMyHouseholds,
} from '../../data/households'
import { ANNA, renderApp } from '../../test/renderApp'

vi.mock('../../data/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/auth')>()),
  updateDisplayName: vi.fn(),
  signOut: vi.fn(),
  signInWithGoogle: vi.fn(),
}))

const households = (...ids: string[]) =>
  vi.mocked(watchMyHouseholds).mockImplementation((_db, _uid, cb) => {
    cb(ids.map((id) => ({ id, name: `Home ${id}` })))
    return () => {}
  })

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  // Restore the calm defaults (mockImplementation from an earlier test would otherwise persist).
  households()
  vi.mocked(watchMembership).mockImplementation((_db, _hid, _uid, cb) => {
    cb(true)
    return () => {}
  })
})

describe('where / goes', () => {
  test('no households → Get started', async () => {
    const { router } = renderApp('/', ANNA)
    await waitFor(() => expect(router.state.location.pathname).toBe('/start'))
    expect(screen.getByRole('heading', { name: 'Hi Anna' })).toBeInTheDocument()
  })

  test('the last-used household, if you are still in it', async () => {
    households('h1', 'h2')
    localStorage.setItem('chours:lastHousehold', 'h2')
    const { router } = renderApp('/', ANNA)
    await waitFor(() => expect(router.state.location.pathname).toBe('/h/h2'))
  })

  test('otherwise the first household', async () => {
    households('h1', 'h2')
    localStorage.setItem('chours:lastHousehold', 'gone')
    const { router } = renderApp('/', ANNA)
    await waitFor(() => expect(router.state.location.pathname).toBe('/h/h1'))
  })
})

describe('Get started', () => {
  test('shows both choices', () => {
    renderApp('/start', ANNA)
    expect(screen.getByRole('link', { name: /Create a household/ })).toHaveAttribute('href', '/households/new')
    expect(screen.getByRole('link', { name: /Join with a code/ })).toHaveAttribute('href', '/join')
    expect(screen.getByText('Got an invite link instead? Open it on this phone and you’ll join straight away.')).toBeInTheDocument()
  })

  test('asks for a name first when the account has none', async () => {
    const user = userEvent.setup()
    vi.mocked(updateDisplayName).mockResolvedValue()
    renderApp('/start', { ...ANNA, displayName: null })
    expect(screen.getByRole('heading', { name: 'What should we call you?' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.getByLabelText('Your name')).toHaveAccessibleDescription('Add your name so your household knows who’s who.')
    await user.type(screen.getByLabelText('Your name'), 'Anna Nowak')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(updateDisplayName).toHaveBeenCalledWith('Anna Nowak')
  })
})

describe('Create a household', () => {
  test('empty name shows the error', async () => {
    const user = userEvent.setup()
    renderApp('/households/new', ANNA)
    await user.click(screen.getByRole('button', { name: 'Create household' }))
    expect(screen.getByLabelText('Household name')).toHaveAccessibleDescription('Give your household a name.')
    expect(createHousehold).not.toHaveBeenCalled()
  })

  test('creates it and goes to its Today', async () => {
    const user = userEvent.setup()
    vi.mocked(createHousehold).mockResolvedValue('h9')
    const { router } = renderApp('/households/new', ANNA)
    await user.type(screen.getByLabelText('Household name'), 'The Nowaks')
    await user.click(screen.getByRole('button', { name: 'Create household' }))
    expect(createHousehold).toHaveBeenCalledWith(expect.anything(), { uid: 'u1', displayName: 'Anna Nowak' }, 'The Nowaks')
    await waitFor(() => expect(router.state.location.pathname).toBe('/h/h9'))
  })
})

describe('Join with a code', () => {
  async function enter(code: string) {
    const user = userEvent.setup()
    const view = renderApp('/join', ANNA)
    expect(screen.getByRole('button', { name: 'Join' })).toBeDisabled()
    await user.type(screen.getByLabelText('Invite code'), code)
    await user.click(screen.getByRole('button', { name: 'Join' }))
    return view
  }

  test('not found', async () => {
    vi.mocked(findInvite).mockResolvedValue({ status: 'not-found' })
    await enter('k7qm4xrb')
    expect(await screen.findByText('That code doesn’t match a household. Check it with whoever sent it.')).toBeInTheDocument()
    expect(findInvite).toHaveBeenCalledWith(expect.anything(), 'K7QM4XRB')
  })

  test('replaced', async () => {
    vi.mocked(findInvite).mockResolvedValue({ status: 'replaced' })
    await enter('K7QM4XRT')
    expect(await screen.findByText('That code has been replaced with a new one. Ask for the latest code.')).toBeInTheDocument()
  })

  test('ok → the invite page for that code', async () => {
    vi.mocked(findInvite).mockResolvedValue({ status: 'ok', householdId: 'h1', householdName: 'Flat on Main St' })
    vi.mocked(isMember).mockResolvedValue(false)
    vi.mocked(getHouseholdPreview).mockResolvedValue({ name: 'Flat on Main St', members: [] })
    const { router } = await enter('K7QM-4XRT')
    await waitFor(() => expect(router.state.location.pathname).toBe('/join/K7QM4XRT'))
  })
})

describe('Invite link /join/:code', () => {
  beforeEach(() => vi.mocked(findInvite).mockResolvedValue({ status: 'ok', householdId: 'h1', householdName: 'Flat on Main St' }))

  test('signed out: shows who invited you and keeps the way back', async () => {
    renderApp('/join/K7QM4XRT')
    expect(await screen.findByRole('heading', { name: 'Flat on Main St' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Log in with email' })).toHaveAttribute('href', '/login?next=%2Fjoin%2FK7QM4XRT')
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/signup?next=%2Fjoin%2FK7QM4XRT')
  })

  test('already a member goes straight to Today', async () => {
    vi.mocked(isMember).mockResolvedValue(true)
    const { router } = renderApp('/join/K7QM4XRT', ANNA)
    await waitFor(() => expect(router.state.location.pathname).toBe('/h/h1'))
    expect(joinHousehold).not.toHaveBeenCalled()
  })

  test('confirm, join, then Today', async () => {
    const user = userEvent.setup()
    vi.mocked(isMember).mockResolvedValue(false)
    vi.mocked(getHouseholdPreview).mockResolvedValue({
      name: 'Flat on Main St',
      members: [
        { uid: 't', displayName: 'Tom Reid', color: 1, admin: true },
        { uid: 'm', displayName: 'Maja Lis', color: 2, admin: false },
      ],
    })
    vi.mocked(joinHousehold).mockResolvedValue()
    const { router } = renderApp('/join/K7QM4XRT', ANNA)
    expect(await screen.findByRole('heading', { name: 'Join Flat on Main St?' })).toBeInTheDocument()
    expect(screen.getByText('2 people are in this household.')).toBeInTheDocument()
    expect(screen.getByText('As a member you can take, assign and tick off chores. Tom looks after the household settings.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Join household' }))
    expect(joinHousehold).toHaveBeenCalledWith(expect.anything(), { uid: 'u1', displayName: 'Anna Nowak' }, 'K7QM4XRT', 'h1')
    await waitFor(() => expect(router.state.location.pathname).toBe('/h/h1'))
  })

  test('a replaced code shows the code screen with the error', async () => {
    vi.mocked(findInvite).mockResolvedValue({ status: 'replaced' })
    renderApp('/join/K7QM4XRT', ANNA)
    expect(await screen.findByText('That code has been replaced with a new one. Ask for the latest code.')).toBeInTheDocument()
    expect(screen.getByLabelText('Invite code')).toHaveValue('K7QM-4XRT')
  })
})

describe('Today for a new household', () => {
  test('Invite people opens the sheet with the code', async () => {
    const user = userEvent.setup()
    renderApp('/h/h1', ANNA)
    expect(screen.getByText('Flat on Main St')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Your household is ready' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Invite people' }))
    expect(screen.getByRole('dialog', { name: 'Invite someone' })).toBeInTheDocument()
    expect(screen.getByLabelText('Invite code: K 7 Q M 4 X R T')).toBeInTheDocument()
    expect(localStorage.getItem('chours:lastHousehold')).toBe('h1')
  })

  test('sent away from a household, / does not send you straight back to it', async () => {
    households('h1', 'h2')
    vi.mocked(watchMembership).mockImplementation((_db, hid, _uid, cb) => {
      cb(hid !== 'h1')
      return () => {}
    })
    localStorage.setItem('chours:lastHousehold', 'h1')
    const { router } = renderApp('/h/h1', ANNA)
    await waitFor(() => expect(router.state.location.pathname).toBe('/h/h2'))
  })

  test('someone who is not a member is sent home', async () => {
    vi.mocked(watchMembership).mockImplementation((_db, _hid, _uid, cb) => {
      cb(false)
      return () => {}
    })
    const { router } = renderApp('/h/h1', ANNA)
    await waitFor(() => expect(router.state.location.pathname).not.toMatch(/^\/h\//))
  })
})
