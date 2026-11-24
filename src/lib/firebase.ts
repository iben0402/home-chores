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

import { missingFirebaseKeys, readEnv as read, type Env } from './firebaseEnv'

// The only place Firebase is initialized. Everything else imports `auth` / `db` from here.

export const DEMO_PROJECT_ID = 'demo-home-chores'

const EMULATORS = {
  authUrl: 'http://127.0.0.1:9099',
  firestoreHost: '127.0.0.1',
  firestorePort: 8080,
} as const

/** Emulators only in dev builds, unless explicitly turned off with VITE_USE_EMULATORS=false. */
export function shouldUseEmulators(env: Env): boolean {
  return env.DEV === true && read(env, 'VITE_USE_EMULATORS') !== 'false'
}

/**
 * With emulators on, ALWAYS the demo project: emulator traffic (and its browser cache) can then
 * never be mistaken for, or flushed into, the real project. With emulators off, the real
 * VITE_FIREBASE_* config, which must be complete.
 */
export function getFirebaseConfig(env: Env, opts: { useEmulators: boolean }): FirebaseOptions {
  if (opts.useEmulators) {
    return {
      apiKey: 'demo-key',
      authDomain: `${DEMO_PROJECT_ID}.firebaseapp.com`,
      projectId: DEMO_PROJECT_ID,
      appId: 'demo-app',
    }
  }
  const missing = missingFirebaseKeys(env)
  if (missing.length > 0) {
    throw new Error(`Missing Firebase config: ${missing.join(', ')}. See .env.example.`)
  }
  return {
    apiKey: read(env, 'VITE_FIREBASE_API_KEY'),
    authDomain: read(env, 'VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: read(env, 'VITE_FIREBASE_PROJECT_ID'),
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

  const app = initializeApp(getFirebaseConfig(opts.env, { useEmulators: opts.useEmulators }))
  const auth = getAuth(app)
  const db = initializeFirestore(app, {
    // Emulator data never goes into the persistent (IndexedDB) cache.
    localCache:
      opts.useEmulators || typeof indexedDB === 'undefined'
        ? memoryLocalCache()
        : persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  })

  if (opts.useEmulators) {
    connectAuthEmulator(auth, EMULATORS.authUrl, { disableWarnings: true })
    connectFirestoreEmulator(db, EMULATORS.firestoreHost, EMULATORS.firestorePort)
  }

  return { app, auth, db }
}

export const usingEmulators = shouldUseEmulators(import.meta.env)

export const { app, auth, db } = initFirebase({ env: import.meta.env, useEmulators: usingEmulators })
