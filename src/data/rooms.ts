import { collection, doc, getDocs, onSnapshot, orderBy, query, setDoc, updateDoc, where, writeBatch, type Firestore, type Unsubscribe } from 'firebase/firestore'

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
 * Admin: delete a room (never General). In the same batch its chores and their open occurrences
 * move to General (spec §8.8); done occurrences keep their old room for history.
 */
export async function deleteRoom(db: Firestore, hid: string, roomId: string): Promise<void> {
  const general = (await getDocs(query(roomsOf(db, hid), where('isDefault', '==', true)))).docs[0]
  if (!general) throw new Error('This household has no General room.')
  const [chores, open] = await Promise.all([
    getDocs(query(collection(db, 'households', hid, 'chores'), where('roomId', '==', roomId))),
    getDocs(query(collection(db, 'households', hid, 'occurrences'), where('roomId', '==', roomId), where('status', '==', 'open'))),
  ])
  const batch = writeBatch(db)
  chores.docs.forEach((c) => batch.update(c.ref, { roomId: general.id }))
  open.docs.forEach((o) => batch.update(o.ref, { roomId: general.id }))
  batch.delete(doc(roomsOf(db, hid), roomId))
  await batch.commit()
}
