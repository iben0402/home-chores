import { useState } from 'react'
import { Button } from '../../components/Button'
import { signOut } from '../../data/auth'

/** Temporary Household tab: the real screen (members, invite, account) is designed and comes next. */
export function HouseholdTabPlaceholder() {
  const [leaving, setLeaving] = useState(false)
  return (
    <section className="flex flex-col gap-4 px-4 pt-2 pb-6">
      <h1 className="m-0 text-title">Household</h1>
      <p className="m-0 text-body text-fg-muted">Members, invites and your account are coming here soon.</p>
      <Button
        variant="secondary"
        size="lg"
        block
        icon="log-out"
        loading={leaving}
        onClick={() => {
          setLeaving(true)
          signOut().catch(() => setLeaving(false))
        }}
      >
        Log out
      </Button>
    </section>
  )
}
