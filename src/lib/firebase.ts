import { getApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app'
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth'
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore'

// The only place Firebase is initialized. Everything else imports `auth` / `db` from here.

type Env = Record<string, unknown>

export const DEMO_PROJECT_ID = 'demo-home-chores'

const EMULATORS = {
  authUrl: 'http://127.0.0.1:9099',
  firestoreHost: '127.0.0.1',
  firestorePort: 8080,
} as const

function read(env: Env, key: string): string | undefined {
  const value = env[key]
  return typeof value === 'string' && value !== '' ? value : undefined
}

/** Real config from VITE_FIREBASE_* when a project ID is set; otherwise the emulator-only demo project. */
export function getFirebaseConfig(env: Env): FirebaseOptions {
  const projectId = read(env, 'VITE_FIREBASE_PROJECT_ID')
  if (!projectId) {
    return {
      apiKey: 'demo-key',
      authDomain: `${DEMO_PROJECT_ID}.firebaseapp.com`,
      projectId: DEMO_PROJECT_ID,
      appId: 'demo-app',
    }
  }
  return {
    apiKey: read(env, 'VITE_FIREBASE_API_KEY'),
    authDomain: read(env, 'VITE_FIREBASE_AUTH_DOMAIN'),
    projectId,
    storageBucket: read(env, 'VITE_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: read(env, 'VITE_FIREBASE_MESSAGING_SENDER_ID'),
    appId: read(env, 'VITE_FIREBASE_APP_ID'),
  }
}

/** Idempotent: safe under Vite HMR and React StrictMode — never initializes or connects twice. */
export function initFirebase(opts: { env: Env; useEmulators: boolean }): {
  app: FirebaseApp
  auth: Auth
  db: Firestore
} {
  if (getApps().length > 0) {
    const app = getApp()
    return { app, auth: getAuth(app), db: getFirestore(app) }
  }

  const app = initializeApp(getFirebaseConfig(opts.env))
  const auth = getAuth(app)
  const db = initializeFirestore(app, {
    localCache:
      typeof indexedDB === 'undefined'
        ? memoryLocalCache()
        : persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  })

  if (opts.useEmulators) {
    connectAuthEmulator(auth, EMULATORS.authUrl, { disableWarnings: true })
    connectFirestoreEmulator(db, EMULATORS.firestoreHost, EMULATORS.firestorePort)
  }

  return { app, auth, db }
}

export const usingEmulators =
  import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS !== 'false'

export const { app, auth, db } = initFirebase({ env: import.meta.env, useEmulators: usingEmulators })
