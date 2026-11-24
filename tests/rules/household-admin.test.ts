import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest'
import { assignOccurrence, createChore } from '../../src/data/chores'
import { createHousehold, findInvite, joinHousehold, removeMember, renameHousehold, setAdmin, updateMyName } from '../../src/data/households'
import { dbAs, startEnv } from './setup'

let env: RulesTestEnvironment
beforeAll(async () => (env = await startEnv()))
beforeEach(() => env.clearFirestore())
afterAll(() => env.cleanup())

const ALICE = { uid: 'alice', displayName: 'Alice Nowak' }
const BOB = { uid: 'bob', displayName: 'Bob Reid' }

async function setup() {
  const hid = await createHousehold(dbAs(env, 'alice'), ALICE, 'Flat', () => 'K7QM4XRT')
  await joinHousehold(dbAs(env, 'bob'), BOB, 'K7QM4XRT', hid)
  const general = (await getDocs(collection(dbAs(env, 'alice'), 'households', hid, 'rooms'))).docs[0].id
  const choreId = await createChore(dbAs(env, 'alice'), hid, ALICE, { title: 'Vacuuming', roomId: general, rule: { kind: 'interval', every: 1, unit: 'week' }, startISO: '2026-11-24' })
  const open = await getDocs(query(collection(dbAs(env, 'bob'), 'households', hid, 'occurrences'), where('choreId', '==', choreId)))
  for (const o of open.docs.slice(0, 2)) await assignOccurrence(dbAs(env, 'bob'), hid, o.id, 'bob', 'bob')
  return { hid }
}

const bobsOpen = async (hid: string) =>
  (await getDocs(query(collection(dbAs(env, 'alice'), 'households', hid, 'occurrences'), where('assigneeUid', '==', 'bob'), where('status', '==', 'open')))).size

describe('managing people', () => {
  test('admin removes a member: their open chores become unassigned', async () => {
    const { hid } = await setup()
    expect(await bobsOpen(hid)).toBe(2)
    await assertSucceeds(removeMember(dbAs(env, 'alice'), hid, 'bob', 'alice'))
    expect(await bobsOpen(hid)).toBe(0)
  })

  test('a member leaves: their open chores become unassigned', async () => {
    const { hid } = await setup()
    await assertSucceeds(removeMember(dbAs(env, 'bob'), hid, 'bob', 'bob'))
    expect(await bobsOpen(hid)).toBe(0)
    expect((await getDoc(doc(dbAs(env, 'alice'), 'households', hid, 'members', 'bob'))).exists()).toBe(false)
  })

  test('admin makes and unmakes admins; members cannot', async () => {
    const { hid } = await setup()
    await assertFails(setAdmin(dbAs(env, 'bob'), hid, 'bob', true))
    await assertSucceeds(setAdmin(dbAs(env, 'alice'), hid, 'bob', true))
    await assertSucceeds(setAdmin(dbAs(env, 'bob'), hid, 'alice', false))
    await assertFails(setAdmin(dbAs(env, 'bob'), hid, 'bob', false)) // the last admin stays
  })

  test('renaming updates the invite’s copy of the name', async () => {
    const { hid } = await setup()
    await assertFails(renameHousehold(dbAs(env, 'bob'), hid, 'Bob’s'))
    await assertSucceeds(renameHousehold(dbAs(env, 'alice'), hid, 'The Nowaks'))
    expect(await findInvite(dbAs(env, null), 'K7QM4XRT')).toMatchObject({ status: 'ok', householdName: 'The Nowaks' })
  })

  test('changing your name updates it in every household you’re in', async () => {
    const { hid } = await setup()
    const other = await createHousehold(dbAs(env, 'bob'), BOB, 'Bob’s place', () => 'BBBBBBBB')
    await updateMyName(dbAs(env, 'bob'), 'bob', 'Bobby', [hid, other])
    for (const h of [hid, other]) expect((await getDoc(doc(dbAs(env, 'bob'), 'households', h, 'members', 'bob'))).data()?.displayName).toBe('Bobby')
  })
})
