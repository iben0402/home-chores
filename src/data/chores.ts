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
import { initialDates, redate, todayISO, topUpDate, type ChoreRule } from '../lib/schedule'

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

/** What Undo needs. The details of what the tick changed are kept on the chore (`lastTick`). */
export type UndoToken = { occurrenceId: string; choreId: string }

/** Recorded on a repeating chore by each tick, so Undo (snackbar or History) can reverse it exactly. */
type LastTick = {
  occurrenceId: string
  by: string
  toppedUp: string | null
  previousDates: Array<{ id: string; dueDate: string }>
  previousLastDoneAt: Timestamp | null
}

type Person = { uid: string; displayName: string }

const occurrencesOf = (db: Firestore, hid: string) => collection(db, 'households', hid, 'occurrences')
/** Occurrences have predictable ids, `{choreId}_{seq}`, so rules can tie writes to a chore's queue. */
export const occurrenceId = (choreId: string, seq: number) => `${choreId}_${seq}`
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
  input: { title: string; description?: string; roomId: string; rule: ChoreRule; startISO: string; assigneeUid?: string | null },
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
    batch.set(doc(occurrencesOf(db, hid), occurrenceId(choreRef.id, seq)), {
      choreId: choreRef.id,
      choreTitle: title,
      roomId: input.roomId,
      kind: input.rule.kind,
      seq,
      dueDate,
      status: 'open',
      // "For" / "Who does the first one?" applies to the first occurrence only.
      ...(seq === 0 && input.assigneeUid ? { assigneeUid: input.assigneeUid, assignedBy: user.uid } : { assigneeUid: null }),
      createdBy: user.uid,
      createdByName: user.displayName,
    })
  })
  await batch.commit()
  return choreRef.id
}

/**
 * Tick off an occurrence (spec §8.2), in one transaction: mark it done by you; for "after it's done"
 * chores re-date the remaining queue from today (assignees keep their place); top the queue back up
 * to its length; record the tick on the chore for Undo. Retries when someone ticked the same chore
 * at the same moment. Throws "already done" if someone beat you to this occurrence.
 */
export async function completeOccurrence(db: Firestore, hid: string, occurrenceId_: string, user: Person, today: string): Promise<UndoToken> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await completeOnce(db, hid, occurrenceId_, user, today)
    } catch (error) {
      const code = (error as { code?: string }).code
      // A concurrent tick of the same chore makes this attempt stale (rules or contention): re-read and retry.
      if (attempt < 3 && (code === 'permission-denied' || code === 'aborted' || code === 'failed-precondition')) continue
      throw error
    }
  }
}

async function completeOnce(db: Firestore, hid: string, occId: string, user: Person, today: string): Promise<UndoToken> {
  const occRef = doc(occurrencesOf(db, hid), occId)
  const firstLook = (await getDoc(occRef)).data()
  if (!firstLook || firstLook.status !== 'open') throw new Error('This chore is already done.')
  // Transactions can't query: find the chore's open occurrences first, re-read them inside.
  const siblings = await getDocs(query(occurrencesOf(db, hid), where('choreId', '==', firstLook.choreId), where('status', '==', 'open')))

  return runTransaction(db, async (tx) => {
    const occ = (await tx.get(occRef)).data()
    if (!occ || occ.status !== 'open') throw new Error('This chore is already done.')
    const choreRef = doc(choresOf(db, hid), occ.choreId)
    const chore = (await tx.get(choreRef)).data()
    if (!chore) throw new Error('This chore no longer exists.')
    const rule = ruleOf(chore)
    const others = (await Promise.all(siblings.docs.filter((d) => d.id !== occId).map((d) => tx.get(d.ref))))
      .filter((d) => d.data()?.status === 'open')
      .sort((a, b) => a.data()!.seq - b.data()!.seq)

    tx.update(occRef, { status: 'done', doneBy: user.uid, doneByName: user.displayName, doneAt: serverTimestamp() })
    const token: UndoToken = { occurrenceId: occId, choreId: occ.choreId }
    if (rule.kind === 'oneoff') return token

    // Re-date (interval) — computed from today in one go, so monthly chores don't drift off the 30th.
    const needsTopUp = others.length < (chore.lookahead ?? LOOKAHEAD)
    const fromToday = redate(rule, today, others.length + (needsTopUp ? 1 : 0))
    const previousDates: LastTick['previousDates'] = []
    others.forEach((o, i) => {
      if (fromToday && fromToday[i] !== o.data()!.dueDate) {
        previousDates.push({ id: o.id, dueDate: o.data()!.dueDate })
        tx.update(o.ref, { dueDate: fromToday[i] })
      }
    })

    let toppedUp: string | null = null
    if (needsTopUp) {
      const lastOpen = others.at(-1)?.data()?.dueDate as string | undefined
      const dueDate = fromToday
        ? fromToday[others.length]
        : lastOpen
          ? topUpDate(rule, lastOpen)
          : topUpDate(rule, occ.dueDate > today ? occ.dueDate : today)
      toppedUp = occurrenceId(occ.choreId, chore.nextSeq)
      tx.set(doc(occurrencesOf(db, hid), toppedUp), {
        choreId: occ.choreId,
        choreTitle: chore.title,
        roomId: chore.roomId,
        kind: chore.kind,
        seq: chore.nextSeq,
        dueDate,
        status: 'open',
        assigneeUid: null,
        createdBy: user.uid,
        createdByName: user.displayName,
      })
    }
    const lastTick: LastTick = { occurrenceId: occId, by: user.uid, toppedUp, previousDates, previousLastDoneAt: chore.lastDoneAt ?? null }
    tx.update(choreRef, { ...(toppedUp ? { nextSeq: chore.nextSeq + 1 } : {}), lastDoneAt: serverTimestamp(), lastTick })
    return token
  })
}

/**
 * Undo your own tick (within 10 minutes), from the snackbar or History. If it was the chore's last
 * tick, everything it changed is put back (dates, the added occurrence unless someone took it, last
 * done); otherwise the occurrence is simply reopened.
 */
export async function undoCompletion(db: Firestore, hid: string, token: UndoToken): Promise<void> {
  await runTransaction(db, async (tx) => {
    const occRef = doc(occurrencesOf(db, hid), token.occurrenceId)
    const choreRef = doc(choresOf(db, hid), token.choreId)
    const chore = (await tx.get(choreRef)).data()
    const tick = chore?.lastTick as LastTick | undefined
    const exact = !!tick && tick.occurrenceId === token.occurrenceId
    const toppedUpRef = exact && tick.toppedUp ? doc(occurrencesOf(db, hid), tick.toppedUp) : null
    const toppedUp = toppedUpRef ? (await tx.get(toppedUpRef)).data() : undefined
    const datesStillOpen = exact
      ? await Promise.all(tick.previousDates.map(async (p) => ({ ...p, open: (await tx.get(doc(occurrencesOf(db, hid), p.id))).data()?.status === 'open' })))
      : []

    tx.update(occRef, { status: 'open', doneBy: deleteField(), doneByName: deleteField(), doneAt: deleteField() })
    if (!exact || !chore) return
    for (const p of datesStillOpen) if (p.open) tx.update(doc(occurrencesOf(db, hid), p.id), { dueDate: p.dueDate })
    const removeTopUp = toppedUpRef && toppedUp?.status === 'open' && toppedUp.assigneeUid === null
    if (removeTopUp) tx.delete(toppedUpRef)
    tx.update(choreRef, {
      ...(removeTopUp ? { nextSeq: chore.nextSeq - 1 } : {}),
      lastDoneAt: tick.previousLastDoneAt ?? null,
      lastTick: null,
    })
  })
}

/** Assign an open occurrence to someone (anyone may), or to nobody (yourself, or an admin for anyone). */
export async function assignOccurrence(db: Firestore, hid: string, occurrenceId: string, assigneeUid: string | null, byUid: string): Promise<void> {
  await updateDoc(doc(occurrencesOf(db, hid), occurrenceId), { assigneeUid, assignedBy: byUid })
}

export type Chore = {
  id: string
  title: string
  description: string
  roomId: string
  kind: ChoreKind
  rule: ChoreRule
  lookahead: number
  nextSeq: number
  archived: boolean
  createdBy: string
  createdByName: string
  lastDoneAt: Date | null
}

export function toChore(id: string, data: Record<string, unknown>): Chore {
  return {
    id,
    title: data.title as string,
    description: (data.description as string) ?? '',
    roomId: data.roomId as string,
    kind: data.kind as ChoreKind,
    rule: ruleOf(data),
    lookahead: (data.lookahead as number) ?? 1,
    nextSeq: (data.nextSeq as number) ?? 0,
    archived: data.archived === true,
    createdBy: data.createdBy as string,
    createdByName: (data.createdByName as string) ?? '',
    lastDoneAt: (data.lastDoneAt as Timestamp | undefined)?.toDate?.() ?? null,
  }
}

/** Live single chore (null if deleted). */
export function watchChore(db: Firestore, hid: string, choreId: string, onChange: (chore: Chore | null) => void, onError?: (e: Error) => void): Unsubscribe {
  return onSnapshot(doc(choresOf(db, hid), choreId), (snap) => onChange(snap.exists() ? toChore(snap.id, snap.data()) : null), onError)
}

/**
 * Edit a chore (spec §8.6) in one batch. Words and room are copied to its open occurrences.
 * One-offs: `dueDate` moves its occurrence. Repeating (admin): a new schedule or length re-dates the
 * open occurrences in seq order (assignees stay in their place) and adds or removes from the end.
 */
export async function updateChore(
  db: Firestore,
  hid: string,
  choreId: string,
  changes: { title?: string; description?: string; roomId?: string; dueDate?: string; rule?: ChoreRule; lookahead?: number },
  today: string,
): Promise<void> {
  const choreRef = doc(choresOf(db, hid), choreId)
  const choreSnap = await getDoc(choreRef)
  if (!choreSnap.exists()) throw new Error('This chore no longer exists.')
  const chore = toChore(choreId, choreSnap.data())
  const open = (await getDocs(query(occurrencesOf(db, hid), where('choreId', '==', choreId), where('status', '==', 'open')))).docs.sort((a, b) => a.data().seq - b.data().seq)

  const title = changes.title?.trim() ?? chore.title
  const roomId = changes.roomId ?? chore.roomId
  const batch = writeBatch(db)
  const choreUpdate: Record<string, unknown> = {}
  if (changes.title !== undefined) choreUpdate.title = title
  if (changes.description !== undefined) choreUpdate.description = changes.description.trim()
  if (changes.roomId !== undefined) choreUpdate.roomId = roomId

  const scheduleChanged = chore.kind !== 'oneoff' && (changes.rule !== undefined || changes.lookahead !== undefined)
  if (!scheduleChanged) {
    if (Object.keys(choreUpdate).length) batch.update(choreRef, choreUpdate)
    for (const o of open) {
      const occUpdate: Record<string, unknown> = {}
      if (o.data().choreTitle !== title) occUpdate.choreTitle = title
      if (o.data().roomId !== roomId) occUpdate.roomId = roomId
      if (chore.kind === 'oneoff' && changes.dueDate && o.data().dueDate !== changes.dueDate) occUpdate.dueDate = changes.dueDate
      if (Object.keys(occUpdate).length) batch.update(o.ref, occUpdate)
    }
    await batch.commit()
    return
  }

  const rule = changes.rule ?? chore.rule
  const lookahead = changes.lookahead ?? chore.lookahead
  // Interval: count from the last completion, else from the current first due date. Calendar: from today.
  const lastDone = chore.lastDoneAt ? todayISO(chore.lastDoneAt) : null
  const start =
    rule.kind === 'interval'
      ? lastDone
        ? (redate(rule, lastDone, 1) ?? [today])[0]
        : (open[0]?.data().dueDate as string | undefined) ?? today
      : today
  const dates = initialDates(rule, start, lookahead)
  Object.assign(choreUpdate, ruleFields(rule), { lookahead })

  let nextSeq = chore.nextSeq
  dates.forEach((dueDate, i) => {
    const existing = open[i]
    if (existing) {
      batch.update(existing.ref, { dueDate, choreTitle: title, roomId })
    } else {
      batch.set(doc(occurrencesOf(db, hid), occurrenceId(choreId, nextSeq)), {
        choreId, choreTitle: title, roomId, kind: rule.kind, seq: nextSeq, dueDate,
        status: 'open', assigneeUid: null, createdBy: chore.createdBy, createdByName: chore.createdByName,
      })
      nextSeq += 1
    }
  })
  open.slice(dates.length).forEach((o) => batch.delete(o.ref))
  choreUpdate.nextSeq = nextSeq
  if (rule.kind !== chore.kind) open.slice(0, dates.length).forEach((o) => batch.update(o.ref, { kind: rule.kind }))
  if (rule.kind === 'calendar' && chore.kind === 'interval') choreUpdate.interval = deleteField()
  if (rule.kind === 'interval' && chore.kind === 'calendar') choreUpdate.calendar = deleteField()
  batch.update(choreRef, choreUpdate)
  await batch.commit()
}

/** Delete a chore and its open occurrences (done ones stay in History). Admin, or a one-off's creator. */
export async function deleteChore(db: Firestore, hid: string, choreId: string): Promise<void> {
  const open = await getDocs(query(occurrencesOf(db, hid), where('choreId', '==', choreId), where('status', '==', 'open')))
  const batch = writeBatch(db)
  open.docs.forEach((o) => batch.delete(o.ref))
  batch.delete(doc(choresOf(db, hid), choreId))
  await batch.commit()
}

/** Admin: archive a repeating chore — its upcoming occurrences go; the chore and its history stay. */
export async function archiveChore(db: Firestore, hid: string, choreId: string): Promise<void> {
  const open = await getDocs(query(occurrencesOf(db, hid), where('choreId', '==', choreId), where('status', '==', 'open')))
  const batch = writeBatch(db)
  open.docs.forEach((o) => batch.delete(o.ref))
  batch.update(doc(choresOf(db, hid), choreId), { archived: true })
  await batch.commit()
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
