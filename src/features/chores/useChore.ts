import { useEffect, useState } from 'react'
import { watchChore, type Chore } from '../../data/chores'
import { db } from '../../lib/firebase'

/** Live chore: undefined while loading, null if it doesn't exist. */
export function useChore(hid: string, choreId: string): Chore | null | undefined {
  const [chore, setChore] = useState<Chore | null | undefined>(undefined)
  useEffect(() => watchChore(db, hid, choreId, setChore, () => setChore(null)), [hid, choreId])
  return chore
}
