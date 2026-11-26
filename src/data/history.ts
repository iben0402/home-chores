import {
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore'
import { undoCompletion, type ChoreKind } from './chores'

// History = occurrences that are done or skipped (spec §8.3, §8.5, §9). Takes the Firestore instance first.

export const UNDO_MINUTES = 10

export type HistoryEntry = {
  id: string
  choreId: string
  choreTitle: string
  roomId: string
  kind: ChoreKind
  seq: number
  /** done, or skipped by `doneBy` (an admin), with an optional reason. */
  status: 'done' | 'skipped'
  skipReason?: string
  dueDate: string
  doneBy: string
  doneByName: string
  doneAt: Date
}

const occurrencesOf = (db: Firestore, hid: string) => collection(db, 'households', hid, 'occurrences')

/** Live history, newest first (the latest `max` entries). */
export function watchHistory(db: Firestore, hid: string, onChange: (entries: HistoryEntry[]) => void, onError?: (e: Error) => void, max = 200): Unsubscribe {
  return onSnapshot(
    query(occurrencesOf(db, hid), where('status', 'in', ['done', 'skipped']), orderBy('doneAt', 'desc'), limit(max)),
    (snap) =>
      onChange(
        snap.docs
          // A just-ticked entry has no server time yet; show it as "now".
          .map((d) => {
            const data = d.data({ serverTimestamps: 'estimate' })
            return { id: d.id, ...data, doneAt: data.doneAt?.toDate?.() ?? new Date() } as HistoryEntry
          }),
      ),
    onError,
  )
}

/** Minutes left to undo your own entry (0 when it's someone else's or too old). */
export function undoMinutesLeft(entry: HistoryEntry, uid: string, now: Date = new Date()): number {
  if (entry.doneBy !== uid) return 0
  const left = UNDO_MINUTES - (now.getTime() - entry.doneAt.getTime()) / 60000
  return left > 0 ? Math.ceil(left) : 0
}

/** Undo from History (your own tick, within 10 minutes): the same exact undo as the snackbar's. */
export async function undoFromHistory(db: Firestore, hid: string, entry: HistoryEntry): Promise<void> {
  await undoCompletion(db, hid, { occurrenceId: entry.id, choreId: entry.choreId })
}

/** Admin: remove a wrong entry from History (the queue is not changed). */
export async function deleteEntry(db: Firestore, hid: string, occurrenceId: string): Promise<void> {
  await deleteDoc(doc(occurrencesOf(db, hid), occurrenceId))
}
