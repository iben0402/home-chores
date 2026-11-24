import { Outlet } from 'react-router'
import { app, usingEmulators } from './lib/firebase'

/** Root layout. Screens own their layout; this only adds the dev-only project label. */
export default function App() {
  return (
    <>
      <Outlet />
      {import.meta.env.DEV && (
        <footer className="pointer-events-none fixed right-2 bottom-1 text-[11px] text-fg-muted opacity-70">
          Project: {app.options.projectId}
          {usingEmulators ? ' (emulators)' : ''}
        </footer>
      )}
    </>
  )
}
