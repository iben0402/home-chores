import { Navigate, useLocation } from 'react-router'
import { ErrorState } from '../components/ErrorState'
import { useMyHouseholds } from '../features/households/useMyHouseholds'
import { getLastHousehold } from '../lib/lastHousehold'

/** "/": your last-used household if you're still in it, else your first, else Get started. */
export function HomeRedirect() {
  const { households: all, loading, error } = useMyHouseholds()
  const refused = (useLocation().state as { notMemberOf?: string } | null)?.notMemberOf
  if (loading) return null
  if (error) return <ErrorState />
  // The members list can lag behind a removal; never go back to the household that just refused us.
  const households = all.filter((h) => h.id !== refused)
  if (households.length === 0) return <Navigate to="/start" replace />
  const last = getLastHousehold()
  const target = households.find((h) => h.id === last) ?? households[0]
  return <Navigate to={`/h/${target.id}`} replace />
}
