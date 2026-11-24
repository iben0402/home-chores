import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { sendReset, signIn, signInWithGoogle, signUp } from '../../data/auth'
import { ANNA, renderApp } from '../../test/renderApp'

vi.mock('../../data/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/auth')>()),
  signIn: vi.fn(),
  signUp: vi.fn(),
  signInWithGoogle: vi.fn(),
  sendReset: vi.fn(),
  signOut: vi.fn(),
}))

const fail = (code: string) => Object.assign(new Error(code), { code })

beforeEach(() => vi.clearAllMocks())

describe('Log in', () => {
  test('submits email and password', async () => {
    const user = userEvent.setup()
    vi.mocked(signIn).mockResolvedValue()
    renderApp('/login')
    await user.type(screen.getByLabelText('Email'), 'anna@example.com')
    await user.type(screen.getByLabelText('Password', { selector: 'input' }), 'kitchen-24')
    await user.click(screen.getByRole('button', { name: 'Log in' }))
    expect(signIn).toHaveBeenCalledWith('anna@example.com', 'kitchen-24')
  })

  test('shows mapped error under password', async () => {
    const user = userEvent.setup()
    vi.mocked(signIn).mockRejectedValue(fail('auth/invalid-credential'))
    renderApp('/login')
    await user.type(screen.getByLabelText('Email'), 'anna@example.com')
    await user.type(screen.getByLabelText('Password', { selector: 'input' }), 'wrong')
    await user.click(screen.getByRole('button', { name: 'Log in' }))
    expect(await screen.findByLabelText('Password', { selector: 'input' })).toHaveAccessibleDescription(
      'That email and password don’t match.',
    )
  })

  test('ignores a second submit while logging in', async () => {
    const user = userEvent.setup()
    vi.mocked(signIn).mockReturnValue(new Promise(() => {}))
    renderApp('/login')
    await user.type(screen.getByLabelText('Email'), 'anna@example.com')
    await user.type(screen.getByLabelText('Password', { selector: 'input' }), 'kitchen-24')
    const form = screen.getByRole('form', { name: 'Log in' })
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(signIn).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: /Logging in/ })).toHaveAttribute('aria-busy', 'true')
  })

  test('empty fields show errors and do not call signIn', async () => {
    const user = userEvent.setup()
    renderApp('/login')
    await user.click(screen.getByRole('button', { name: 'Log in' }))
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Enter your email.')
    expect(signIn).not.toHaveBeenCalled()
  })

  test('Google cancel shows the form message', async () => {
    const user = userEvent.setup()
    vi.mocked(signInWithGoogle).mockRejectedValue(fail('auth/popup-closed-by-user'))
    renderApp('/login')
    await user.click(screen.getByRole('button', { name: 'Continue with Google' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Google sign-in didn’t finish. Try again, or use your email.')
    expect(screen.getByRole('button', { name: 'Continue with Google' })).not.toHaveAttribute('aria-busy')
  })
})

describe('Log in: focus and Google', () => {
  test('a form submit replaces a pending Google popup, and the late popup error is ignored', async () => {
    const user = userEvent.setup()
    let rejectGoogle!: (error: unknown) => void
    vi.mocked(signInWithGoogle).mockReturnValue(new Promise((_, reject) => (rejectGoogle = reject)))
    vi.mocked(signIn).mockReturnValue(new Promise(() => {}))
    renderApp('/login')
    await user.click(screen.getByRole('button', { name: 'Continue with Google' }))
    await user.type(screen.getByLabelText('Email'), 'anna@example.com')
    await user.type(screen.getByLabelText('Password', { selector: 'input' }), 'kitchen-24')
    await user.click(screen.getByRole('button', { name: 'Log in' }))
    expect(signIn).toHaveBeenCalledWith('anna@example.com', 'kitchen-24')
    await act(async () => rejectGoogle(fail('auth/popup-closed-by-user')))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Logging in/ })).toHaveAttribute('aria-busy', 'true')
  })

  test('a request error moves focus to the field it belongs to', async () => {
    const user = userEvent.setup()
    vi.mocked(signIn).mockRejectedValue(fail('auth/invalid-credential'))
    renderApp('/login')
    await user.type(screen.getByLabelText('Email'), 'anna@example.com')
    await user.type(screen.getByLabelText('Password', { selector: 'input' }), 'wrong')
    await user.click(screen.getByRole('button', { name: 'Log in' }))
    await waitFor(() => expect(screen.getByLabelText('Password', { selector: 'input' })).toHaveFocus())
  })

  test('validation errors move focus to the first invalid field', async () => {
    const user = userEvent.setup()
    renderApp('/login')
    await user.click(screen.getByRole('button', { name: 'Log in' }))
    expect(screen.getByLabelText('Email')).toHaveFocus()
  })
})

describe('Create account', () => {
  test('empty name shows the name error and does not call signUp', async () => {
    const user = userEvent.setup()
    renderApp('/signup')
    await user.type(screen.getByLabelText('Email'), 'anna@example.com')
    await user.type(screen.getByLabelText('Password', { selector: 'input' }), 'kitchen-24')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(screen.getByLabelText('Your name')).toHaveAccessibleDescription('Add your name so your household knows who’s who.')
    expect(signUp).not.toHaveBeenCalled()
  })

  test('short password shows the password error', async () => {
    const user = userEvent.setup()
    renderApp('/signup')
    await user.type(screen.getByLabelText('Your name'), 'Anna')
    await user.type(screen.getByLabelText('Email'), 'anna@example.com')
    await user.type(screen.getByLabelText('Password', { selector: 'input' }), 'kot')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(screen.getByLabelText('Password', { selector: 'input' })).toHaveAccessibleDescription('Use at least 6 characters.')
    expect(signUp).not.toHaveBeenCalled()
  })

  test('email in use shows Log in instead link', async () => {
    const user = userEvent.setup()
    vi.mocked(signUp).mockRejectedValue(fail('auth/email-already-in-use'))
    renderApp('/signup')
    await user.type(screen.getByLabelText('Your name'), 'Anna Nowak')
    await user.type(screen.getByLabelText('Email'), 'anna@example.com')
    await user.type(screen.getByLabelText('Password', { selector: 'input' }), 'kitchen-24')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(signUp).toHaveBeenCalledWith({ name: 'Anna Nowak', email: 'anna@example.com', password: 'kitchen-24' })
    expect(await screen.findByLabelText('Email')).toHaveAccessibleDescription('There’s already an account with this email.')
    expect(screen.getByRole('link', { name: 'Log in instead' })).toHaveAttribute('href', '/login')
  })
})

describe('Create account: no early redirect', () => {
  test('stays on /signup until sign-up finishes, then goes to next', async () => {
    const user = userEvent.setup()
    let finish!: () => void
    vi.mocked(signUp).mockReturnValue(new Promise<void>((resolve) => (finish = resolve)))
    const { router, setUser } = renderApp('/signup?next=%2Fh%2Fabc')
    await user.type(screen.getByLabelText('Your name'), 'Anna Nowak')
    await user.type(screen.getByLabelText('Email'), 'anna@example.com')
    await user.type(screen.getByLabelText('Password', { selector: 'input' }), 'kitchen-24')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    // Firebase reports the new user before the name is saved.
    setUser({ ...ANNA, displayName: null })
    expect(router.state.location.pathname).toBe('/signup')
    await act(async () => finish())
    await waitFor(() => expect(router.state.location.pathname).toBe('/h/abc'))
  })

  test('a signed-in visitor to /signup is sent on (via / to Get started)', async () => {
    const { router } = renderApp('/signup', ANNA)
    await waitFor(() => expect(router.state.location.pathname).toBe('/start'))
  })
})

describe('Forgot password', () => {
  test('shows the sent state after sending', async () => {
    const user = userEvent.setup()
    vi.mocked(sendReset).mockResolvedValue()
    renderApp('/forgot')
    await user.type(screen.getByLabelText('Email'), 'anna@example.com')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))
    expect(sendReset).toHaveBeenCalledWith('anna@example.com')
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument()
  })
})

describe('Forgot password: follow-ups', () => {
  test('keeps ?next= on the way back to log in', () => {
    renderApp('/forgot?next=%2Fjoin%2FK7QM4XRT')
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login?next=%2Fjoin%2FK7QM4XRT')
  })

  test('a failed resend is shown, a successful one is confirmed', async () => {
    const user = userEvent.setup()
    vi.mocked(sendReset).mockResolvedValueOnce()
    renderApp('/forgot')
    await user.type(screen.getByLabelText('Email'), 'anna@example.com')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))
    await screen.findByRole('heading', { name: 'Check your email' })
    vi.mocked(sendReset).mockRejectedValueOnce(fail('auth/too-many-requests'))
    await user.click(screen.getByRole('button', { name: 'Send it again' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts. Wait a minute and try again.')
    vi.mocked(sendReset).mockResolvedValueOnce()
    await user.click(screen.getByRole('button', { name: 'Send it again' }))
    expect(await screen.findByText('Sent again.')).toBeInTheDocument()
  })
})

describe('Back button', () => {
  test('opened directly, Back goes to log in instead of leaving the app', async () => {
    const user = userEvent.setup()
    // The tab has history from other sites before landing here.
    vi.spyOn(window.history, 'length', 'get').mockReturnValue(3)
    const { router } = renderApp('/signup')
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(router.state.location.pathname).toBe('/login')
  })
})

describe('guards', () => {
  test('redirects signed-out users to /login?next=', () => {
    const { router } = renderApp('/h/abc/history')
    expect(router.state.location.pathname).toBe('/login')
    expect(router.state.location.search).toBe('?next=%2Fh%2Fabc%2Fhistory')
  })

  test('sends signed-in users from /login to / (which opens Get started without households)', async () => {
    const { router } = renderApp('/login', ANNA)
    await waitFor(() => expect(router.state.location.pathname).toBe('/start'))
    expect(screen.getByRole('heading', { name: 'Hi Anna' })).toBeInTheDocument()
  })

  test('returns to next after login', () => {
    const { router } = renderApp('/login?next=%2Fh%2Fabc%2Fhistory', ANNA)
    expect(router.state.location.pathname).toBe('/h/abc/history')
  })

  test('never follows next to another site', async () => {
    const { router } = renderApp('/login?next=%2F%2Fevil.example', ANNA)
    await waitFor(() => expect(router.state.location.pathname).toBe('/start'))
    expect(router.state.location.pathname + router.state.location.search).not.toContain('evil')
  })
})
