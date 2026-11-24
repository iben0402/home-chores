import { fireEvent, screen, waitFor } from '@testing-library/react'
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

describe('guards', () => {
  test('redirects signed-out users to /login?next=', () => {
    const { router } = renderApp('/h/abc/history')
    expect(router.state.location.pathname).toBe('/login')
    expect(router.state.location.search).toBe('?next=%2Fh%2Fabc%2Fhistory')
  })

  test('sends signed-in users from /login to /', () => {
    const { router } = renderApp('/login', ANNA)
    expect(router.state.location.pathname).toBe('/')
    expect(screen.getByRole('heading', { name: 'Hi Anna' })).toBeInTheDocument()
  })

  test('returns to next after login', () => {
    const { router } = renderApp('/login?next=%2Fh%2Fabc%2Fhistory', ANNA)
    expect(router.state.location.pathname).toBe('/h/abc/history')
  })

  test('never follows next to another site', async () => {
    const { router } = renderApp('/login?next=%2F%2Fevil.example', ANNA)
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })
})
