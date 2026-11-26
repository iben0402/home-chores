import { readFileSync } from 'node:fs'
import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, test } from 'vitest'

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-home-chores-rules', // not the dev app's project: tests clear the database
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  })
})

beforeEach(() => testEnv.clearFirestore())
afterAll(() => testEnv.cleanup())

describe('baseline: anything not explicitly allowed is denied', () => {
  test('unauthenticated read of households/h1 is denied', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(db, 'households/h1')))
  })

  test('unauthenticated write of households/h1 is denied', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(setDoc(doc(db, 'households/h1'), { name: 'x' }))
  })

  test('signed-in user read of an unknown collection is denied', async () => {
    const db = testEnv.authenticatedContext('alice').firestore()
    await assertFails(getDoc(doc(db, 'secrets/s1')))
  })

  test('signed-in user write of users/alice is denied', async () => {
    const db = testEnv.authenticatedContext('alice').firestore()
    await assertFails(setDoc(doc(db, 'users/alice'), { displayName: 'Alice' }))
  })
})
