import { useEffect, useState } from 'react'
import { watchNotifications, type AppNotification } from '../../data/notifications'
import { db } from '../../lib/firebase'

export type NotificationsState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; items: AppNotification[] }

/** Your inbox, live (last 60 days, newest 30). `retry` re-subscribes after an error. */
export function useNotifications(uid: string | undefined): { state: NotificationsState; unread: number; retry: () => void } {
  const [state, setState] = useState<NotificationsState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!uid) return
    return watchNotifications(
      db,
      uid,
      new Date(),
      (items) => setState({ status: 'ready', items }),
      () => setState({ status: 'error' }),
    )
  }, [uid, attempt])
  const unread = state.status === 'ready' ? state.items.filter((n) => !n.read).length : 0
  const retry = () => {
    setState({ status: 'loading' })
    setAttempt((a) => a + 1)
  }
  return { state, unread, retry }
}
