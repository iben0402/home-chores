import { useState } from 'react'
import { Button } from '../../components/Button'
import { ChoiceCard } from '../../components/ChoiceCard'
import { InfoNote } from '../../components/InfoNote'
import { signOut } from '../../data/auth'
import { firstName } from '../../lib/names'
import { AuthLayout } from '../auth/AuthLayout'
import { useAuth } from '../auth/useAuth'

/** 3 · Get started: create a household or join one. */
export function GetStartedPage() {
  const { user } = useAuth()
  const [leaving, setLeaving] = useState(false)
  if (!user) return null

  return (
    <AuthLayout>
      <div className="flex h-(--size-header) shrink-0 items-center justify-end px-2">
        <Button
          variant="ghost"
          size="sm"
          icon="log-out"
          loading={leaving}
          onClick={() => {
            setLeaving(true)
            signOut().catch(() => setLeaving(false))
          }}
        >
          Log out
        </Button>
      </div>
      <div className="flex flex-1 flex-col justify-end px-4 pb-2">
        <h1 className="m-0 text-display">Hi {firstName(user.displayName)}</h1>
        <p className="mt-1 mb-0 text-body text-fg-muted">Start a household for the people you live with, or join one you’ve been invited to.</p>
      </div>
      <div className="flex shrink-0 flex-col gap-3 px-4 pt-6 pb-4">
        <ChoiceCard to="/households/new" icon="house" title="Create a household" description="You’ll be its admin and can invite others." variant="primary" />
        <ChoiceCard to="/join" icon="users-round" title="Join with a code" description="For when someone sent you a code rather than a link." />
        <InfoNote className="mt-3">Got an invite link instead? Open it on this phone and you’ll join straight away.</InfoNote>
      </div>
    </AuthLayout>
  )
}
