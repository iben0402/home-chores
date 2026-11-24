import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { FilterChips, type ChoreFilter } from '../../components/FilterChips'
import { Icon } from '../../components/Icon'
import { InfoNote } from '../../components/InfoNote'
import { todayISO } from '../../lib/schedule'
import { useAuth } from '../auth/useAuth'
import { buildChoreList } from '../chores/choreList'
import { ChoreListView } from '../chores/ChoreListView'
import { useMembers, useOpenOccurrences } from '../chores/useHouseholdData'
import { useRooms } from '../rooms/useRooms'
import { InviteSheet } from './InviteSheet'
import { useHousehold } from './useHousehold'

const EMPTY_FILTER: Record<ChoreFilter, string> = {
  mine: 'Nothing assigned to you right now.',
  everyone: 'Nothing to do. Enjoy it.',
  unassigned: 'Everything has someone on it.',
}

/** Today: what needs doing, in sections, with Mine · Everyone · Unassigned. */
export function TodayPage() {
  const household = useHousehold()
  const { user } = useAuth()
  const occurrences = useOpenOccurrences(household.id)
  const members = useMembers(household.id)
  const rooms = useRooms(household.id)
  const roomMap = useMemo(() => new Map((rooms ?? []).map((r) => [r.id, r])), [rooms])
  const [filter, setFilter] = useState<ChoreFilter>('everyone')
  const [inviting, setInviting] = useState(false)

  if (!occurrences || !user) return null

  if (occurrences.length === 0) {
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

  const { counts } = buildChoreList(occurrences, { uid: user.uid, filter, today: todayISO() })
  return (
    <div className="pb-28">
      <h1 className="m-0 px-4 pt-2 text-title">Today</h1>
      <FilterChips value={filter} onChange={setFilter} counts={counts} />
      {counts[filter] === 0 && <p className="m-0 px-4 py-10 text-center text-body text-fg-muted">{EMPTY_FILTER[filter]}</p>}
      <ChoreListView hid={household.id} occurrences={occurrences} filter={filter} rooms={roomMap} members={members} fab={{ to: `/h/${household.id}/chores/new` }} />
    </div>
  )
}
