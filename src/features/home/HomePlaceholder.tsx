import { useState } from 'react'
import { AppMark } from '../../components/AppMark'
import { Button } from '../../components/Button'
import { signOut } from '../../data/auth'
import { AuthLayout } from '../auth/AuthLayout'
import { useAuth } from '../auth/useAuth'

/** Temporary landing after sign-in. Replaced by "Get started" (create or join a household). */
export function HomePlaceholder() {
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)
  const firstName = user?.displayName?.trim().split(/\s+/)[0]
  return (
    <AuthLayout>
      <div className="flex flex-1 flex-col justify-center gap-4 px-4">
        <AppMark compact />
        <h2 className="m-0 text-title">{firstName ? `Hi ${firstName}` : 'Hi'}</h2>
        <p className="m-0 text-body text-fg-muted">You’re signed in. Setting up your household comes next.</p>
      </div>
      <div className="px-4 pb-4">
        <Button
          variant="secondary"
          size="lg"
          block
          loading={busy}
          onClick={() => {
            setBusy(true)
            void signOut().finally(() => setBusy(false))
          }}
        >
          Log out
        </Button>
      </div>
    </AuthLayout>
  )
}
