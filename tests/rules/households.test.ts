import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest'
import {
  createHousehold,
  findInvite,
  getHouseholdPreview,
  isMember,
  joinHousehold,
} from '../../src/data/households'
import { dbAs, startEnv } from './setup'

let env: RulesTestEnvironment
beforeAll(async () => (env = await startEnv()))
beforeEach(() => env.clearFirestore())
afterAll(() => env.cleanup())

const ALICE = { uid: 'alice', displayName: 'Alice Nowak' }
const BOB = { uid: 'bob', displayName: 'Bob Reid' }

async function aliceHousehold(code = 'K7QM4XRT') {
  const hid = await createHousehold(dbAs(env, 'alice'), ALICE, 'Flat on Main St', () => code)
  return { hid, code }
}

describe('creating a household', () => {
  test('creates household, admin member, General room and an active invite in one go', async () => {
    const { hid, code } = await aliceHousehold()
    const db = dbAs(env, 'alice')
    const household = (await getDoc(doc(db, 'households', hid))).data()
    expect(household).toMatchObject({ name: 'Flat on Main St', adminUids: ['alice'], inviteCode: code, createdBy: 'alice' })
    expect((await getDoc(doc(db, 'households', hid, 'members', 'alice'))).data()).toMatchObject({ uid: 'alice', displayName: 'Alice Nowak', color: 1 })
    const rooms = await getDocs(collection(db, 'households', hid, 'rooms'))
    expect(rooms.docs.map((r) => r.data())).toEqual([expect.objectContaining({ name: 'General', isDefault: true, order: 0, icon: 'house' })])
    expect((await getDoc(doc(db, 'invites', code))).data()).toMatchObject({ householdId: hid, householdName: 'Flat on Main St', active: true })
  })

  test('retries with a new code when the code is taken', async () => {
    await aliceHousehold('AAAAAAAA')
    const codes = ['AAAAAAAA', 'BBBBBBBB']
    const hid = await createHousehold(dbAs(env, 'bob'), BOB, 'Bob’s place', () => codes.shift()!)
    expect((await getDoc(doc(dbAs(env, 'bob'), 'households', hid))).data()?.inviteCode).toBe('BBBBBBBB')
  })

  test('denied: listing someone else as admin', async () => {
    const db = dbAs(env, 'bob')
    await assertFails(setDoc(doc(db, 'households/h1'), { name: 'X', adminUids: ['alice'], inviteCode: 'CCCCCCCC', createdBy: 'bob', createdAt: serverTimestamp() }))
  })

  test('denied: signed out', async () => {
    const db = dbAs(env, null)
    await assertFails(setDoc(doc(db, 'households/h1'), { name: 'X', adminUids: [], inviteCode: 'C', createdBy: 'x', createdAt: serverTimestamp() }))
  })
})

describe('invites and joining', () => {
  test('findInvite: ok, replaced, not found', async () => {
    const { hid, code } = await aliceHousehold()
    const bob = dbAs(env, 'bob')
    expect(await findInvite(bob, code)).toEqual({ status: 'ok', householdId: hid, householdName: 'Flat on Main St' })
    expect(await findInvite(bob, 'ZZZZZZZZ')).toEqual({ status: 'not-found' })
    await updateDoc(doc(dbAs(env, 'alice'), 'invites', code), { active: false })
    expect(await findInvite(bob, code)).toEqual({ status: 'replaced' })
  })

  test('a signed-in non-member can preview the household before joining', async () => {
    const { hid } = await aliceHousehold()
    expect(await getHouseholdPreview(dbAs(env, 'bob'), hid)).toEqual({
      name: 'Flat on Main St',
      members: [{ uid: 'alice', displayName: 'Alice Nowak', color: 1, admin: true }],
    })
  })

  test('denied: preview when signed out, listing invites', async () => {
    const { hid } = await aliceHousehold()
    await assertFails(getDoc(doc(dbAs(env, null), 'households', hid)))
    await assertFails(getDocs(collection(dbAs(env, 'bob'), 'invites')))
  })

  test('join with a valid code makes you a member with the next colour; joining again is a no-op', async () => {
    const { hid, code } = await aliceHousehold()
    const bob = dbAs(env, 'bob')
    expect(await isMember(bob, hid, 'bob')).toBe(false)
    await joinHousehold(bob, BOB, code, hid)
    await joinHousehold(bob, BOB, code, hid)
    expect(await isMember(bob, hid, 'bob')).toBe(true)
    expect((await getDoc(doc(bob, 'households', hid, 'members', 'bob'))).data()).toMatchObject({ displayName: 'Bob Reid', color: 2 })
  })

  test('denied: joining with a replaced code, another household’s code, or no code', async () => {
    const { hid, code } = await aliceHousehold()
    const other = await createHousehold(dbAs(env, 'carol'), { uid: 'carol', displayName: 'Carol' }, 'Other', () => 'DDDDDDDD')
    const bob = dbAs(env, 'bob')
    const member = (inviteCode?: string) => ({ uid: 'bob', displayName: 'Bob', color: 2, joinedAt: serverTimestamp(), ...(inviteCode ? { inviteCode } : {}) })
    await assertFails(setDoc(doc(bob, 'households', hid, 'members', 'bob'), member('DDDDDDDD')))
    await assertFails(setDoc(doc(bob, 'households', hid, 'members', 'bob'), member()))
    await updateDoc(doc(dbAs(env, 'alice'), 'invites', code), { active: false })
    await assertFails(setDoc(doc(bob, 'households', hid, 'members', 'bob'), member(code)))
    expect(other).toBeTruthy()
  })

  test('denied: joining as someone else', async () => {
    const { hid, code } = await aliceHousehold()
    await assertFails(setDoc(doc(dbAs(env, 'bob'), 'households', hid, 'members', 'mallory'), { uid: 'mallory', displayName: 'M', color: 2, joinedAt: serverTimestamp(), inviteCode: code }))
  })
})

describe('roles', () => {
  test('a member cannot make themselves admin or rename the household', async () => {
    const { hid, code } = await aliceHousehold()
    const bob = dbAs(env, 'bob')
    await joinHousehold(bob, BOB, code, hid)
    await assertFails(updateDoc(doc(bob, 'households', hid), { adminUids: ['alice', 'bob'] }))
    await assertFails(updateDoc(doc(bob, 'households', hid), { name: 'Bob’s now' }))
  })

  test('an admin can rename and promote, but never empty adminUids', async () => {
    const { hid, code } = await aliceHousehold()
    await joinHousehold(dbAs(env, 'bob'), BOB, code, hid)
    const alice = dbAs(env, 'alice')
    await assertSucceeds(updateDoc(doc(alice, 'households', hid), { name: 'The Nowaks' }))
    await assertSucceeds(updateDoc(doc(alice, 'households', hid), { adminUids: ['alice', 'bob'] }))
    await assertFails(updateDoc(doc(alice, 'households', hid), { adminUids: [] }))
  })

  test('members cannot create rooms or invites', async () => {
    const { hid, code } = await aliceHousehold()
    const bob = dbAs(env, 'bob')
    await joinHousehold(bob, BOB, code, hid)
    await assertFails(setDoc(doc(bob, 'households', hid, 'rooms', 'r1'), { name: 'Kitchen', order: 1, icon: 'cooking-pot' }))
    await assertFails(setDoc(doc(bob, 'invites', 'EEEEEEEE'), { householdId: hid, householdName: 'x', active: true, createdBy: 'bob', createdAt: serverTimestamp() }))
  })

  test('rooms are readable by members only', async () => {
    const { hid } = await aliceHousehold()
    await assertFails(getDocs(collection(dbAs(env, 'bob'), 'households', hid, 'rooms')))
  })
})

describe('my households', () => {
  test('collection-group query for my own member docs is allowed; for someone else’s it is not', async () => {
    await aliceHousehold()
    const alice = dbAs(env, 'alice')
    const mine = await getDocs(query(collectionGroup(alice, 'members'), where('uid', '==', 'alice')))
    expect(mine.size).toBe(1)
    await assertFails(getDocs(query(collectionGroup(dbAs(env, 'bob'), 'members'), where('uid', '==', 'alice'))))
  })

  test('batch helper sanity: writeBatch is available', () => {
    expect(typeof writeBatch).toBe('function')
  })
})
