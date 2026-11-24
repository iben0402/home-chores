import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore'
import type { MemberColor } from '../components/Avatar'
import { generateCode } from '../lib/inviteCode'

// Household data access. Every function takes the Firestore instance first, so the same code
// runs in the app (lib/firebase `db`) and in emulator tests. Never import lib/firebase here.

export type HouseholdSummary = { id: string; name: string }
export type Household = { id: string; name: string; adminUids: string[]; inviteCode: string }
export type MemberPreview = { uid: string; displayName: string; color: MemberColor; admin: boolean }
export type InviteLookup =
  | { status: 'ok'; householdId: string; householdName: string }
  | { status: 'replaced' }
  | { status: 'not-found' }

type Person = { uid: string; displayName: string }

/** Lowest member colour not yet used; once all 10 are taken, cycle by member count. */
export function nextColor(used: number[]): MemberColor {
  for (let c = 1; c <= 10; c++) if (!used.includes(c)) return c as MemberColor
  return ((used.length % 10) + 1) as MemberColor
}

/**
 * One batch: household (you as the only admin), your member doc, the General room and an active
 * invite. Retries with a new code if the code is already taken (rules refuse to overwrite an invite).
 */
export async function createHousehold(db: Firestore, user: Person, name: string, makeCode: () => string = generateCode): Promise<string> {
  const trimmed = name.trim()
  for (let attempt = 0; attempt < 5; attempt++) {
    const hid = doc(collection(db, 'households')).id
    const code = makeCode()
    const batch = writeBatch(db)
    batch.set(doc(db, 'households', hid), {
      name: trimmed,
      adminUids: [user.uid],
      inviteCode: code,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
    })
    batch.set(doc(db, 'households', hid, 'members', user.uid), {
      uid: user.uid,
      displayName: user.displayName,
      color: 1,
      joinedAt: serverTimestamp(),
    })
    batch.set(doc(collection(db, 'households', hid, 'rooms')), { name: 'General', icon: 'house', order: 0, isDefault: true })
    batch.set(doc(db, 'invites', code), {
      householdId: hid,
      householdName: trimmed,
      active: true,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
    })
    try {
      await batch.commit()
      return hid
    } catch (error) {
      const taken = (await getDoc(doc(db, 'invites', code))).exists()
      if (!taken) throw error
    }
  }
  throw new Error('Could not find a free invite code')
}

export async function findInvite(db: Firestore, code: string): Promise<InviteLookup> {
  const snap = await getDoc(doc(db, 'invites', code))
  if (!snap.exists()) return { status: 'not-found' }
  const data = snap.data()
  if (data.active !== true) return { status: 'replaced' }
  return { status: 'ok', householdId: data.householdId, householdName: data.householdName }
}

export async function getHouseholdPreview(db: Firestore, hid: string): Promise<{ name: string; members: MemberPreview[] }> {
  const [household, members] = await Promise.all([getDoc(doc(db, 'households', hid)), getDocs(collection(db, 'households', hid, 'members'))])
  const admins: string[] = household.data()?.adminUids ?? []
  return {
    name: household.data()?.name ?? '',
    members: members.docs
      .map((m) => m.data())
      .sort((a, b) => Number(admins.includes(b.uid)) - Number(admins.includes(a.uid)))
      .map((m) => ({ uid: m.uid, displayName: m.displayName, color: m.color, admin: admins.includes(m.uid) })),
  }
}

export async function isMember(db: Firestore, hid: string, uid: string): Promise<boolean> {
  return (await getDoc(doc(db, 'households', hid, 'members', uid))).exists()
}

/** Join with an invite code. Joining a household you are already in does nothing. */
export async function joinHousehold(db: Firestore, user: Person, code: string, hid: string): Promise<void> {
  if (await isMember(db, hid, user.uid)) return
  const members = await getDocs(collection(db, 'households', hid, 'members'))
  await setDoc(doc(db, 'households', hid, 'members', user.uid), {
    uid: user.uid,
    displayName: user.displayName,
    color: nextColor(members.docs.map((m) => m.data().color)),
    joinedAt: serverTimestamp(),
    inviteCode: code,
  })
}

/** Live list of the households you belong to, by name. */
export function watchMyHouseholds(db: Firestore, uid: string, onChange: (households: HouseholdSummary[]) => void, onError?: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    query(collectionGroup(db, 'members'), where('uid', '==', uid)),
    async (snap) => {
      const ids = snap.docs.map((m) => m.ref.parent.parent!.id)
      const households = await Promise.all(ids.map((id) => getDoc(doc(db, 'households', id))))
      onChange(
        households
          .filter((h) => h.exists())
          .map((h) => ({ id: h.id, name: h.data()!.name as string }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      )
    },
    onError,
  )
}

export function watchHousehold(db: Firestore, hid: string, onChange: (household: Household | null) => void, onError?: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    doc(db, 'households', hid),
    (snap) => {
      const data = snap.data()
      onChange(data ? { id: snap.id, name: data.name, adminUids: data.adminUids, inviteCode: data.inviteCode } : null)
    },
    onError,
  )
}
