import { useOutletContext } from 'react-router'
import type { Household } from '../../data/households'

/** The current household, inside /h/:hid (provided by HouseholdLayout). */
export function useHousehold(): Household {
  return useOutletContext<Household>()
}
