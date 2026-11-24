import { useEffect, useState } from 'react'
import { watchMyHouseholds, type HouseholdSummary } from '../../data/households'
import { db } from '../../lib/firebase'
import { useAuth } from '../auth/useAuth'

type State = { households: HouseholdSummary[]; loading: boolean; error: boolean }

export function useMyHouseholds(): State {
  const uid = useAuth().user?.uid
  const [state, setState] = useState<State>({ households: [], loading: true, error: false })
  useEffect(() => {
    if (!uid) return
    return watchMyHouseholds(
      db,
      uid,
      (households) => setState({ households, loading: false, error: false }),
      // An error is not "no households": never send someone to Get started because of it.
      () => setState((s) => ({ ...s, loading: false, error: true })),
    )
  }, [uid])
  return state
}
