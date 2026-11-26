import type { AppNotification } from '../../data/notifications'
import { dueLabel, todayISO } from '../../lib/schedule'

// Wording from Copy sheet v1 › Notifications.

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const pad = (n: number) => String(n).padStart(2, '0')
const dayBefore = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1)

/** "Just now" · "5 min ago" · "3 hours ago" · "Yesterday, 18:40" · "Thu 3 Dec" (year only if not this year). */
export function relativeTime(at: Date, now: Date): string {
  const minutes = Math.floor((now.getTime() - at.getTime()) / 60000)
  if (minutes < 1) return 'Just now'
  if (todayISO(at) === todayISO(now)) {
    if (minutes < 60) return `${minutes} min ago`
    const hours = Math.floor(minutes / 60)
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`
  }
  if (todayISO(at) === todayISO(dayBefore(now))) return `Yesterday, ${pad(at.getHours())}:${pad(at.getMinutes())}`
  const base = `${WEEKDAY[at.getDay()]} ${at.getDate()} ${MONTH[at.getMonth()]}`
  return at.getFullYear() === now.getFullYear() ? base : `${base} ${at.getFullYear()}`
}

export type GroupLabel = 'Today' | 'Yesterday' | 'Earlier'
export function groupOf(at: Date, now: Date): GroupLabel {
  if (todayISO(at) === todayISO(now)) return 'Today'
  if (todayISO(at) === todayISO(dayBefore(now))) return 'Yesterday'
  return 'Earlier'
}

/** The sentence, in parts, so names and chores can be bold: {actor}{mid}{title}[ to {title2}]{tail}. */
export type Sentence = { actor: string; mid: string; title: string; title2?: string; tail: string }

export function sentenceOf(n: AppNotification, today: string): Sentence {
  const actor = n.fromName.trim().split(/\s+/)[0] || 'Someone'
  const due = n.dueDate ? dueLabel(n.dueDate, today) : null
  switch (n.type) {
    case 'assigned':
      return { actor, mid: ' assigned you ', title: n.choreTitle, tail: due ? ` · ${due}` : '' }
    case 'changed':
      return { actor, mid: ' changed ', title: n.choreTitle, tail: due ? `: now ${due}` : ': now any time' }
    case 'renamed':
      return { actor, mid: ' renamed ', title: n.previousTitle ?? n.choreTitle, title2: n.choreTitle, tail: '' }
    default:
      return { actor, mid: ' removed ', title: n.choreTitle, tail: due ? ` · ${due}` : '' }
  }
}

export function sentenceText(s: Sentence): string {
  return `${s.actor}${s.mid}${s.title}${s.title2 ? ` to ${s.title2}` : ''}${s.tail}`
}

/** Removed chores have nothing to open. */
export const opensChore = (n: AppNotification) => n.type !== 'removed'
