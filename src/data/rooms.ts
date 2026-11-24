import { collection, deleteDoc, doc, getDocs, onSnapshot, orderBy, query, setDoc, updateDoc, writeBatch, type Firestore, type Unsubscribe } from 'firebase/firestore'

// Room data access. Takes the Firestore instance first (see households.ts).

export const ROOM_ICONS = ['house', 'cooking-pot', 'bath', 'sofa', 'bed-double', 'shirt', 'trash', 'sprout'] as const
export type RoomIcon = (typeof ROOM_ICONS)[number]
export type Room = { id: string; name: string; icon: RoomIcon; order: number; isDefault: boolean }

const roomsOf = (db: Firestore, hid: string) => collection(db, 'households', hid, 'rooms')

/** Live rooms, General first, then by `order`. */
export function watchRooms(db: Firestore, hid: string, onChange: (rooms: Room[]) => void, onError?: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    query(roomsOf(db, hid), orderBy('order')),
    (snap) =>
      onChange(
        snap.docs.map((d) => {
          const data = d.data()
          return { id: d.id, name: data.name, icon: data.icon ?? 'house', order: data.order ?? 0, isDefault: data.isDefault === true }
        }),
      ),
    onError,
  )
}

/** Admin: add a room at the end. Returns its id. */
export async function addRoom(db: Firestore, hid: string, room: { name: string; icon: RoomIcon }): Promise<string> {
  const existing = await getDocs(roomsOf(db, hid))
  const order = Math.max(0, ...existing.docs.map((d) => d.data().order ?? 0)) + 1
  const ref = doc(roomsOf(db, hid))
  await setDoc(ref, { name: room.name.trim(), icon: room.icon, order })
  return ref.id
}

/** Admin: rename and/or change the icon. */
export async function updateRoom(db: Firestore, hid: string, roomId: string, changes: { name?: string; icon?: RoomIcon }): Promise<void> {
  await updateDoc(doc(roomsOf(db, hid), roomId), {
    ...(changes.name !== undefined ? { name: changes.name.trim() } : {}),
    ...(changes.icon !== undefined ? { icon: changes.icon } : {}),
  })
}

/** Admin: new order for the non-General rooms (General stays first). One batch, so orders stay consistent. */
export async function reorderRooms(db: Firestore, hid: string, orderedIds: string[]): Promise<void> {
  const batch = writeBatch(db)
  orderedIds.forEach((id, i) => batch.update(doc(roomsOf(db, hid), id), { order: i + 1 }))
  await batch.commit()
}

/**
 * Admin: delete a room (never General). Chores don't exist yet; when they do, this batch also
 * moves the room's chores and open occurrences to General (spec §8.8).
 */
export async function deleteRoom(db: Firestore, hid: string, roomId: string): Promise<void> {
  await deleteDoc(doc(roomsOf(db, hid), roomId))
}
