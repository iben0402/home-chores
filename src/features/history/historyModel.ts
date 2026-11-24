import type { HistoryEntry } from '../../data/history'

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

/** "Today", "Yesterday", "Sat 28 Nov" (+ year if not this year). */
export function dayLabel(d: Date, now: Date = new Date()): string {
  const diff = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  const base = `${WEEKDAY[d.getDay()]} ${d.getDate()} ${MONTH[d.getMonth()]}`
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`
}

/** "yesterday", "today", "on Sat 28 Nov" for sentences. */
export function dayPhrase(d: Date, now: Date = new Date()): string {
  const label = dayLabel(d, now)
  return label === 'Today' || label === 'Yesterday' ? label.toLowerCase() : `on ${label}`
}

export function timeLabel(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Entries (newest first) grouped by day. */
export function groupByDay(entries: HistoryEntry[], now: Date = new Date()): Array<{ label: string; entries: HistoryEntry[] }> {
  const groups: Array<{ label: string; entries: HistoryEntry[] }> = []
  for (const e of entries) {
    const label = dayLabel(e.doneAt, now)
    const last = groups.at(-1)
    if (last?.label === label) last.entries.push(e)
    else groups.push({ label, entries: [e] })
  }
  return groups
}
