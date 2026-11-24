import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { auth } from '../lib/firebase'

// Every Firebase Auth call the app makes lives here. Screens call these, never firebase/auth.

export type AppUser = { uid: string; email: string | null; displayName: string | null }

function toAppUser(user: User | null): AppUser | null {
  return user ? { uid: user.uid, email: user.email, displayName: user.displayName } : null
}

const profileListeners = new Set<() => void>()

/**
 * The signed-in user, live: sign-in/out from Firebase plus profile changes Firebase doesn't
 * report itself (the name saved right after sign-up). Returns an unsubscribe function.
 */
export function watchAuth(onChange: (user: AppUser | null) => void): () => void {
  const emitCurrent = () => onChange(toAppUser(auth.currentUser))
  const stopAuth = onAuthStateChanged(auth, (user) => onChange(toAppUser(user)))
  profileListeners.add(emitCurrent)
  return () => {
    stopAuth()
    profileListeners.delete(emitCurrent)
  }
}

export async function signIn(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email.trim(), password)
}

export async function signUp(input: { name: string; email: string; password: string }): Promise<void> {
  const { user } = await createUserWithEmailAndPassword(auth, input.email.trim(), input.password)
  try {
    await updateProfile(user, { displayName: input.name.trim() })
    await user.reload()
  } finally {
    profileListeners.forEach((listener) => listener())
  }
}

/** Set the name housemates see (for accounts that have none yet). */
export async function updateDisplayName(name: string): Promise<void> {
  const user = auth.currentUser
  if (!user) throw Object.assign(new Error('Not signed in'), { code: 'auth/no-current-user' })
  try {
    await updateProfile(user, { displayName: name.trim() })
    await user.reload()
  } finally {
    profileListeners.forEach((listener) => listener())
  }
}

/** Popup, not redirect: redirect breaks under browsers' third-party storage blocking. */
export async function signInWithGoogle(): Promise<void> {
  await signInWithPopup(auth, new GoogleAuthProvider())
}

export async function sendReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim())
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth)
}

export type AuthErrorField = 'email' | 'password' | 'name' | 'form'

const SAME_PASSWORD = 'That email and password don’t match.'
const GOOGLE_UNFINISHED = 'Google sign-in didn’t finish. Try again, or use your email.'

const messages: Record<string, { field: AuthErrorField; message: string }> = {
  'auth/invalid-credential': { field: 'password', message: SAME_PASSWORD },
  'auth/wrong-password': { field: 'password', message: SAME_PASSWORD },
  'auth/user-not-found': { field: 'password', message: SAME_PASSWORD },
  'auth/invalid-email': { field: 'email', message: 'Enter an email address like you@example.com.' },
  'auth/email-already-in-use': { field: 'email', message: 'There’s already an account with this email.' },
  'auth/weak-password': { field: 'password', message: 'Use at least 6 characters.' },
  'auth/popup-closed-by-user': { field: 'form', message: GOOGLE_UNFINISHED },
  'auth/cancelled-popup-request': { field: 'form', message: GOOGLE_UNFINISHED },
  'auth/popup-blocked': { field: 'form', message: GOOGLE_UNFINISHED },
  'auth/network-request-failed': { field: 'form', message: 'You’re offline. Try again when you’re back.' },
  'auth/too-many-requests': { field: 'form', message: 'Too many attempts. Wait a minute and try again.' },
}

/** Firebase error code → which field it belongs to and the copy-sheet message. Never shows raw codes. */
export function authErrorMessage(code: string): { field: AuthErrorField; message: string } {
  return messages[code] ?? { field: 'form', message: 'Something went wrong. Try again.' }
}

export function errorCode(error: unknown): string {
  return typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
}
