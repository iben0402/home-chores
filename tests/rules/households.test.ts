import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import {
  arrayRemove,
  collection,
  collectionGroup,
  deleteDoc,
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
  regenerateInviteCode,
  removeMember,
  watchMembership,
} from '../../src/data/households'
import { dbAs, startEnv } from './setup'

let env: RulesTestEnvironment
beforeAll(async () => (env = await startEnv()))
beforeEach(() => env.clearFirestore())
afterAll(() => env.cleanup())

const ALICE = { uid: 'alice', displayName: 'Alice Nowak' }
const BOB = { uid: 'bob', displayName: 'Bob Reid' }
const CAROL = { uid: 'carol', displayName: 'Carol Lis' }

async function aliceHousehold(code = 'K7QM4XRT') {
  const hid = await createHousehold(dbAs(env, 'alice'), ALICE, 'Flat on Main St', () => code)
  return { hid, code }
}

async function withBob(code = 'K7QM4XRT') {
  const { hid } = await aliceHousehold(code)
  await joinHousehold(dbAs(env, 'bob'), BOB, code, hid)
  return { hid, code }
}

/** A raw join attempt (what a tampered client could send). */
function rawJoin(uid: string, hid: string, inviteCode: string) {
  const db = dbAs(env, uid)
  const batch = writeBatch(db)
  batch.set(doc(db, 'households', hid, 'joins', uid), { inviteCode })
  batch.set(doc(db, 'households', hid, 'members', uid), { uid, displayName: 'Someone', color: 3, joinedAt: serverTimestamp() })
  return batch.commit()
}

describe('creating a household', () => {
  test('one batch: household, admin member, General room, private code and an active invite', async () => {
    const { hid, code } = await aliceHousehold()
    const db = dbAs(env, 'alice')
    const household = (await getDoc(doc(db, 'households', hid))).data()
    expect(household).toMatchObject({ name: 'Flat on Main St', adminUids: ['alice'], createdBy: 'alice' })
    expect(household).not.toHaveProperty('inviteCode')
    expect((await getDoc(doc(db, 'households', hid, 'private', 'invite'))).data()).toEqual({ code })
    expect((await getDoc(doc(db, 'households', hid, 'members', 'alice'))).data()).toMatchObject({ uid: 'alice', displayName: 'Alice Nowak', color: 1 })
    const rooms = await getDocs(collection(db, 'households', hid, 'rooms'))
    expect(rooms.docs.map((r) => r.data())).toEqual([expect.objectContaining({ name: 'General', isDefault: true, order: 0, icon: 'house' })])
    expect((await getDoc(doc(db, 'invites', code))).data()).toMatchObject({ householdId: hid, householdName: 'Flat on Main St', active: true })
  })

  test('retries with a new code when the code is taken', async () => {
    await aliceHousehold('AAAAAAAA')
    const codes = ['AAAAAAAA', 'BBBBBBBB']
    const hid = await createHousehold(dbAs(env, 'bob'), BOB, 'Bob’s place', () => codes.shift()!)
    expect((await getDoc(doc(dbAs(env, 'bob'), 'households', hid, 'private', 'invite'))).data()).toEqual({ code: 'BBBBBBBB' })
  })

  test('denied: listing someone else as admin, signed out, blank name', async () => {
    const make = (uid: string | null, data: object) => setDoc(doc(dbAs(env, uid), 'households/h1'), { createdAt: serverTimestamp(), ...data })
    await assertFails(make('bob', { name: 'X', adminUids: ['alice'], createdBy: 'bob' }))
    await assertFails(make(null, { name: 'X', adminUids: [], createdBy: 'x' }))
    await assertFails(make('bob', { name: '   ', adminUids: ['bob'], createdBy: 'bob' }))
  })

  test('denied: a household whose private code points at another household’s invite', async () => {
    const { code } = await aliceHousehold()
    const db = dbAs(env, 'bob')
    const batch = writeBatch(db)
    batch.set(doc(db, 'households/hb'), { name: 'Bob', adminUids: ['bob'], createdBy: 'bob', createdAt: serverTimestamp() })
    batch.set(doc(db, 'households/hb/members/bob'), { uid: 'bob', displayName: 'Bob', color: 1, joinedAt: serverTimestamp() })
    batch.set(doc(db, 'households/hb/private/invite'), { code })
    await assertFails(batch.commit())
  })
})

describe('invites and joining', () => {
  test('findInvite: ok, replaced, not found (signed out too)', async () => {
    const { hid, code } = await aliceHousehold()
    expect(await findInvite(dbAs(env, null), code)).toEqual({ status: 'ok', householdId: hid, householdName: 'Flat on Main St' })
    expect(await findInvite(dbAs(env, 'bob'), 'ZZZZZZZZ')).toEqual({ status: 'not-found' })
    await regenerateInviteCode(dbAs(env, 'alice'), hid, 'alice', () => 'NEWCODE2')
    expect(await findInvite(dbAs(env, 'bob'), code)).toEqual({ status: 'replaced' })
    expect(await findInvite(dbAs(env, 'bob'), 'NEWCODE2')).toMatchObject({ status: 'ok', householdId: hid })
  })

  test('a signed-in non-member can preview the household, but never see its code', async () => {
    const { hid } = await aliceHousehold()
    const bob = dbAs(env, 'bob')
    expect(await getHouseholdPreview(bob, hid)).toEqual({
      name: 'Flat on Main St',
      members: [{ uid: 'alice', displayName: 'Alice Nowak', color: 1, admin: true }],
    })
    await assertFails(getDoc(doc(bob, 'households', hid, 'private', 'invite')))
    await assertFails(getDoc(doc(dbAs(env, null), 'households', hid)))
    await assertFails(getDocs(collection(bob, 'invites')))
  })

  test('join with a valid code; joining again is a no-op; colours follow join order', async () => {
    const { hid, code } = await withBob()
    const bob = dbAs(env, 'bob')
    await joinHousehold(bob, BOB, code, hid)
    expect(await isMember(bob, hid, 'bob')).toBe(true)
    const member = (await getDoc(doc(bob, 'households', hid, 'members', 'bob'))).data()
    expect(member).toMatchObject({ displayName: 'Bob Reid', color: 2 })
    expect(member).not.toHaveProperty('inviteCode')
  })

  test('denied: joining with a replaced code, another household’s code, no code, or as someone else', async () => {
    const { hid, code } = await aliceHousehold()
    await createHousehold(dbAs(env, 'carol'), CAROL, 'Other', () => 'DDDDDDDD')
    await assertFails(rawJoin('bob', hid, 'DDDDDDDD'))
    await assertFails(setDoc(doc(dbAs(env, 'bob'), 'households', hid, 'members', 'bob'), { uid: 'bob', displayName: 'Bob', color: 2, joinedAt: serverTimestamp() }))
    await assertFails(setDoc(doc(dbAs(env, 'bob'), 'households', hid, 'members', 'mallory'), { uid: 'mallory', displayName: 'M', color: 2, joinedAt: serverTimestamp() }))
    await regenerateInviteCode(dbAs(env, 'alice'), hid, 'alice', () => 'NEWCODE2')
    await assertFails(rawJoin('bob', hid, code))
    await assertSucceeds(rawJoin('bob', hid, 'NEWCODE2'))
  })

  test('C1: a removed member cannot get back in after the code is regenerated', async () => {
    const { hid, code } = await withBob()
    const alice = dbAs(env, 'alice')
    await regenerateInviteCode(alice, hid, 'alice', () => 'NEWCODE2')
    await removeMember(alice, hid, 'bob', 'alice')
    const bob = dbAs(env, 'bob')
    // Nothing Bob can still read leads to the new code…
    expect((await getDoc(doc(bob, 'invites', code))).data()).not.toHaveProperty('householdId')
    expect((await getDoc(doc(bob, 'households', hid))).data()).not.toHaveProperty('inviteCode')
    const members = await getDocs(collection(bob, 'households', hid, 'members'))
    expect(members.docs.every((m) => !('inviteCode' in m.data()))).toBe(true)
    await assertFails(getDoc(doc(bob, 'households', hid, 'private', 'invite')))
    await assertFails(getDoc(doc(bob, 'households', hid, 'joins', 'alice')))
    // …and the old code no longer works.
    await assertFails(rawJoin('bob', hid, code))
  })

  test('watchMembership reports joining', async () => {
    const { hid, code } = await aliceHousehold()
    const bob = dbAs(env, 'bob')
    const seen: boolean[] = []
    const stop = watchMembership(bob, hid, 'bob', (member) => seen.push(member))
    await joinHousehold(bob, BOB, code, hid)
    await expect.poll(() => seen.at(-1)).toBe(true)
    expect(seen[0]).toBe(false)
    stop()
  })

  test('denied: non-admins regenerating, re-activating a replaced code, or a bad name copy', async () => {
    const { hid, code } = await withBob()
    await assertFails(regenerateInviteCode(dbAs(env, 'bob'), hid, 'bob', () => 'BOBCODE2'))
    await assertFails(updateDoc(doc(dbAs(env, 'bob'), 'invites', code), { householdName: 'Bob’s now' }))
    await assertFails(updateDoc(doc(dbAs(env, 'alice'), 'invites', code), { householdName: 42 }))
    await regenerateInviteCode(dbAs(env, 'alice'), hid, 'alice', () => 'NEWCODE2')
    await assertFails(updateDoc(doc(dbAs(env, 'alice'), 'invites', code), { active: true }))
  })
})

describe('roles (I1: admin powers need membership)', () => {
  test('a member cannot make themselves admin or rename the household', async () => {
    const { hid } = await withBob()
    const bob = dbAs(env, 'bob')
    await assertFails(updateDoc(doc(bob, 'households', hid), { adminUids: ['alice', 'bob'] }))
    await assertFails(updateDoc(doc(bob, 'households', hid), { name: 'Bob’s now' }))
  })

  test('an admin can rename and promote a member; adminUids stays non-empty, unique, members only', async () => {
    const { hid } = await withBob()
    const alice = dbAs(env, 'alice')
    await assertSucceeds(updateDoc(doc(alice, 'households', hid), { name: 'The Nowaks' }))
    await assertFails(updateDoc(doc(alice, 'households', hid), { adminUids: [] }))
    await assertFails(updateDoc(doc(alice, 'households', hid), { adminUids: ['alice', 'stranger'] }))
    await assertFails(updateDoc(doc(alice, 'households', hid), { adminUids: ['alice', 'alice'] }))
    await assertFails(updateDoc(doc(alice, 'households', hid), { adminUids: ['alice', 42] }))
    await assertFails(updateDoc(doc(alice, 'households', hid), { adminUids: ['nobody'] }))
    await assertSucceeds(updateDoc(doc(alice, 'households', hid), { adminUids: ['alice', 'bob'] }))
  })

  test('the only admin cannot leave (no ghost admins)', async () => {
    const { hid } = await withBob()
    const alice = dbAs(env, 'alice')
    await assertFails(deleteDoc(doc(alice, 'households', hid, 'members', 'alice')))
    await assertFails(removeMember(alice, hid, 'alice', 'alice'))
  })

  test('removing an admin must also take them off adminUids, in the same batch', async () => {
    const { hid } = await withBob()
    const alice = dbAs(env, 'alice')
    await updateDoc(doc(alice, 'households', hid), { adminUids: ['alice', 'bob'] })
    await assertFails(deleteDoc(doc(alice, 'households', hid, 'members', 'bob')))
    await assertSucceeds(removeMember(alice, hid, 'bob', 'alice'))
    expect((await getDoc(doc(alice, 'households', hid))).data()?.adminUids).toEqual(['alice'])
  })

  test('a member can leave; a non-admin cannot remove others', async () => {
    const { hid } = await withBob()
    await createHousehold(dbAs(env, 'carol'), CAROL, 'Other', () => 'DDDDDDDD')
    await assertFails(deleteDoc(doc(dbAs(env, 'carol'), 'households', hid, 'members', 'bob')))
    await assertSucceeds(removeMember(dbAs(env, 'bob'), hid, 'bob', 'bob'))
  })

  test('a removed admin loses admin powers', async () => {
    const { hid } = await withBob()
    const alice = dbAs(env, 'alice')
    await updateDoc(doc(alice, 'households', hid), { adminUids: ['alice', 'bob'] })
    await removeMember(alice, hid, 'bob', 'alice')
    await assertFails(updateDoc(doc(dbAs(env, 'bob'), 'households', hid), { name: 'Bob was here' }))
    await assertFails(updateDoc(doc(dbAs(env, 'bob'), 'households', hid), { adminUids: arrayRemove('alice') }))
  })

  test('members can only change their own name (not colour), and not to blank', async () => {
    const { hid } = await withBob()
    const bob = dbAs(env, 'bob')
    await assertSucceeds(updateDoc(doc(bob, 'households', hid, 'members', 'bob'), { displayName: 'Bobby' }))
    await assertFails(updateDoc(doc(bob, 'households', hid, 'members', 'bob'), { color: 9 }))
    await assertFails(updateDoc(doc(bob, 'households', hid, 'members', 'bob'), { displayName: '  ' }))
    await assertFails(updateDoc(doc(bob, 'households', hid, 'members', 'alice'), { displayName: 'Not Alice' }))
  })
})

describe('rooms', () => {
  test('members read rooms; non-members do not; members cannot create', async () => {
    const { hid } = await withBob()
    await assertSucceeds(getDocs(collection(dbAs(env, 'bob'), 'households', hid, 'rooms')))
    await assertFails(getDocs(collection(dbAs(env, 'carol'), 'households', hid, 'rooms')))
    await assertFails(setDoc(doc(dbAs(env, 'bob'), 'households', hid, 'rooms', 'r1'), { name: 'Kitchen', order: 1, icon: 'cooking-pot' }))
  })

  test('General stays General: cannot be un-defaulted or deleted; no second default room', async () => {
    const { hid } = await aliceHousehold()
    const alice = dbAs(env, 'alice')
    const general = (await getDocs(collection(alice, 'households', hid, 'rooms'))).docs[0].ref
    await assertSucceeds(updateDoc(general, { name: 'Everywhere' }))
    await assertFails(updateDoc(general, { isDefault: false }))
    await assertFails(deleteDoc(general))
    await assertFails(setDoc(doc(alice, 'households', hid, 'rooms', 'r2'), { name: 'Two', order: 1, icon: 'sofa', isDefault: true }))
    await assertSucceeds(setDoc(doc(alice, 'households', hid, 'rooms', 'r3'), { name: 'Kitchen', order: 1, icon: 'cooking-pot' }))
  })
})

describe('my households', () => {
  test('collection-group query for my own member docs is allowed; for someone else’s it is not', async () => {
    await aliceHousehold()
    const mine = await getDocs(query(collectionGroup(dbAs(env, 'alice'), 'members'), where('uid', '==', 'alice')))
    expect(mine.size).toBe(1)
    await assertFails(getDocs(query(collectionGroup(dbAs(env, 'bob'), 'members'), where('uid', '==', 'alice'))))
  })
})
