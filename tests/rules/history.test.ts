import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest'
import { completeOccurrence, createChore } from '../../src/data/chores'
import { deleteEntry, undoFromHistory, watchHistory, type HistoryEntry } from '../../src/data/history'
import { createHousehold, joinHousehold } from '../../src/data/households'
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
  const open = await getDocs(query(collection(dbAs(env, 'bob'), 'households', hid, 'occurrences'), where('choreId', '==', choreId), where('status', '==', 'open')))
  const first = open.docs.find((d) => d.data().seq === 0)!.id
  await completeOccurrence(dbAs(env, 'bob'), hid, first, BOB, '2026-11-24')
  return { hid, choreId, first }
}

function history(uid: string, hid: string): Promise<HistoryEntry[]> {
  return new Promise((resolve, reject) => {
    const stop = watchHistory(dbAs(env, uid), hid, (list) => {
      stop()
      resolve(list)
    }, reject)
  })
}

const openCount = async (hid: string, choreId: string) =>
  (await getDocs(query(collection(dbAs(env, 'alice'), 'households', hid, 'occurrences'), where('choreId', '==', choreId), where('status', '==', 'open')))).size

describe('history', () => {
  test('lists done entries, newest first, with who and when', async () => {
    const { hid } = await setup()
    const [entry] = await history('alice', hid)
    expect(entry).toMatchObject({ choreTitle: 'Vacuuming', doneBy: 'bob', doneByName: 'Bob Reid' })
    expect(entry.doneAt).toBeInstanceOf(Date)
  })

  test('the person who ticked it can undo from History: back to open, the extra occurrence removed', async () => {
    const { hid, choreId, first } = await setup()
    expect(await openCount(hid, choreId)).toBe(4)
    const [entry] = await history('bob', hid)
    await undoFromHistory(dbAs(env, 'bob'), hid, entry)
    expect(await history('bob', hid)).toEqual([])
    expect(await openCount(hid, choreId)).toBe(4)
    const reopened = await getDocs(query(collection(dbAs(env, 'bob'), 'households', hid, 'occurrences'), where('status', '==', 'open')))
    expect(reopened.docs.some((d) => d.id === first)).toBe(true)
  })

  test('someone else cannot undo it; members cannot delete entries; admins can', async () => {
    const { hid } = await setup()
    const [entry] = await history('alice', hid)
    await joinHousehold(dbAs(env, 'carol'), { uid: 'carol', displayName: 'Carol' }, 'K7QM4XRT', hid)
    await assertFails(undoFromHistory(dbAs(env, 'carol'), hid, entry))
    await assertFails(deleteEntry(dbAs(env, 'bob'), hid, entry.id))
    await assertSucceeds(deleteEntry(dbAs(env, 'alice'), hid, entry.id))
    expect(await history('alice', hid)).toEqual([])
  })
})
