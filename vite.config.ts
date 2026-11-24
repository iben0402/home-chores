import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import { missingFirebaseKeys } from './src/lib/firebaseEnv.ts'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // A production build must target a real Firebase project; fail now rather than ship a broken app.
  if (command === 'build' && mode === 'production') {
    const missing = missingFirebaseKeys(loadEnv(mode, process.cwd(), 'VITE_'))
    if (missing.length > 0) {
      throw new Error(`Cannot build: missing Firebase config ${missing.join(', ')}. Fill in .env.local (see .env.example).`)
    }
  }

  return {
    plugins: [react(), tailwindcss()],
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      // Tests never depend on the developer's .env.local: always the emulator/demo setup.
      env: {
        VITE_FIREBASE_API_KEY: '',
        VITE_FIREBASE_PROJECT_ID: '',
        VITE_FIREBASE_APP_ID: '',
        VITE_USE_EMULATORS: 'true',
      },
    },
  }
})
