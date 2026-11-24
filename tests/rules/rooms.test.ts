import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest'
import { createHousehold, joinHousehold } from '../../src/data/households'
import { addRoom, deleteRoom, reorderRooms, updateRoom, watchRooms, type Room } from '../../src/data/rooms'
import { dbAs, startEnv } from './setup'

let env: RulesTestEnvironment
beforeAll(async () => (env = await startEnv()))
beforeEach(() => env.clearFirestore())
afterAll(() => env.cleanup())

async function household() {
  const hid = await createHousehold(dbAs(env, 'alice'), { uid: 'alice', displayName: 'Alice' }, 'Flat', () => 'K7QM4XRT')
  await joinHousehold(dbAs(env, 'bob'), { uid: 'bob', displayName: 'Bob' }, 'K7QM4XRT', hid)
  return hid
}

function rooms(uid: string, hid: string): Promise<Room[]> {
  return new Promise((resolve, reject) => {
    const stop = watchRooms(dbAs(env, uid), hid, (list) => {
      stop()
      resolve(list)
    }, reject)
  })
}

describe('rooms', () => {
  test('admin adds rooms after General, renames, reorders and deletes', async () => {
    const hid = await household()
    const alice = dbAs(env, 'alice')
    const kitchen = await addRoom(alice, hid, { name: ' Kitchen ', icon: 'cooking-pot' })
    const bath = await addRoom(alice, hid, { name: 'Bathroom', icon: 'bath' })
    expect((await rooms('alice', hid)).map((r) => [r.name, r.order])).toEqual([['General', 0], ['Kitchen', 1], ['Bathroom', 2]])

    await updateRoom(alice, hid, kitchen, { name: 'Kitchen & dining', icon: 'sofa' })
    await reorderRooms(alice, hid, [bath, kitchen])
    expect((await rooms('bob', hid)).map((r) => [r.name, r.order, r.icon])).toEqual([
      ['General', 0, 'house'],
      ['Bathroom', 1, 'bath'],
      ['Kitchen & dining', 2, 'sofa'],
    ])

    await deleteRoom(alice, hid, bath)
    expect((await rooms('alice', hid)).map((r) => r.name)).toEqual(['General', 'Kitchen & dining'])
  })

  test('the General room is flagged and can be renamed but not deleted', async () => {
    const hid = await household()
    const alice = dbAs(env, 'alice')
    const [general] = await rooms('alice', hid)
    expect(general).toMatchObject({ name: 'General', isDefault: true })
    await assertSucceeds(updateRoom(alice, hid, general.id, { name: 'Everywhere' }))
    await assertFails(deleteRoom(alice, hid, general.id))
  })

  test('members cannot add, rename, reorder or delete rooms', async () => {
    const hid = await household()
    const kitchen = await addRoom(dbAs(env, 'alice'), hid, { name: 'Kitchen', icon: 'cooking-pot' })
    const bob = dbAs(env, 'bob')
    await assertFails(addRoom(bob, hid, { name: 'Bob’s room', icon: 'bed-double' }))
    await assertFails(updateRoom(bob, hid, kitchen, { name: 'Mine' }))
    await assertFails(reorderRooms(bob, hid, [kitchen]))
    await assertFails(deleteRoom(bob, hid, kitchen))
  })
})
