import { useEffect, useState } from 'react'
import { Navigate, Outlet, useParams } from 'react-router'
import { AppHeader } from '../../components/AppHeader'
import { OfflineNotice } from '../../components/OfflineNotice'
import { TabBar } from '../../components/TabBar'
import { watchHousehold, watchMembership, type Household } from '../../data/households'
import { db } from '../../lib/firebase'
import { setLastHousehold } from '../../lib/lastHousehold'
import { useAuth } from '../auth/useAuth'

/** A fresh layout per household, so nothing from the previous one lingers while the next loads. */
export function HouseholdRoute() {
  const { hid = '' } = useParams()
  return <HouseholdLayout key={hid} />
}

/**
 * /h/:hid — the in-household shell: header with the household name, content, bottom tabs.
 * Only for members: anyone else (or someone just removed) is sent to "/".
 */
function HouseholdLayout() {
  const { hid = '' } = useParams()
  const { user } = useAuth()
  const [household, setHousehold] = useState<Household | null | undefined>(undefined)
  const [member, setMember] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    if (!user) return
    const stopHousehold = watchHousehold(db, hid, setHousehold, () => setHousehold(null))
    const stopMember = watchMembership(db, hid, user.uid, setMember, () => setMember(false))
    return () => {
      stopHousehold()
      stopMember()
    }
  }, [hid, user])

  useEffect(() => {
    if (member) setLastHousehold(hid)
  }, [hid, member])

  // Tell "/" which household refused us, so it can't send us straight back (redirect loop).
  if (member === false || household === null) return <Navigate to="/" replace state={{ notMemberOf: hid }} />
  if (member === undefined || household === undefined) return null

  // Content sits in the centred column; the header and tab bar span the full window width.
  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-fg">
      <AppHeader household={household.name} />
      <div className="mx-auto flex w-full max-w-(--size-content) flex-1 flex-col">
        <OfflineNotice className="mx-4 mb-2" />
        <main className="flex-1">
          <Outlet context={household} />
        </main>
      </div>
      <div className="sticky bottom-0">
        <TabBar hid={hid} />
      </div>
    </div>
  )
}
