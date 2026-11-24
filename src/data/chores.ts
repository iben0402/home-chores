import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore'
import { initialDates, redate, topUpDate, type ChoreRule } from '../lib/schedule'

// Chore + occurrence data access (spec §7–§9). Takes the Firestore instance first (see households.ts).

export const LOOKAHEAD = 4

export type ChoreKind = ChoreRule['kind']
export type Occurrence = {
  id: string
  choreId: string
  choreTitle: string
  roomId: string
  kind: ChoreKind
  seq: number
  dueDate: string
  status: 'open' | 'done' | 'skipped'
  assigneeUid: string | null
  assignedBy?: string
  doneBy?: string
  doneByName?: string
  createdBy: string
  createdByName: string
}

/** What completing changed, so Undo can put it back exactly. */
export type UndoToken = {
  occurrenceId: string
  choreId: string
  previousDates: Array<{ id: string; dueDate: string }>
  toppedUpId: string | null
  previousLastDoneAt: Timestamp | null
}

type Person = { uid: string; displayName: string }

const occurrencesOf = (db: Firestore, hid: string) => collection(db, 'households', hid, 'occurrences')
const choresOf = (db: Firestore, hid: string) => collection(db, 'households', hid, 'chores')

function ruleFields(rule: ChoreRule) {
  if (rule.kind === 'interval') return { kind: rule.kind, interval: { every: rule.every, unit: rule.unit } }
  if (rule.kind === 'calendar') {
    return { kind: rule.kind, calendar: rule.freq === 'weekly' ? { freq: 'weekly', weekdays: rule.weekdays } : { freq: 'monthly', dayOfMonth: rule.dayOfMonth } }
  }
  return { kind: rule.kind }
}

export function ruleOf(chore: Record<string, unknown>): ChoreRule {
  if (chore.kind === 'interval') return { kind: 'interval', ...(chore.interval as { every: number; unit: 'day' | 'week' | 'month' }) }
  if (chore.kind === 'calendar') return { kind: 'calendar', ...(chore.calendar as object) } as ChoreRule
  return { kind: 'oneoff' }
}

/**
 * Create a chore and its first occurrences in one batch: a one-off gets one, a repeating chore
 * `LOOKAHEAD`. Members may only create one-offs (rules). Returns the chore id.
 */
export async function createChore(
  db: Firestore,
  hid: string,
  user: Person,
  input: { title: string; description?: string; roomId: string; rule: ChoreRule; startISO: string },
): Promise<string> {
  const title = input.title.trim()
  const count = input.rule.kind === 'oneoff' ? 1 : LOOKAHEAD
  const dates = initialDates(input.rule, input.startISO, count)
  const choreRef = doc(choresOf(db, hid))
  const batch = writeBatch(db)
  batch.set(choreRef, {
    title,
    description: input.description?.trim() ?? '',
    roomId: input.roomId,
    ...ruleFields(input.rule),
    lookahead: count,
    nextSeq: count,
    archived: false,
    createdBy: user.uid,
    createdByName: user.displayName,
    createdAt: serverTimestamp(),
  })
  dates.forEach((dueDate, seq) => {
    batch.set(doc(occurrencesOf(db, hid)), {
      choreId: choreRef.id,
      choreTitle: title,
      roomId: input.roomId,
      kind: input.rule.kind,
      seq,
      dueDate,
      status: 'open',
      assigneeUid: null,
      createdBy: user.uid,
      createdByName: user.displayName,
    })
  })
  await batch.commit()
  return choreRef.id
}

/**
 * Tick off an occurrence (spec §8.2), in one transaction: mark it done by you; for "after it's done"
 * chores re-date the remaining queue from today (assignees keep their place); top the queue back up.
 * Throws "already done" if someone beat you to it. Returns what Undo needs.
 */
export async function completeOccurrence(db: Firestore, hid: string, occurrenceId: string, user: Person, today: string): Promise<UndoToken> {
  const occRef = doc(occurrencesOf(db, hid), occurrenceId)
  // Transactions can't query: find the chore's other open occurrences first, re-read them inside.
  const firstLook = (await getDoc(occRef)).data()
  if (!firstLook || firstLook.status !== 'open') throw new Error('This chore is already done.')
  const siblings = await getDocs(query(occurrencesOf(db, hid), where('choreId', '==', firstLook.choreId), where('status', '==', 'open')))

  return runTransaction(db, async (tx) => {
    const occSnap = await tx.get(occRef)
    const occ = occSnap.data()
    if (!occ || occ.status !== 'open') throw new Error('This chore is already done.')
    const choreRef = doc(choresOf(db, hid), occ.choreId)
    const chore = (await tx.get(choreRef)).data()
    if (!chore) throw new Error('This chore no longer exists.')
    const rule = ruleOf(chore)

    const others = (await Promise.all(siblings.docs.filter((d) => d.id !== occurrenceId).map((d) => tx.get(d.ref))))
      .filter((d) => d.data()?.status === 'open')
      .sort((a, b) => a.data()!.seq - b.data()!.seq)

    tx.update(occRef, { status: 'done', doneBy: user.uid, doneByName: user.displayName, doneAt: serverTimestamp() })
    const token: UndoToken = { occurrenceId, choreId: occ.choreId, previousDates: [], toppedUpId: null, previousLastDoneAt: chore.lastDoneAt ?? null }
    if (rule.kind === 'oneoff') return token

    const newDates = redate(rule, today, others.length)
    others.forEach((o, i) => {
      if (newDates && newDates[i] !== o.data()!.dueDate) {
        token.previousDates.push({ id: o.id, dueDate: o.data()!.dueDate })
        tx.update(o.ref, { dueDate: newDates[i] })
      }
    })

    const lastOpen = newDates?.at(-1) ?? others.at(-1)?.data()?.dueDate
    const topUp = lastOpen ? topUpDate(rule, lastOpen) : rule.kind === 'interval' ? redate(rule, today, 1)![0] : topUpDate(rule, occ.dueDate > today ? occ.dueDate : today)
    const topUpRef = doc(occurrencesOf(db, hid))
    tx.set(topUpRef, {
      choreId: occ.choreId,
      choreTitle: chore.title,
      roomId: chore.roomId,
      kind: chore.kind,
      seq: chore.nextSeq,
      dueDate: topUp,
      status: 'open',
      assigneeUid: null,
      createdBy: user.uid,
      createdByName: user.displayName,
    })
    tx.update(choreRef, { nextSeq: chore.nextSeq + 1, lastDoneAt: serverTimestamp() })
    token.toppedUpId = topUpRef.id
    return token
  })
}

/** Undo a completion you just made (within 10 minutes): exactly reverses completeOccurrence. */
export async function undoCompletion(db: Firestore, hid: string, token: UndoToken): Promise<void> {
  await runTransaction(db, async (tx) => {
    const choreRef = doc(choresOf(db, hid), token.choreId)
    const chore = (await tx.get(choreRef)).data()
    const topUpRef = token.toppedUpId ? doc(occurrencesOf(db, hid), token.toppedUpId) : null
    const topUp = topUpRef ? (await tx.get(topUpRef)).data() : undefined

    tx.update(doc(occurrencesOf(db, hid), token.occurrenceId), { status: 'open', doneBy: deleteField(), doneByName: deleteField(), doneAt: deleteField() })
    for (const { id, dueDate } of token.previousDates) tx.update(doc(occurrencesOf(db, hid), id), { dueDate })
    // The top-up goes again unless someone has already taken it (then the queue stays one longer).
    if (topUpRef && topUp && topUp.status === 'open' && topUp.assigneeUid === null && chore) {
      tx.delete(topUpRef)
      tx.update(choreRef, { nextSeq: chore.nextSeq - 1, lastDoneAt: token.previousLastDoneAt })
    }
  })
}

/** "Take it": assign an unassigned open occurrence to yourself. */
export async function takeOccurrence(db: Firestore, hid: string, occurrenceId: string, uid: string): Promise<void> {
  await updateDoc(doc(occurrencesOf(db, hid), occurrenceId), { assigneeUid: uid, assignedBy: uid })
}

/** Live open occurrences of the household, earliest first. */
export function watchOpenOccurrences(db: Firestore, hid: string, onChange: (occurrences: Occurrence[]) => void, onError?: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    query(occurrencesOf(db, hid), where('status', '==', 'open'), orderBy('dueDate')),
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Occurrence)),
    onError,
  )
}
