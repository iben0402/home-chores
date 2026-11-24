import { Link, useNavigate } from 'react-router'
import { Icon } from '../../components/Icon'
import { RoomCard } from '../../components/RoomCard'
import { useHousehold } from '../shell/useHousehold'
import { useIsAdmin } from '../shell/useIsAdmin'
import { todayISO } from '../../lib/schedule'
import { roomCounts } from '../chores/choreList'
import { useOpenOccurrences } from '../chores/useHouseholdData'
import { useRooms } from './useRooms'

/** 1a · Rooms tab. Counts are 0 ("All clear") until chores exist. */
export function RoomsPage() {
  const household = useHousehold()
  const isAdmin = useIsAdmin()
  const rooms = useRooms(household.id)
  const navigate = useNavigate()
  const counts = roomCounts(useOpenOccurrences(household.id) ?? [], todayISO())

  return (
    <div className="pb-6">
      <h1 className="m-0 px-4 pt-2 text-title">Rooms</h1>
      <p className="m-0 px-4 pt-0.5 text-[15px] leading-[22px] text-fg-muted">Open chores in each room. Tap a room to see them.</p>
      <div className="grid grid-cols-2 gap-3 px-4 pt-2">
        {rooms?.map((room) => (
          <RoomCard key={room.id} name={room.name} icon={room.icon} open={counts[room.id]?.open ?? 0} overdue={counts[room.id]?.overdue ?? 0} onClick={() => navigate(`/h/${household.id}/rooms/${room.id}`)} />
        ))}
      </div>
      {isAdmin && (
        <div className="px-4 pt-4">
          <Link
            to={`/h/${household.id}/rooms/manage`}
            className="inline-flex min-h-(--size-touch) w-full items-center justify-center gap-2 rounded-md border border-border-strong bg-surface px-4 text-[16px] leading-5 font-semibold text-fg no-underline hover:bg-surface-hover"
          >
            <Icon name="pencil" />
            Manage rooms
          </Link>
        </div>
      )}
    </div>
  )
}
