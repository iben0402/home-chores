// Pure env helpers with no Firebase imports: shared by the app and by vite.config.ts (build-time check).

export type Env = Record<string, unknown>

/** Keys a real (non-emulator) Firebase project cannot work without. */
export const REQUIRED_FIREBASE_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
] as const

export function readEnv(env: Env, key: string): string | undefined {
  const value = env[key]
  return typeof value === 'string' && value !== '' ? value : undefined
}

export function missingFirebaseKeys(env: Env): string[] {
  return REQUIRED_FIREBASE_KEYS.filter((key) => readEnv(env, key) === undefined)
}
