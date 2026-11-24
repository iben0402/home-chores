import { Outlet } from 'react-router'
import { app, usingEmulators } from './lib/firebase'

/** Root layout. The household header and bottom tabs arrive with the household plan. */
export default function App() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col p-4">
      <main className="flex-1">
        <Outlet />
      </main>
      {import.meta.env.DEV && (
        <footer className="pt-4 text-center text-xs opacity-50">
          Project: {app.options.projectId}
          {usingEmulators ? ' (emulators)' : ''}
        </footer>
      )}
    </div>
  )
}
