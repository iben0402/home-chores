import { useAuth } from '../auth/useAuth'
import { useHousehold } from './useHousehold'

/** For showing admin-only UI. The rules are what actually enforce it. */
export function useIsAdmin(): boolean {
  const { user } = useAuth()
  const household = useHousehold()
  return !!user && household.adminUids.includes(user.uid)
}
