import { useMemo } from 'react'
import { Link, useParams } from 'react-router'
import { EmptyState } from '../../components/EmptyState'
import { Fab } from '../../components/Fab'
import { Icon } from '../../components/Icon'
import { TopBar } from '../../components/TopBar'
import { todayISO } from '../../lib/schedule'
import { ChoreListView } from '../chores/ChoreListView'
import { roomCounts } from '../chores/choreList'
import { useMembers, useOpenOccurrences } from '../chores/useHouseholdData'
import { useHousehold } from '../shell/useHousehold'
import { useRooms } from './useRooms'

/** 1b · One room: its chores in sections, or its empty state. */
export function RoomPage() {
  const { roomId } = useParams()
  const household = useHousehold()
  const rooms = useRooms(household.id)
  const occurrences = useOpenOccurrences(household.id)
  const members = useMembers(household.id)
  const roomMap = useMemo(() => new Map((rooms ?? []).map((r) => [r.id, r])), [rooms])
  if (!rooms || !occurrences) return null
  const room = rooms.find((r) => r.id === roomId)
  const back = `/h/${household.id}/rooms`

  if (!room) {
    return (
      <>
        <TopBar title="Rooms" back={back} />
        <EmptyState icon="circle-alert" title="We couldn’t find that" body="It may have been deleted, or the link is out of date.">
          <Link to={back} className="inline-flex min-h-[52px] w-full items-center justify-center rounded-md border border-border-strong bg-surface px-5 text-[17px] font-semibold text-fg no-underline">
            Go to Rooms
          </Link>
        </EmptyState>
      </>
    )
  }

  const counts = roomCounts(occurrences, todayISO())[room.id] ?? { open: 0, overdue: 0 }
  const addLink = `/h/${household.id}/chores/new?room=${room.id}`

  return (
    <>
      <TopBar title={room.name} back={back} />
      {counts.open === 0 ? (
        <EmptyState icon={room.icon} title={`Nothing in ${room.name}`} body="Chores you add here show up on Today when they’re due.">
          <Link to={addLink} className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-md bg-primary px-5 text-[17px] leading-5 font-semibold text-on-primary no-underline hover:bg-primary-hover">
            <Icon name="plus" />
            Add chore to {room.name}
          </Link>
        </EmptyState>
      ) : (
        <div className="pb-28">
          <div className="flex items-center gap-3 px-4 pb-1">
            <span aria-hidden="true" className="grid size-10 place-items-center rounded-md bg-primary-soft text-primary">
              <Icon name={room.icon} size={22} />
            </span>
            <span className="text-[15px] leading-[22px] text-fg-muted">
              {counts.open} open{counts.overdue > 0 ? ` · ${counts.overdue} overdue` : ''}
            </span>
          </div>
          <ChoreListView hid={household.id} occurrences={occurrences} filter="everyone" roomId={room.id} rooms={roomMap} members={members} showRoom={false} />
          <Fab to={addLink} label="Add chore" />
        </div>
      )}
    </>
  )
}
