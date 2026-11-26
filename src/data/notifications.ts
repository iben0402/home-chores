import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
  type Unsubscribe,
  type WriteBatch,
} from 'firebase/firestore'
import type { MemberColor } from '../components/Avatar'

// In-app notifications (spec §8.10): users/{uid}/notifications. Written by the client that makes the
// change, in the same batch as the change; only the recipient reads, marks read or deletes them.

export const NOTIFICATION_DAYS = 60
export const NOTIFICATION_LIMIT = 30

export type NotificationType = 'assigned' | 'changed' | 'renamed' | 'removed'

export type AppNotification = {
  id: string
  type: NotificationType
  householdId: string
  householdName: string
  choreId: string
  occurrenceId?: string
  choreTitle: string
  /** renamed: the title before. */
  previousTitle?: string
  dueDate?: string
  fromUid: string
  fromName: string
  fromColor: MemberColor
  read: boolean
  createdAt: Date | null
}

/** Who is sending, as the rules check it: their member name and colour, and the household's name. */
export type Sender = { uid: string; name: string; color: MemberColor; householdId: string; householdName: string }

export type NotificationContent = {
  type: NotificationType
  choreId: string
  choreTitle: string
  occurrenceId?: string
  previousTitle?: string
  dueDate?: string
}

const inboxOf = (db: Firestore, uid: string) => collection(db, 'users', uid, 'notifications')

/** Reads the sender's member doc and the household name (copied into each notification). */
export async function senderIn(db: Firestore, hid: string, uid: string): Promise<Sender> {
  const [member, household] = await Promise.all([getDoc(doc(db, 'households', hid, 'members', uid)), getDoc(doc(db, 'households', hid))])
  return {
    uid,
    name: (member.data()?.displayName as string) ?? '',
    color: (member.data()?.color as MemberColor) ?? 1,
    householdId: hid,
    householdName: (household.data()?.name as string) ?? '',
  }
}

/** Adds a notification for `to` to the batch. Never to yourself. */
export function addNotification(batch: WriteBatch, db: Firestore, to: string, from: Sender, content: NotificationContent): void {
  if (to === from.uid) return
  const data: Record<string, unknown> = {
    type: content.type,
    householdId: from.householdId,
    householdName: from.householdName,
    choreId: content.choreId,
    choreTitle: content.choreTitle,
    fromUid: from.uid,
    fromName: from.name,
    fromColor: from.color,
    read: false,
    createdAt: serverTimestamp(),
  }
  if (content.occurrenceId) data.occurrenceId = content.occurrenceId
  if (content.previousTitle) data.previousTitle = content.previousTitle
  if (content.dueDate) data.dueDate = content.dueDate
  batch.set(doc(inboxOf(db, to)), data)
}

/** Your newest notifications from the last 60 days (newest first, at most 30). */
export function watchNotifications(
  db: Firestore,
  uid: string,
  now: Date,
  onChange: (list: AppNotification[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const since = Timestamp.fromMillis(now.getTime() - NOTIFICATION_DAYS * 24 * 60 * 60 * 1000)
  return onSnapshot(
    query(inboxOf(db, uid), where('createdAt', '>=', since), orderBy('createdAt', 'desc'), limit(NOTIFICATION_LIMIT)),
    // Pending server timestamps read as "now" so a just-sent one sorts and shows correctly.
    (snap) =>
      onChange(
        snap.docs.map((d) => {
          const data = d.data({ serverTimestamps: 'estimate' })
          return { id: d.id, ...data, createdAt: (data.createdAt as Timestamp | null)?.toDate() ?? null } as AppNotification
        }),
      ),
    onError,
  )
}

export async function markNotificationRead(db: Firestore, uid: string, id: string): Promise<void> {
  await updateDoc(doc(inboxOf(db, uid), id), { read: true })
}

/** Marks every unread notification read (including any older than the panel shows). */
export async function markAllNotificationsRead(db: Firestore, uid: string): Promise<void> {
  const unread = await getDocs(query(inboxOf(db, uid), where('read', '==', false)))
  for (let i = 0; i < unread.docs.length; i += 400) {
    const batch = writeBatch(db)
    unread.docs.slice(i, i + 400).forEach((d) => batch.update(d.ref, { read: true }))
    await batch.commit()
  }
}
