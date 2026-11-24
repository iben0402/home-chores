import { Link, useParams } from 'react-router'
import { EmptyState } from '../../components/EmptyState'
import { Icon } from '../../components/Icon'
import { TopBar } from '../../components/TopBar'
import { useHousehold } from '../shell/useHousehold'
import { useRooms } from './useRooms'

/** 1b · One room. Until chores exist this is its empty state. */
export function RoomPage() {
  const { roomId } = useParams()
  const household = useHousehold()
  const rooms = useRooms(household.id)
  if (!rooms) return null
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

  return (
    <>
      <TopBar title={room.name} back={back} />
      <EmptyState icon={room.icon} title={`Nothing in ${room.name}`} body="Chores you add here show up on Today when they’re due.">
        <Link
          to={`/h/${household.id}/chores/new?room=${room.id}`}
          className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-md bg-primary px-5 text-[17px] leading-5 font-semibold text-on-primary no-underline hover:bg-primary-hover"
        >
          <Icon name="plus" />
          Add chore to {room.name}
        </Link>
      </EmptyState>
    </>
  )
}
