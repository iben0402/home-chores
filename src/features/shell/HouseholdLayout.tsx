import { useEffect, useState } from 'react'
import { Link, Navigate, Outlet, useLocation, useParams } from 'react-router'
import { AppHeader } from '../../components/AppHeader'
import { OfflineNotice } from '../../components/OfflineNotice'
import { TabBar } from '../../components/TabBar'
import { watchHousehold, watchMembership, type Household } from '../../data/households'
import { db } from '../../lib/firebase'
import { setLastHousehold } from '../../lib/lastHousehold'
import { useAuth } from '../auth/useAuth'
import { EmptyState } from '../../components/EmptyState'
import { useMyHouseholds } from '../households/useMyHouseholds'
import { SwitcherSheet } from './SwitcherSheet'

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
  // Was a member during this visit: losing membership then means "removed", not "never in it".
  const [wasMember, setWasMember] = useState(false)
  const [switching, setSwitching] = useState(false)
  // Tab screens show the household header; sub-pages (a room, Manage rooms, a chore) have their own back bar.
  const subPage = /^\/h\/[^/]+\/((rooms|chores)\/.+|household$)/.test(useLocation().pathname)

  useEffect(() => {
    if (!user) return
    const stopHousehold = watchHousehold(db, hid, setHousehold, () => setHousehold(null))
    const stopMember = watchMembership(
      db,
      hid,
      user.uid,
      (m) => {
        setMember(m)
        if (m) setWasMember(true)
      },
      () => setMember(false),
    )
    return () => {
      stopHousehold()
      stopMember()
    }
  }, [hid, user])

  useEffect(() => {
    if (member) setLastHousehold(hid)
  }, [hid, member])

  if (member === false && wasMember && household) return <Removed household={household.name} hid={hid} />
  // Tell "/" which household refused us, so it can't send us straight back (redirect loop).
  if (member === false || household === null) return <Navigate to="/" replace state={{ notMemberOf: hid }} />
  if (member === undefined || household === undefined) return null

  // Content sits in the centred column; the header and tab bar span the full window width.
  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-fg">
      {!subPage && <AppHeader household={household.name} onSwitch={() => setSwitching(true)} />}
      <div className="mx-auto flex w-full max-w-(--size-content) flex-1 flex-col">
        <OfflineNotice className="mx-4 mb-2" />
        <main className="flex-1">
          <Outlet context={household} />
        </main>
      </div>
      {/* z-index here: sticky makes its own stacking context, so the tab bar must sit above row controls (z-[1]) from this level. */}
      <div className="sticky bottom-0 z-(--z-header)">
        <TabBar hid={hid} />
      </div>
      {switching && <SwitcherSheet current={hid} onClose={() => setSwitching(false)} />}
    </div>
  )
}

/** 5c · Removed from a household while using it. */
function Removed({ household, hid }: { household: string; hid: string }) {
  const { households } = useMyHouseholds()
  const other = households.find((h) => h.id !== hid)
  const button = 'inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-md px-5 text-[17px] font-semibold no-underline'
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-4 text-fg">
      <EmptyState icon="door-open" title={`You’re no longer in ${household}`} body="An admin removed you from this household. Anything you did there stays in its history.">
        {other && (
          <Link to={`/h/${other.id}`} className={`${button} bg-primary text-on-primary hover:bg-primary-hover`}>
            Go to {other.name}
          </Link>
        )}
        <Link to="/start" className={`${button} border border-border-strong bg-surface text-fg hover:bg-surface-hover`}>
          Create or join a household
        </Link>
      </EmptyState>
    </div>
  )
}
