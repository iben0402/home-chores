import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { addDoc, collection, doc, getDocs, query, serverTimestamp, updateDoc, where, type DocumentData } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest'
import { archiveChore, assignOccurrence, createChore, deleteChore, takeOccurrence, updateChore, type Occurrence } from '../../src/data/chores'
import { createHousehold, joinHousehold } from '../../src/data/households'
import { markAllNotificationsRead, markNotificationRead, watchNotifications, type AppNotification } from '../../src/data/notifications'
import { addRoom } from '../../src/data/rooms'
import { dbAs, startEnv } from './setup'

let env: RulesTestEnvironment
beforeAll(async () => (env = await startEnv()))
beforeEach(() => env.clearFirestore())
afterAll(() => env.cleanup())

const A = { uid: 'alice', displayName: 'Alice Admin' }
const B = { uid: 'bob', displayName: 'Bob Builder' }
const C = { uid: 'carol', displayName: 'Carol Singer' }
const WEEKLY = { kind: 'interval', every: 1, unit: 'week' } as const
const TODAY = '2026-11-26'

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
function inbox(uid: string): Promise<AppNotification[]> {
  return new Promise((resolve, reject) => {
    const stop = watchNotifications(dbAs(env, uid), uid, new Date(), (l) => (stop(), resolve(l)), reject)
  })
}
const inboxRef = (as: string, of: string) => collection(dbAs(env, as), 'users', of, 'notifications')

describe('sending', () => {
  test('assigning someone else notifies them, signed by the sender; taking or self-assigning doesn’t', async () => {
    const { hid, kitchen } = await setup()
    const cid = await createChore(dbAs(env, 'alice'), hid, A, { title: 'Vacuuming', roomId: kitchen, rule: WEEKLY, startISO: TODAY })
    const [o0, o1, o2] = await open(hid, cid)
    await assignOccurrence(dbAs(env, 'bob'), hid, o0.id, 'carol', 'bob')
    await assignOccurrence(dbAs(env, 'bob'), hid, o1.id, 'bob', 'bob')
    await takeOccurrence(dbAs(env, 'carol'), hid, o2.id, 'carol')

    const carol = await inbox('carol')
    expect(carol).toHaveLength(1)
    expect(carol[0]).toMatchObject({
      type: 'assigned', householdId: hid, householdName: 'Flat', choreId: cid, choreTitle: 'Vacuuming',
      occurrenceId: o0.id, dueDate: o0.dueDate, fromUid: 'bob', fromName: 'Bob Builder', fromColor: 2, read: false,
    })
    expect(await inbox('bob')).toEqual([])
  })

  test('a new chore assigned to someone else notifies them', async () => {
    const { hid, kitchen } = await setup()
    const cid = await createChore(dbAs(env, 'bob'), hid, B, { title: 'Clean your dishes', roomId: kitchen, rule: { kind: 'oneoff' }, startISO: TODAY, assigneeUid: 'carol' })
    expect(await inbox('carol')).toMatchObject([{ type: 'assigned', choreId: cid, choreTitle: 'Clean your dishes', dueDate: TODAY, fromName: 'Bob Builder' }])
  })

  test('editing a chore tells its assignees: new dates, a new name, and removed occurrences', async () => {
    const { hid, kitchen } = await setup()
    const cid = await createChore(dbAs(env, 'alice'), hid, A, { title: 'Hoovering', roomId: kitchen, rule: WEEKLY, startISO: TODAY })
    const occ = await open(hid, cid)
    await assignOccurrence(dbAs(env, 'alice'), hid, occ[0].id, 'bob', 'alice')
    await assignOccurrence(dbAs(env, 'alice'), hid, occ[3].id, 'carol', 'alice')
    // Rename only: one "renamed" to Bob (his date stays).
    await updateChore(dbAs(env, 'alice'), hid, cid, { title: 'Vacuuming' }, TODAY, 'alice')
    const of = async (uid: string, type: string) => (await inbox(uid)).filter((n) => n.type === type)
    expect(await of('bob', 'renamed')).toMatchObject([{ choreTitle: 'Vacuuming', previousTitle: 'Hoovering' }])
    expect(await of('carol', 'renamed')).toHaveLength(1)
    // Every 2 weeks with 3 upcoming: Bob's stays first (same date) — nothing new; Carol's (4th) is removed.
    await updateChore(dbAs(env, 'alice'), hid, cid, { rule: { kind: 'interval', every: 2, unit: 'week' }, lookahead: 3 }, TODAY, 'alice')
    expect(await inbox('bob')).toHaveLength(2) // assigned + renamed
    expect(await of('carol', 'removed')).toMatchObject([{ choreTitle: 'Vacuuming', dueDate: occ[3].dueDate }])
    // Starting from a later date moves Bob's.
    const [first] = await open(hid, cid)
    await assignOccurrence(dbAs(env, 'alice'), hid, (await open(hid, cid))[1].id, 'bob', 'alice')
    await updateChore(dbAs(env, 'alice'), hid, cid, { rule: { kind: 'calendar', freq: 'weekly', weekdays: [6] } }, TODAY, 'alice')
    const bob = await inbox('bob')
    expect(bob.filter((n) => n.type === 'changed').length).toBe(2)
    expect(bob.find((n) => n.type === 'changed' && n.occurrenceId === first.id)!.dueDate).toBe('2026-11-28')
  })

  test('deleting or archiving tells assignees; the person doing it gets nothing', async () => {
    const { hid, kitchen } = await setup()
    const oneoff = await createChore(dbAs(env, 'bob'), hid, B, { title: 'Kettle', roomId: kitchen, rule: { kind: 'oneoff' }, startISO: TODAY, assigneeUid: 'bob' })
    await deleteChore(dbAs(env, 'bob'), hid, oneoff, 'bob')
    expect(await inbox('bob')).toEqual([])

    const weekly = await createChore(dbAs(env, 'alice'), hid, A, { title: 'Bins', roomId: kitchen, rule: WEEKLY, startISO: TODAY, assigneeUid: 'carol' })
    await archiveChore(dbAs(env, 'alice'), hid, weekly, 'alice')
    const carol = await inbox('carol')
    expect(carol.map((n) => n.type).sort()).toEqual(['assigned', 'removed'])
  })
})

describe('the inbox is private', () => {
  test('only the recipient reads it, marks it read (only that) or deletes it', async () => {
    const { hid, kitchen } = await setup()
    const cid = await createChore(dbAs(env, 'alice'), hid, A, { title: 'Bins', roomId: kitchen, rule: WEEKLY, startISO: TODAY, assigneeUid: 'carol' })
    const [n] = await inbox('carol')
    expect(n.choreId).toBe(cid)
    await assertFails(getDocs(inboxRef('bob', 'carol')))
    await assertFails(updateDoc(doc(inboxRef('bob', 'carol'), n.id), { read: true }))
    await assertFails(updateDoc(doc(inboxRef('carol', 'carol'), n.id), { read: true, choreTitle: 'x' }))
    await assertFails(updateDoc(doc(inboxRef('carol', 'carol'), n.id), { read: false, fromName: 'x' }))
    await assertSucceeds(markNotificationRead(dbAs(env, 'carol'), 'carol', n.id))
    expect((await inbox('carol'))[0].read).toBe(true)
  })

  test('mark all read', async () => {
    const { hid, kitchen } = await setup()
    await createChore(dbAs(env, 'alice'), hid, A, { title: 'One', roomId: kitchen, rule: { kind: 'oneoff' }, startISO: TODAY, assigneeUid: 'carol' })
    await createChore(dbAs(env, 'bob'), hid, B, { title: 'Two', roomId: kitchen, rule: { kind: 'oneoff' }, startISO: TODAY, assigneeUid: 'carol' })
    await markAllNotificationsRead(dbAs(env, 'carol'), 'carol')
    expect((await inbox('carol')).map((n) => n.read)).toEqual([true, true])
  })
})

describe('no fake notifications', () => {
  async function valid(hid: string): Promise<DocumentData> {
    return {
      type: 'assigned', householdId: hid, householdName: 'Flat', choreId: 'c1', choreTitle: 'Bins', dueDate: TODAY,
      fromUid: 'bob', fromName: 'Bob Builder', fromColor: 2, read: false, createdAt: serverTimestamp(),
    }
  }
  test('the valid shape passes', async () => {
    const { hid } = await setup()
    await assertSucceeds(addDoc(inboxRef('bob', 'carol'), await valid(hid)))
  })
  test.each([
    ['another sender', { fromUid: 'alice' }],
    ['a faked name', { fromName: 'Alice Admin' }],
    ['a faked colour', { fromColor: 1 }],
    ['a faked household name', { householdName: 'Bank' }],
    ['already read', { read: true }],
    ['an unknown type', { type: 'payment' }],
    ['a client time', { createdAt: new Date() }],
    ['a bad date', { dueDate: 'tomorrow' }],
    ['an extra field', { link: 'https://evil.example' }],
  ])('rejects %s', async (_, change) => {
    const { hid } = await setup()
    await assertFails(addDoc(inboxRef('bob', 'carol'), { ...(await valid(hid)), ...change }))
  })
  test('rejects senders and recipients outside the household, and notes to yourself', async () => {
    const { hid } = await setup()
    await assertFails(addDoc(inboxRef('dave', 'carol'), { ...(await valid(hid)), fromUid: 'dave', fromName: 'Dave' }))
    await assertFails(addDoc(inboxRef('bob', 'dave'), await valid(hid)))
    await assertFails(addDoc(inboxRef('bob', 'bob'), await valid(hid)))
  })
})
