import { useEffect, useState } from 'react'
import { watchRooms, type Room } from '../../data/rooms'
import { db } from '../../lib/firebase'

/** Live rooms of a household; null while loading. */
export function useRooms(hid: string): Room[] | null {
  const [rooms, setRooms] = useState<Room[] | null>(null)
  useEffect(() => watchRooms(db, hid, setRooms, () => setRooms([])), [hid])
  return rooms
}
