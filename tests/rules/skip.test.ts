import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { completeOccurrence, createChore, skipOccurrence, undoCompletion, type Occurrence } from '../../src/data/chores'
import { watchHistory, type HistoryEntry } from '../../src/data/history'
import { createHousehold, joinHousehold } from '../../src/data/households'
import { addRoom } from '../../src/data/rooms'
import { dbAs, startEnv } from './setup'

let env: RulesTestEnvironment
beforeAll(async () => (env = await startEnv()))
beforeEach(() => env.clearFirestore())
afterAll(() => env.cleanup())

const A = { uid: 'alice', displayName: 'Alice' } // admin
const B = { uid: 'bob', displayName: 'Bob' }
const WEEKLY = { kind: 'interval', every: 1, unit: 'week' } as const

async function setup() {
  const hid = await createHousehold(dbAs(env, 'alice'), A, 'Flat', () => 'K7QM4XRT')
  await joinHousehold(dbAs(env, 'bob'), B, 'K7QM4XRT', hid)
  const kitchen = await addRoom(dbAs(env, 'alice'), hid, { name: 'Kitchen', icon: 'cooking-pot' })
  return { hid, kitchen }
}
async function open(hid: string, choreId: string): Promise<Occurrence[]> {
  const s = await getDocs(query(collection(dbAs(env, 'alice'), 'households', hid, 'occurrences'), where('choreId', '==', choreId), where('status', '==', 'open')))
  return s.docs.map((d) => ({ id: d.id, ...d.data() }) as Occurrence).sort((a, b) => a.seq - b.seq)
}
const occData = async (hid: string, id: string) => (await getDoc(doc(dbAs(env, 'alice'), 'households', hid, 'occurrences', id))).data()!
function history(hid: string): Promise<HistoryEntry[]> {
  return new Promise((resolve, reject) => {
    const stop = watchHistory(dbAs(env, 'alice'), hid, (l) => (stop(), resolve(l)), reject)
  })
}

test('an admin skips: logged as skipped with the reason, dates count from today, the queue stays full', async () => {
  const { hid, kitchen } = await setup()
  const cid = await createChore(dbAs(env, 'alice'), hid, A, { title: 'Bathroom', roomId: kitchen, rule: WEEKLY, startISO: '2026-12-05', assigneeUid: 'bob' })
  const [first] = await open(hid, cid)
  await assertSucceeds(skipOccurrence(dbAs(env, 'alice'), hid, first.id, A, '2026-12-05', '  away that weekend  '))

  expect(await occData(hid, first.id)).toMatchObject({ status: 'skipped', doneBy: 'alice', doneByName: 'Alice', skipReason: 'away that weekend', assigneeUid: 'bob' })
  expect((await open(hid, cid)).map((o) => o.dueDate)).toEqual(['2026-12-12', '2026-12-19', '2026-12-26', '2027-01-02'])
  const [entry] = await history(hid)
  expect(entry).toMatchObject({ id: first.id, status: 'skipped', dueDate: '2026-12-05', skipReason: 'away that weekend' })
})

test('a calendar chore keeps its dates when skipped', async () => {
  const { hid, kitchen } = await setup()
  const bins = await createChore(dbAs(env, 'alice'), hid, A, { title: 'Bins', roomId: kitchen, rule: { kind: 'calendar', freq: 'weekly', weekdays: [1] }, startISO: '2026-11-30' })
  const [first] = await open(hid, bins)
  await skipOccurrence(dbAs(env, 'alice'), hid, first.id, A, '2026-12-02')
  expect((await open(hid, bins)).map((o) => o.dueDate)).toEqual(['2026-12-07', '2026-12-14', '2026-12-21', '2026-12-28'])
  expect((await occData(hid, first.id)).skipReason).toBeUndefined()
})

test('members can’t skip', async () => {
  const { hid, kitchen } = await setup()
  const cid = await createChore(dbAs(env, 'alice'), hid, A, { title: 'Bathroom', roomId: kitchen, rule: WEEKLY, startISO: '2026-12-05' })
  const [first] = await open(hid, cid)
  await assertFails(skipOccurrence(dbAs(env, 'bob'), hid, first.id, B, '2026-12-05'))
  await assertFails(updateDoc(doc(dbAs(env, 'bob'), 'households', hid, 'occurrences', first.id), { status: 'skipped', doneBy: 'bob', doneByName: 'Bob', doneAt: serverTimestamp() }))
})

test('Undo puts a skip back exactly; ticking still works afterwards', async () => {
  const { hid, kitchen } = await setup()
  const cid = await createChore(dbAs(env, 'alice'), hid, A, { title: 'Bathroom', roomId: kitchen, rule: WEEKLY, startISO: '2026-12-05' })
  const before = await open(hid, cid)
  const token = await skipOccurrence(dbAs(env, 'alice'), hid, before[0].id, A, '2026-12-08', 'away')
  await assertSucceeds(undoCompletion(dbAs(env, 'alice'), hid, token))
  const after = await open(hid, cid)
  expect(after.map((o) => [o.id, o.dueDate])).toEqual(before.map((o) => [o.id, o.dueDate]))
  const reopened = await occData(hid, before[0].id)
  expect(reopened.status).toBe('open')
  expect(reopened).not.toHaveProperty('skipReason')
  expect(reopened).not.toHaveProperty('doneBy')

  await skipOccurrence(dbAs(env, 'alice'), hid, before[0].id, A, '2026-12-08')
  const [next] = await open(hid, cid)
  await assertSucceeds(completeOccurrence(dbAs(env, 'bob'), hid, next.id, B, '2026-12-09'))
  expect(await open(hid, cid)).toHaveLength(4)
})
