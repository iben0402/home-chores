import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth'
import { auth } from '../lib/firebase'

// Every Firebase Auth call the app makes lives here. Screens call these, never firebase/auth.

const profileListeners = new Set<() => void>()

/** Notified when the signed-in user's profile changes (e.g. the name set right after sign-up). */
export function onProfileChange(listener: () => void): () => void {
  profileListeners.add(listener)
  return () => profileListeners.delete(listener)
}

export async function signIn(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email.trim(), password)
}

export async function signUp(input: { name: string; email: string; password: string }): Promise<void> {
  const { user } = await createUserWithEmailAndPassword(auth, input.email.trim(), input.password)
  await updateProfile(user, { displayName: input.name.trim() })
  await user.reload()
  profileListeners.forEach((listener) => listener())
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
