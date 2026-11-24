import { useState } from 'react'
import { Link } from 'react-router'
import { EmptyState } from '../../components/EmptyState'
import { Icon } from '../../components/Icon'
import { Button } from '../../components/Button'
import { InfoNote } from '../../components/InfoNote'
import { useHousehold } from './useHousehold'
import { InviteSheet } from './InviteSheet'

/** Today. For now (no chores yet) the new-household empty state from the hand-off design. */
export function TodayPage() {
  const household = useHousehold()
  const [inviting, setInviting] = useState(false)
  return (
    <>
      <h1 className="m-0 px-4 pt-2 text-title">Today</h1>
      <EmptyState icon="door-open" title="Your household is ready" body="Add the first chore, or invite the people you live with so you can share them.">
        <Link
          to={`/h/${household.id}/chores/new`}
          className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-md bg-primary px-5 text-[17px] leading-5 font-semibold text-on-primary no-underline hover:bg-primary-hover"
        >
          <Icon name="plus" />
          Add a chore
        </Link>
        <Button variant="secondary" size="lg" block icon="user-round-plus" onClick={() => setInviting(true)}>
          Invite people
        </Button>
      </EmptyState>
      <div className="mt-8 px-4 pb-4">
        <InfoNote>
          <strong>A General room is already there.</strong> Add Kitchen, Bathroom and the rest from Rooms.
        </InfoNote>
      </div>
      {inviting && <InviteSheet household={household} onClose={() => setInviting(false)} />}
    </>
  )
}
