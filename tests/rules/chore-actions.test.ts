import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, getDoc, getDocs, doc, query, where } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest'
import { archiveChore, assignOccurrence, createChore, deleteChore, updateChore, type Occurrence } from '../../src/data/chores'
import { createHousehold, joinHousehold } from '../../src/data/households'
import { addRoom } from '../../src/data/rooms'
import { dbAs, startEnv } from './setup'

let env: RulesTestEnvironment
beforeAll(async () => (env = await startEnv()))
beforeEach(() => env.clearFirestore())
afterAll(() => env.cleanup())

const ALICE = { uid: 'alice', displayName: 'Alice Nowak' } // admin
const BOB = { uid: 'bob', displayName: 'Bob Reid' }
const CAROL = { uid: 'carol', displayName: 'Carol Lis' }
const WEEKLY = { kind: 'interval', every: 1, unit: 'week' } as const

async function setup() {
  const hid = await createHousehold(dbAs(env, 'alice'), ALICE, 'Flat', () => 'K7QM4XRT')
  await joinHousehold(dbAs(env, 'bob'), BOB, 'K7QM4XRT', hid)
  await joinHousehold(dbAs(env, 'carol'), CAROL, 'K7QM4XRT', hid)
  const kitchen = await addRoom(dbAs(env, 'alice'), hid, { name: 'Kitchen', icon: 'cooking-pot' })
  const general = (await getDocs(query(collection(dbAs(env, 'alice'), 'households', hid, 'rooms'), where('isDefault', '==', true)))).docs[0].id
  return { hid, kitchen, general }
}

async function open(hid: string, choreId: string): Promise<Occurrence[]> {
  const snap = await getDocs(query(collection(dbAs(env, 'alice'), 'households', hid, 'occurrences'), where('choreId', '==', choreId), where('status', '==', 'open')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Occurrence).sort((a, b) => a.seq - b.seq)
}

describe('assigning', () => {
  test('anyone can assign anyone; reassigning works; you can unassign yourself', async () => {
    const { hid, kitchen } = await setup()
    const choreId = await createChore(dbAs(env, 'alice'), hid, ALICE, { title: 'Vacuuming', roomId: kitchen, rule: WEEKLY, startISO: '2026-11-24' })
    const [first] = await open(hid, choreId)
    await assertSucceeds(assignOccurrence(dbAs(env, 'bob'), hid, first.id, 'carol', 'bob'))
    await assertSucceeds(assignOccurrence(dbAs(env, 'bob'), hid, first.id, 'alice', 'bob'))
    await assertSucceeds(assignOccurrence(dbAs(env, 'bob'), hid, first.id, 'bob', 'bob'))
    await assertSucceeds(assignOccurrence(dbAs(env, 'bob'), hid, first.id, null, 'bob'))
  })

  test('denied: unassigning someone else (as a member), assigning a non-member, signing as someone else', async () => {
    const { hid, kitchen } = await setup()
    const choreId = await createChore(dbAs(env, 'alice'), hid, ALICE, { title: 'Vacuuming', roomId: kitchen, rule: WEEKLY, startISO: '2026-11-24' })
    const [first] = await open(hid, choreId)
    await assignOccurrence(dbAs(env, 'bob'), hid, first.id, 'carol', 'bob')
    await assertFails(assignOccurrence(dbAs(env, 'bob'), hid, first.id, null, 'bob'))
    await assertFails(assignOccurrence(dbAs(env, 'bob'), hid, first.id, 'stranger', 'bob'))
    await assertFails(assignOccurrence(dbAs(env, 'bob'), hid, first.id, 'bob', 'carol'))
    await assertSucceeds(assignOccurrence(dbAs(env, 'alice'), hid, first.id, null, 'alice')) // admins may
  })

  test('a new chore can be created already assigned (the first one)', async () => {
    const { hid, kitchen } = await setup()
    const choreId = await createChore(dbAs(env, 'bob'), hid, BOB, { title: 'Clean your dishes', roomId: kitchen, rule: { kind: 'oneoff' }, startISO: '2026-11-24', assigneeUid: 'carol' })
    expect((await open(hid, choreId))[0]).toMatchObject({ assigneeUid: 'carol', assignedBy: 'bob' })
  })
})

describe('editing and deleting', () => {
  test('the creator edits their one-off: words, room, date, who', async () => {
    const { hid, kitchen, general } = await setup()
    const choreId = await createChore(dbAs(env, 'bob'), hid, BOB, { title: 'Descale', roomId: kitchen, rule: { kind: 'oneoff' }, startISO: '2026-11-24' })
    await assertSucceeds(updateChore(dbAs(env, 'bob'), hid, choreId, { title: 'Descale the kettle', description: 'Vinegar', roomId: general, dueDate: '2026-12-04' }, '2026-11-24'))
    expect((await open(hid, choreId))[0]).toMatchObject({ choreTitle: 'Descale the kettle', roomId: general, dueDate: '2026-12-04' })
    expect((await getDoc(doc(dbAs(env, 'bob'), 'households', hid, 'chores', choreId))).data()).toMatchObject({ title: 'Descale the kettle', description: 'Vinegar' })
  })

  test('denied: editing or deleting someone else’s one-off, or a repeating chore as a member', async () => {
    const { hid, kitchen } = await setup()
    const oneoff = await createChore(dbAs(env, 'bob'), hid, BOB, { title: 'Descale', roomId: kitchen, rule: { kind: 'oneoff' }, startISO: '2026-11-24' })
    const weekly = await createChore(dbAs(env, 'alice'), hid, ALICE, { title: 'Vacuuming', roomId: kitchen, rule: WEEKLY, startISO: '2026-11-24' })
    await assertFails(updateChore(dbAs(env, 'carol'), hid, oneoff, { title: 'Mine now' }, '2026-11-24'))
    await assertFails(deleteChore(dbAs(env, 'carol'), hid, oneoff))
    await assertFails(updateChore(dbAs(env, 'bob'), hid, weekly, { title: 'Bob’s' }, '2026-11-24'))
    await assertFails(archiveChore(dbAs(env, 'bob'), hid, weekly))
  })

  test('the creator deletes their one-off; it leaves Today', async () => {
    const { hid, kitchen } = await setup()
    const choreId = await createChore(dbAs(env, 'bob'), hid, BOB, { title: 'Descale', roomId: kitchen, rule: { kind: 'oneoff' }, startISO: '2026-11-24' })
    await assertSucceeds(deleteChore(dbAs(env, 'bob'), hid, choreId))
    expect(await open(hid, choreId)).toEqual([])
  })

  test('admin changes a repeating chore’s schedule and length; assignees keep their place', async () => {
    const { hid, kitchen } = await setup()
    const choreId = await createChore(dbAs(env, 'alice'), hid, ALICE, { title: 'Vacuuming', roomId: kitchen, rule: WEEKLY, startISO: '2026-11-24' })
    const occs = await open(hid, choreId)
    await assignOccurrence(dbAs(env, 'bob'), hid, occs[1].id, 'bob', 'bob')
    await updateChore(dbAs(env, 'alice'), hid, choreId, { title: 'Hoover', rule: { kind: 'interval', every: 2, unit: 'week' }, lookahead: 3 }, '2026-11-24')
    expect((await open(hid, choreId)).map((o) => [o.seq, o.dueDate, o.assigneeUid, o.choreTitle])).toEqual([
      [0, '2026-11-24', null, 'Hoover'],
      [1, '2026-12-08', 'bob', 'Hoover'],
      [2, '2026-12-22', null, 'Hoover'],
    ])
    await updateChore(dbAs(env, 'alice'), hid, choreId, { lookahead: 5 }, '2026-11-24')
    expect((await open(hid, choreId)).map((o) => o.dueDate)).toEqual(['2026-11-24', '2026-12-08', '2026-12-22', '2027-01-05', '2027-01-19'])
  })

  test('admin archives a repeating chore: upcoming ones go, the chore is kept', async () => {
    const { hid, kitchen } = await setup()
    const choreId = await createChore(dbAs(env, 'alice'), hid, ALICE, { title: 'Vacuuming', roomId: kitchen, rule: WEEKLY, startISO: '2026-11-24' })
    await assertSucceeds(archiveChore(dbAs(env, 'alice'), hid, choreId))
    expect(await open(hid, choreId)).toEqual([])
    expect((await getDoc(doc(dbAs(env, 'alice'), 'households', hid, 'chores', choreId))).data()?.archived).toBe(true)
  })
})
