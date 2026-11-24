import type { InviteLookup } from '../../data/households'

export const NOT_FOUND = 'That code doesn’t match a household. Check it with whoever sent it.'
export const REPLACED = 'That code has been replaced with a new one. Ask for the latest code.'

export function inviteError(lookup: InviteLookup): string | undefined {
  if (lookup.status === 'not-found') return NOT_FOUND
  if (lookup.status === 'replaced') return REPLACED
  return undefined
}
