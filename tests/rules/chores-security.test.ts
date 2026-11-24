import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, increment, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest'
import { assignOccurrence, completeOccurrence, createChore, undoCompletion, type Occurrence } from '../../src/data/chores'
import { undoFromHistory, watchHistory, type HistoryEntry } from '../../src/data/history'
import { createHousehold, joinHousehold } from '../../src/data/households'
import { addRoom } from '../../src/data/rooms'
import { dbAs, startEnv } from './setup'

// Regression tests for the review of chores part 1 (docs/known-issues.md 1–8, 10, 17).
let env: RulesTestEnvironment
beforeAll(async () => (env = await startEnv()))
beforeEach(() => env.clearFirestore())
afterAll(() => env.cleanup())

const A = { uid: 'alice', displayName: 'Alice' } // admin
const B = { uid: 'bob', displayName: 'Bob' }
const C = { uid: 'carol', displayName: 'Carol' }
const WEEKLY = { kind: 'interval', every: 1, unit: 'week' } as const

async function setup() {
  const hid = await createHousehold(dbAs(env, 'alice'), A, 'Flat', () => 'K7QM4XRT')
  await joinHousehold(dbAs(env, 'bob'), B, 'K7QM4XRT', hid)
  await joinHousehold(dbAs(env, 'carol'), C, 'K7QM4XRT', hid)
  const kitchen = await addRoom(dbAs(env, 'alice'), hid, { name: 'Kitchen', icon: 'cooking-pot' })
  return { hid, kitchen }
}
async function open(hid: string, choreId: string): Promise<Occurrence[]> {
  const s = await getDocs(query(collection(dbAs(env, 'alice'), 'households', hid, 'occurrences'), where('choreId', '==', choreId), where('status', '==', 'open')))
  return s.docs.map((d) => ({ id: d.id, ...d.data() }) as Occurrence).sort((a, b) => a.seq - b.seq)
}
const choreData = async (hid: string, id: string) => (await getDoc(doc(dbAs(env, 'alice'), 'households', hid, 'chores', id))).data()!
function history(uid: string, hid: string): Promise<HistoryEntry[]> {
  return new Promise((resolve, reject) => {
    const stop = watchHistory(dbAs(env, uid), hid, (l) => (stop(), resolve(l)), reject)
  })
}

describe('C1 / I1: the queue counter only moves with a real tick or undo', () => {
  test('a member cannot wipe a chore’s queue (lower the counter + delete the newest)', async () => {
    const { hid, kitchen } = await setup()
    const cid = await createChore(dbAs(env, 'alice'), hid, A, { title: 'Vac', roomId: kitchen, rule: WEEKLY, startISO: '2026-11-24' })
    const last = (await open(hid, cid)).at(-1)!
    const bob = dbAs(env, 'bob')
    const b = writeBatch(bob)
    b.update(doc(bob, 'households', hid, 'chores', cid), { nextSeq: last.seq })
    b.delete(doc(bob, 'households', hid, 'occurrences', last.id))
    await assertFails(b.commit())
    expect(await open(hid, cid)).toHaveLength(4)
  })

  test('a member cannot delete someone else’s one-off that way', async () => {
    const { hid, kitchen } = await setup()
    const cid = await createChore(dbAs(env, 'carol'), hid, C, { title: 'Carol job', roomId: kitchen, rule: { kind: 'oneoff' }, startISO: '2026-11-24' })
    const [o] = await open(hid, cid)
    const bob = dbAs(env, 'bob')
    const b = writeBatch(bob)
    b.update(doc(bob, 'households', hid, 'chores', cid), { nextSeq: 0 })
    b.delete(doc(bob, 'households', hid, 'occurrences', o.id))
    await assertFails(b.commit())
  })

  test('no free counter walks and no junk lastDoneAt', async () => {
    const { hid, kitchen } = await setup()
    const cid = await createChore(dbAs(env, 'alice'), hid, A, { title: 'Vac', roomId: kitchen, rule: WEEKLY, startISO: '2026-11-24' })
    const ref = doc(dbAs(env, 'bob'), 'households', hid, 'chores', cid)
    await assertFails(updateDoc(ref, { nextSeq: increment(-1) }))
    await assertFails(updateDoc(ref, { nextSeq: increment(1) }))
    await assertFails(updateDoc(ref, { lastDoneAt: 'not a timestamp' }))
  })
})

describe('I2: first occurrences match the chore', () => {
  test('a member’s new one-off gets exactly one occurrence, matching it', async () => {
    const { hid, kitchen } = await setup()
    const bob = dbAs(env, 'bob')
    const b = writeBatch(bob)
    const cref = doc(collection(bob, 'households', hid, 'chores'))
    b.set(cref, { title: 'x', description: '', roomId: kitchen, kind: 'oneoff', lookahead: 1, nextSeq: 1, archived: false, createdBy: 'bob', createdByName: 'Bob', createdAt: serverTimestamp() })
    b.set(doc(bob, 'households', hid, 'occurrences', `${cref.id}_-1`), {
      choreId: cref.id, choreTitle: 'Something else', roomId: 'no-such-room', kind: 'interval', seq: -1, dueDate: '2026-12-01',
      status: 'open', assigneeUid: null, createdBy: 'bob', createdByName: 'Bob',
    })
    await assertFails(b.commit())
  })
})

describe('I3: two people ticking different occurrences at once', () => {
  test('both succeed, with no duplicate positions', async () => {
    const { hid, kitchen } = await setup()
    const cid = await createChore(dbAs(env, 'alice'), hid, A, { title: 'Vac', roomId: kitchen, rule: WEEKLY, startISO: '2026-11-24' })
    const [o0, o1] = await open(hid, cid)
    const results = await Promise.allSettled([
      completeOccurrence(dbAs(env, 'bob'), hid, o0.id, B, '2026-11-24'),
      completeOccurrence(dbAs(env, 'carol'), hid, o1.id, C, '2026-11-24'),
    ])
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled'])
    const seqs = (await open(hid, cid)).map((o) => o.seq)
    expect(new Set(seqs).size).toBe(seqs.length)
    expect(seqs).toHaveLength(4)
  })
})

describe('I5 / 17: undo', () => {
  test('undo after someone took the new occurrence: the queue returns to its length at the next tick', async () => {
    const { hid, kitchen } = await setup()
    const cid = await createChore(dbAs(env, 'alice'), hid, A, { title: 'Vac', roomId: kitchen, rule: WEEKLY, startISO: '2026-11-24' })
    const [o0] = await open(hid, cid)
    const token = await completeOccurrence(dbAs(env, 'bob'), hid, o0.id, B, '2026-11-27')
    const topUp = (await open(hid, cid)).at(-1)!
    await assignOccurrence(dbAs(env, 'carol'), hid, topUp.id, 'carol', 'carol')
    await undoCompletion(dbAs(env, 'bob'), hid, token)
    expect(await open(hid, cid)).toHaveLength(5)
    expect((await choreData(hid, cid)).lastDoneAt ?? null).toBeNull()
    const [first] = await open(hid, cid)
    await completeOccurrence(dbAs(env, 'bob'), hid, first.id, B, '2026-11-28')
    expect(await open(hid, cid)).toHaveLength(4)
  })

  test('undo from History restores the earlier dates too', async () => {
    const { hid, kitchen } = await setup()
    const cid = await createChore(dbAs(env, 'alice'), hid, A, { title: 'Vac', roomId: kitchen, rule: WEEKLY, startISO: '2026-11-24' })
    const before = (await open(hid, cid)).map((o) => [o.id, o.dueDate])
    await completeOccurrence(dbAs(env, 'bob'), hid, before[0][0], B, '2026-11-27')
    const [entry] = await history('bob', hid)
    await undoFromHistory(dbAs(env, 'bob'), hid, entry)
    expect((await open(hid, cid)).map((o) => [o.id, o.dueDate])).toEqual(before)
  })

  test('someone else cannot use the undo path', async () => {
    const { hid, kitchen } = await setup()
    const cid = await createChore(dbAs(env, 'alice'), hid, A, { title: 'Vac', roomId: kitchen, rule: WEEKLY, startISO: '2026-11-24' })
    const [o0] = await open(hid, cid)
    const token = await completeOccurrence(dbAs(env, 'bob'), hid, o0.id, B, '2026-11-24')
    await assertFails(undoCompletion(dbAs(env, 'carol'), hid, token))
  })
})

describe('M3 / M4: names and archived chores', () => {
  test('cannot tick as “Alice” or raise a one-off “from Alice”', async () => {
    const { hid, kitchen } = await setup()
    await assertFails(createChore(dbAs(env, 'bob'), hid, { uid: 'bob', displayName: 'Alice' }, { title: 'x', roomId: kitchen, rule: { kind: 'oneoff' }, startISO: '2026-11-24' }))
    const cid = await createChore(dbAs(env, 'bob'), hid, B, { title: 'x', roomId: kitchen, rule: { kind: 'oneoff' }, startISO: '2026-11-24' })
    const [o] = await open(hid, cid)
    await assertFails(updateDoc(doc(dbAs(env, 'bob'), 'households', hid, 'occurrences', o.id), { status: 'done', doneBy: 'bob', doneByName: 'Alice', doneAt: serverTimestamp() }))
    await assertSucceeds(completeOccurrence(dbAs(env, 'bob'), hid, o.id, B, '2026-11-24'))
  })

  test('no top-ups on an archived chore', async () => {
    const { hid, kitchen } = await setup()
    const cid = await createChore(dbAs(env, 'alice'), hid, A, { title: 'Vac', roomId: kitchen, rule: WEEKLY, startISO: '2026-11-24' })
    await updateDoc(doc(dbAs(env, 'alice'), 'households', hid, 'chores', cid), { archived: true })
    const bob = dbAs(env, 'bob')
    await assertFails(setDoc(doc(bob, 'households', hid, 'occurrences', `${cid}_4`), {
      choreId: cid, choreTitle: 'Vac', roomId: kitchen, kind: 'interval', seq: 4, dueDate: '2026-12-22',
      status: 'open', assigneeUid: null, createdBy: 'bob', createdByName: 'Bob',
    }))
  })
})

test('M1: “every month” doesn’t drift after a short month', async () => {
  const { hid, kitchen } = await setup()
  const cid = await createChore(dbAs(env, 'alice'), hid, A, { title: 'Rent', roomId: kitchen, rule: { kind: 'interval', every: 1, unit: 'month' }, startISO: '2026-11-30' })
  const [o0] = await open(hid, cid)
  await completeOccurrence(dbAs(env, 'bob'), hid, o0.id, B, '2026-11-30')
  expect((await open(hid, cid)).map((o) => o.dueDate)).toEqual(['2026-12-30', '2027-01-30', '2027-02-28', '2027-03-30'])
})

test('deleting an old-style occurrence directly is still refused for members', async () => {
  const { hid, kitchen } = await setup()
  const cid = await createChore(dbAs(env, 'alice'), hid, A, { title: 'Vac', roomId: kitchen, rule: WEEKLY, startISO: '2026-11-24' })
  const [o0] = await open(hid, cid)
  await assertFails(deleteDoc(doc(dbAs(env, 'bob'), 'households', hid, 'occurrences', o0.id)))
})
