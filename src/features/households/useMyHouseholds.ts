import { useEffect, useState } from 'react'
import { watchMyHouseholds, type HouseholdSummary } from '../../data/households'
import { db } from '../../lib/firebase'
import { useAuth } from '../auth/useAuth'

export function useMyHouseholds(): { households: HouseholdSummary[]; loading: boolean } {
  const { user } = useAuth()
  const [state, setState] = useState<{ households: HouseholdSummary[]; loading: boolean }>({ households: [], loading: true })
  useEffect(() => {
    if (!user) return
    return watchMyHouseholds(
      db,
      user.uid,
      (households) => setState({ households, loading: false }),
      () => setState({ households: [], loading: false }),
    )
  }, [user])
  return state
}
