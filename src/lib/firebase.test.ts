import { deleteApp, getApps } from 'firebase/app'
import { connectAuthEmulator } from 'firebase/auth'
import { connectFirestoreEmulator } from 'firebase/firestore'
import { getFirebaseConfig, initFirebase, shouldUseEmulators } from './firebase'
import { missingFirebaseKeys } from './firebaseEnv'

vi.mock('firebase/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('firebase/auth')>()),
  connectAuthEmulator: vi.fn(),
}))
vi.mock('firebase/firestore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('firebase/firestore')>()),
  connectFirestoreEmulator: vi.fn(),
}))

beforeEach(async () => {
  // The module initializes a default app on import; start every test clean.
  await Promise.all(getApps().map((a) => deleteApp(a)))
  vi.clearAllMocks()
})

const REAL_ENV = {
  VITE_FIREBASE_API_KEY: 'key-1',
  VITE_FIREBASE_AUTH_DOMAIN: 'real.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'real-project',
  VITE_FIREBASE_STORAGE_BUCKET: 'real.appspot.com',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '123',
  VITE_FIREBASE_APP_ID: '1:123:web:abc',
}

test('uses demo config when env is empty and emulators are on', () => {
  const config = getFirebaseConfig({}, { useEmulators: true })
  expect(config.projectId).toBe('demo-home-chores')
  expect(config.apiKey).toEqual(expect.any(String))
  expect(config.apiKey).not.toBe('')
})

test('uses demo config whenever emulators are on, even with a real project in env', () => {
  expect(getFirebaseConfig(REAL_ENV, { useEmulators: true }).projectId).toBe('demo-home-chores')
})

test('uses VITE_FIREBASE_* values when emulators are off', () => {
  expect(getFirebaseConfig(REAL_ENV, { useEmulators: false })).toEqual({
    apiKey: 'key-1',
    authDomain: 'real.firebaseapp.com',
    projectId: 'real-project',
    storageBucket: 'real.appspot.com',
    messagingSenderId: '123',
    appId: '1:123:web:abc',
  })
})

test('throws a clear error when emulators are off and required keys are missing', () => {
  expect(() => getFirebaseConfig({ VITE_FIREBASE_PROJECT_ID: 'real-project' }, { useEmulators: false })).toThrow(
    /Missing Firebase config: VITE_FIREBASE_API_KEY, VITE_FIREBASE_APP_ID/,
  )
})

test('missingFirebaseKeys lists required keys that are empty or absent', () => {
  expect(missingFirebaseKeys({})).toEqual([
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_APP_ID',
  ])
  expect(missingFirebaseKeys({ ...REAL_ENV, VITE_FIREBASE_APP_ID: '' })).toEqual(['VITE_FIREBASE_APP_ID'])
  expect(missingFirebaseKeys(REAL_ENV)).toEqual([])
})

test('shouldUseEmulators is false in a production build even if VITE_USE_EMULATORS is "true"', () => {
  expect(shouldUseEmulators({ DEV: false, VITE_USE_EMULATORS: 'true' })).toBe(false)
})

test('shouldUseEmulators is true in dev unless VITE_USE_EMULATORS is "false"', () => {
  expect(shouldUseEmulators({ DEV: true })).toBe(true)
  expect(shouldUseEmulators({ DEV: true, VITE_USE_EMULATORS: 'true' })).toBe(true)
  expect(shouldUseEmulators({ DEV: true, VITE_USE_EMULATORS: 'false' })).toBe(false)
})

test('connects to emulators when useEmulators is true', () => {
  initFirebase({ env: {}, useEmulators: true })
  expect(connectAuthEmulator).toHaveBeenCalledWith(expect.anything(), 'http://127.0.0.1:9099', {
    disableWarnings: true,
  })
  expect(connectFirestoreEmulator).toHaveBeenCalledWith(expect.anything(), '127.0.0.1', 8080)
})

test('does not connect to emulators when useEmulators is false', () => {
  initFirebase({ env: REAL_ENV, useEmulators: false })
  expect(connectAuthEmulator).not.toHaveBeenCalled()
  expect(connectFirestoreEmulator).not.toHaveBeenCalled()
})

test('initializes once', () => {
  const first = initFirebase({ env: {}, useEmulators: true })
  const second = initFirebase({ env: {}, useEmulators: true })
  expect(second.app).toBe(first.app)
  expect(second.db).toBe(first.db)
  expect(connectAuthEmulator).toHaveBeenCalledTimes(1)
  expect(connectFirestoreEmulator).toHaveBeenCalledTimes(1)
})
