import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  where,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore'
import type { ChoreKind } from './chores'

// History = occurrences that are done (spec §8.5, §9). Takes the Firestore instance first.

export const UNDO_MINUTES = 10

export type HistoryEntry = {
  id: string
  choreId: string
  choreTitle: string
  roomId: string
  kind: ChoreKind
  seq: number
  doneBy: string
  doneByName: string
  doneAt: Date
}

const occurrencesOf = (db: Firestore, hid: string) => collection(db, 'households', hid, 'occurrences')

/** Live history, newest first (the latest `max` entries). */
export function watchHistory(db: Firestore, hid: string, onChange: (entries: HistoryEntry[]) => void, onError?: (e: Error) => void, max = 200): Unsubscribe {
  return onSnapshot(
    query(occurrencesOf(db, hid), where('status', '==', 'done'), orderBy('doneAt', 'desc'), limit(max)),
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

/**
 * Undo from History (your own tick, within 10 minutes): reopen it and remove the occurrence the tick
 * added to the queue, if nobody has taken it. Unlike the snackbar's Undo, the re-dated queue keeps
 * its new dates (the earlier dates aren't stored).
 */
export async function undoFromHistory(db: Firestore, hid: string, entry: HistoryEntry): Promise<void> {
  const open = await getDocs(query(occurrencesOf(db, hid), where('choreId', '==', entry.choreId), where('status', '==', 'open')))
  await runTransaction(db, async (tx) => {
    const choreRef = doc(db, 'households', hid, 'chores', entry.choreId)
    const chore = (await tx.get(choreRef)).data()
    const newest = chore ? open.docs.find((d) => d.data().seq === chore.nextSeq - 1) : undefined
    const newestNow = newest ? (await tx.get(newest.ref)).data() : undefined
    tx.update(doc(occurrencesOf(db, hid), entry.id), { status: 'open', doneBy: deleteField(), doneByName: deleteField(), doneAt: deleteField() })
    if (chore && newest && newestNow?.status === 'open' && newestNow.assigneeUid === null && entry.kind !== 'oneoff') {
      tx.delete(newest.ref)
      tx.update(choreRef, { nextSeq: chore.nextSeq - 1 })
    }
  })
}

/** Admin: remove a wrong entry from History (the queue is not changed). */
export async function deleteEntry(db: Firestore, hid: string, occurrenceId: string): Promise<void> {
  await deleteDoc(doc(occurrencesOf(db, hid), occurrenceId))
}
