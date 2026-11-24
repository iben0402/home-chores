import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { authErrorMessage, signUp } from './auth'

vi.mock('../lib/firebase', () => ({ auth: { currentUser: null } }))
vi.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: vi.fn(),
  updateProfile: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signOut: vi.fn(),
  GoogleAuthProvider: vi.fn(),
}))

describe('authErrorMessage', () => {
  test.each([
    ['auth/invalid-credential', 'password', 'That email and password don’t match.'],
    ['auth/wrong-password', 'password', 'That email and password don’t match.'],
    ['auth/user-not-found', 'password', 'That email and password don’t match.'],
    ['auth/invalid-email', 'email', 'Enter an email address like you@example.com.'],
    ['auth/email-already-in-use', 'email', 'There’s already an account with this email.'],
    ['auth/weak-password', 'password', 'Use at least 6 characters.'],
    ['auth/popup-closed-by-user', 'form', 'Google sign-in didn’t finish. Try again, or use your email.'],
    ['auth/cancelled-popup-request', 'form', 'Google sign-in didn’t finish. Try again, or use your email.'],
    ['auth/popup-blocked', 'form', 'Google sign-in didn’t finish. Try again, or use your email.'],
    ['auth/network-request-failed', 'form', 'You’re offline. Try again when you’re back.'],
    ['auth/too-many-requests', 'form', 'Too many attempts. Wait a minute and try again.'],
    ['auth/something-new', 'form', 'Something went wrong. Try again.'],
    ['', 'form', 'Something went wrong. Try again.'],
  ])('%s → %s: %s', (code, field, message) => {
    expect(authErrorMessage(code)).toEqual({ field, message })
  })
})

describe('signUp', () => {
  test('sets the display name after creating the user, trimmed', async () => {
    const user = { reload: vi.fn() }
    vi.mocked(createUserWithEmailAndPassword).mockResolvedValue({ user } as never)
    await signUp({ name: '  Anna Nowak ', email: ' anna@example.com ', password: 'kitchen-24' })
    expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(expect.anything(), 'anna@example.com', 'kitchen-24')
    expect(updateProfile).toHaveBeenCalledWith(user, { displayName: 'Anna Nowak' })
    expect(vi.mocked(updateProfile).mock.invocationCallOrder[0]).toBeGreaterThan(
      vi.mocked(createUserWithEmailAndPassword).mock.invocationCallOrder[0],
    )
  })
})
