import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest'
import { completeOccurrence, createChore, takeOccurrence, undoCompletion, type Occurrence } from '../../src/data/chores'
import { createHousehold, joinHousehold } from '../../src/data/households'
import { addRoom, deleteRoom } from '../../src/data/rooms'
import { dbAs, startEnv } from './setup'

let env: RulesTestEnvironment
beforeAll(async () => (env = await startEnv()))
beforeEach(() => env.clearFirestore())
afterAll(() => env.cleanup())

const ALICE = { uid: 'alice', displayName: 'Alice Nowak' } // admin
const BOB = { uid: 'bob', displayName: 'Bob Reid' } // member
const WEEKLY = { kind: 'interval', every: 1, unit: 'week' } as const

async function setup() {
  const hid = await createHousehold(dbAs(env, 'alice'), ALICE, 'Flat', () => 'K7QM4XRT')
  await joinHousehold(dbAs(env, 'bob'), BOB, 'K7QM4XRT', hid)
  const kitchen = await addRoom(dbAs(env, 'alice'), hid, { name: 'Kitchen', icon: 'cooking-pot' })
  return { hid, kitchen }
}

async function openOccurrences(uid: string, hid: string, choreId: string): Promise<Occurrence[]> {
  const snap = await getDocs(query(collection(dbAs(env, uid), 'households', hid, 'occurrences'), where('choreId', '==', choreId), where('status', '==', 'open')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Occurrence).sort((a, b) => a.seq - b.seq)
}

describe('creating chores', () => {
  test('admin creates a weekly chore with 4 occurrences', async () => {
    const { hid, kitchen } = await setup()
    const choreId = await createChore(dbAs(env, 'alice'), hid, ALICE, { title: 'Vacuuming', roomId: kitchen, rule: WEEKLY, startISO: '2026-11-24' })
    const open = await openOccurrences('bob', hid, choreId)
    expect(open.map((o) => [o.seq, o.dueDate, o.assigneeUid])).toEqual([
      [0, '2026-11-24', null],
      [1, '2026-12-01', null],
      [2, '2026-12-08', null],
      [3, '2026-12-15', null],
    ])
    expect(open[0]).toMatchObject({ choreTitle: 'Vacuuming', roomId: kitchen, kind: 'interval', createdByName: 'Alice Nowak' })
  })

  test('a member creates a one-off; but not a repeating chore', async () => {
    const { hid, kitchen } = await setup()
    const bob = dbAs(env, 'bob')
    const choreId = await createChore(bob, hid, BOB, { title: 'Clean your dishes in the sink', roomId: kitchen, rule: { kind: 'oneoff' }, startISO: '2026-11-24' })
    expect((await openOccurrences('alice', hid, choreId)).map((o) => o.dueDate)).toEqual(['2026-11-24'])
    await assertFails(createChore(bob, hid, BOB, { title: 'Sneaky', roomId: kitchen, rule: WEEKLY, startISO: '2026-11-24' }))
  })

  test('denied: chore for a room that doesn’t exist, as someone else, or by a non-member', async () => {
    const { hid, kitchen } = await setup()
    await assertFails(createChore(dbAs(env, 'bob'), hid, BOB, { title: 'X', roomId: 'nope', rule: { kind: 'oneoff' }, startISO: '2026-11-24' }))
    await assertFails(createChore(dbAs(env, 'bob'), hid, ALICE, { title: 'X', roomId: kitchen, rule: { kind: 'oneoff' }, startISO: '2026-11-24' }))
    await assertFails(createChore(dbAs(env, 'carol'), hid, { uid: 'carol', displayName: 'C' }, { title: 'X', roomId: kitchen, rule: { kind: 'oneoff' }, startISO: '2026-11-24' }))
  })

  test('non-members cannot read chores or occurrences', async () => {
    const { hid, kitchen } = await setup()
    await createChore(dbAs(env, 'alice'), hid, ALICE, { title: 'Vacuuming', roomId: kitchen, rule: WEEKLY, startISO: '2026-11-24' })
    await assertFails(getDocs(collection(dbAs(env, 'carol'), 'households', hid, 'occurrences')))
    await assertFails(getDocs(collection(dbAs(env, 'carol'), 'households', hid, 'chores')))
  })
})

describe('completing and undo', () => {
  test('done late: marked done by me, the queue moves from today, one is topped up', async () => {
    const { hid, kitchen } = await setup()
    const choreId = await createChore(dbAs(env, 'alice'), hid, ALICE, { title: 'Vacuuming', roomId: kitchen, rule: WEEKLY, startISO: '2026-11-24' })
    const [first] = await openOccurrences('bob', hid, choreId)
    await takeOccurrence(dbAs(env, 'bob'), hid, (await openOccurrences('bob', hid, choreId))[1].id, 'bob')
    await completeOccurrence(dbAs(env, 'bob'), hid, first.id, BOB, '2026-11-27')
    const done = (await getDoc(doc(dbAs(env, 'bob'), 'households', hid, 'occurrences', first.id))).data()
    expect(done).toMatchObject({ status: 'done', doneBy: 'bob', doneByName: 'Bob Reid' })
    const open = await openOccurrences('bob', hid, choreId)
    expect(open.map((o) => [o.seq, o.dueDate, o.assigneeUid])).toEqual([
      [1, '2026-12-04', 'bob'], // Bob's place in the queue moved with the dates
      [2, '2026-12-11', null],
      [3, '2026-12-18', null],
      [4, '2026-12-25', null],
    ])
  })

  test('calendar chores keep their dates and top up on the next matching day', async () => {
    const { hid, kitchen } = await setup()
    const bins = { kind: 'calendar', freq: 'weekly', weekdays: [1] } as const
    const choreId = await createChore(dbAs(env, 'alice'), hid, ALICE, { title: 'Bins out', roomId: kitchen, rule: bins, startISO: '2026-11-24' })
    const [first] = await openOccurrences('bob', hid, choreId)
    await completeOccurrence(dbAs(env, 'bob'), hid, first.id, BOB, '2026-12-01')
    expect((await openOccurrences('bob', hid, choreId)).map((o) => o.dueDate)).toEqual(['2026-12-07', '2026-12-14', '2026-12-21', '2026-12-28'])
  })

  test('undo restores dates, removes the top-up and reopens the occurrence', async () => {
    const { hid, kitchen } = await setup()
    const choreId = await createChore(dbAs(env, 'alice'), hid, ALICE, { title: 'Vacuuming', roomId: kitchen, rule: WEEKLY, startISO: '2026-11-24' })
    const before = await openOccurrences('bob', hid, choreId)
    const token = await completeOccurrence(dbAs(env, 'bob'), hid, before[0].id, BOB, '2026-11-27')
    await undoCompletion(dbAs(env, 'bob'), hid, token)
    const after = await openOccurrences('bob', hid, choreId)
    expect(after.map((o) => [o.id, o.dueDate])).toEqual(before.map((o) => [o.id, o.dueDate]))
    expect((await getDoc(doc(dbAs(env, 'bob'), 'households', hid, 'chores', choreId))).data()?.nextSeq).toBe(4)
  })

  test('one-offs are simply done', async () => {
    const { hid, kitchen } = await setup()
    const choreId = await createChore(dbAs(env, 'bob'), hid, BOB, { title: 'Dishes', roomId: kitchen, rule: { kind: 'oneoff' }, startISO: '2026-11-24' })
    const [occ] = await openOccurrences('alice', hid, choreId)
    await completeOccurrence(dbAs(env, 'alice'), hid, occ.id, ALICE, '2026-11-24')
    expect(await openOccurrences('alice', hid, choreId)).toEqual([])
  })

  test('two people ticking the same one: the second is refused', async () => {
    const { hid, kitchen } = await setup()
    const choreId = await createChore(dbAs(env, 'alice'), hid, ALICE, { title: 'Vacuuming', roomId: kitchen, rule: WEEKLY, startISO: '2026-11-24' })
    const [first] = await openOccurrences('bob', hid, choreId)
    await completeOccurrence(dbAs(env, 'bob'), hid, first.id, BOB, '2026-11-24')
    await expect(completeOccurrence(dbAs(env, 'alice'), hid, first.id, ALICE, '2026-11-24')).rejects.toThrow(/already/)
    expect(await openOccurrences('alice', hid, choreId)).toHaveLength(4)
  })
})

describe('tampering is refused', () => {
  test('completing as someone else, undoing someone else’s, or signing an assignment as someone else', async () => {
    const { hid, kitchen } = await setup()
    const choreId = await createChore(dbAs(env, 'alice'), hid, ALICE, { title: 'Vacuuming', roomId: kitchen, rule: WEEKLY, startISO: '2026-11-24' })
    const [first, second] = await openOccurrences('bob', hid, choreId)
    const bob = dbAs(env, 'bob')
    const ref = (id: string) => doc(bob, 'households', hid, 'occurrences', id)
    await assertFails(updateDoc(ref(first.id), { status: 'done', doneBy: 'alice', doneByName: 'Alice', doneAt: serverTimestamp() }))
    // Anyone may assign anyone (spec §8.4), but only signed as themselves.
    await assertFails(updateDoc(ref(first.id), { assigneeUid: 'alice', assignedBy: 'alice' }))
    await assertSucceeds(takeOccurrence(bob, hid, second.id, 'bob'))
    await assertFails(updateDoc(ref(first.id), { choreTitle: 'Renamed' }))
    const token = await completeOccurrence(dbAs(env, 'alice'), hid, first.id, ALICE, '2026-11-24')
    await assertFails(undoCompletion(bob, hid, token))
  })

  test('members can’t edit or delete others’ chores, or create stray occurrences', async () => {
    const { hid, kitchen } = await setup()
    const choreId = await createChore(dbAs(env, 'alice'), hid, ALICE, { title: 'Vacuuming', roomId: kitchen, rule: WEEKLY, startISO: '2026-11-24' })
    const bob = dbAs(env, 'bob')
    await assertFails(updateDoc(doc(bob, 'households', hid, 'chores', choreId), { title: 'Bob’s now' }))
    await assertFails(deleteDoc(doc(bob, 'households', hid, 'chores', choreId)))
    await assertFails(
      setDoc(doc(bob, 'households', hid, 'occurrences', 'stray'), {
        choreId, choreTitle: 'Vacuuming', roomId: kitchen, kind: 'interval', seq: 99, dueDate: '2026-11-24',
        status: 'open', assigneeUid: null, createdBy: 'bob', createdByName: 'Bob',
      }),
    )
  })
})

describe('rooms and chores', () => {
  test('deleting a room moves its chores and open occurrences to General', async () => {
    const { hid, kitchen } = await setup()
    const choreId = await createChore(dbAs(env, 'alice'), hid, ALICE, { title: 'Vacuuming', roomId: kitchen, rule: WEEKLY, startISO: '2026-11-24' })
    await deleteRoom(dbAs(env, 'alice'), hid, kitchen)
    const general = (await getDocs(query(collection(dbAs(env, 'alice'), 'households', hid, 'rooms'), where('isDefault', '==', true)))).docs[0].id
    expect((await getDoc(doc(dbAs(env, 'alice'), 'households', hid, 'chores', choreId))).data()?.roomId).toBe(general)
    expect((await openOccurrences('alice', hid, choreId)).every((o) => o.roomId === general)).toBe(true)
  })
})
