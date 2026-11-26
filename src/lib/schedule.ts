// Pure date and schedule logic. Dates are "YYYY-MM-DD" strings in the device's local time
// (spec §9); arithmetic is done in UTC on those calendar dates, so DST never shifts a day.

export type Unit = 'day' | 'week' | 'month'
export type ChoreRule =
  | { kind: 'oneoff' }
  | { kind: 'interval'; every: number; unit: Unit }
  | { kind: 'calendar'; freq: 'weekly'; weekdays: readonly number[] } // 0 = Sunday … 6 = Saturday
  | { kind: 'calendar'; freq: 'monthly'; dayOfMonth: number }

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
/** What the schedule editor edits (design system ScheduleEditor). */
export type ScheduleForm = {
  mode: 'once' | 'after' | 'calendar'
  every: number
  unit: 'days' | 'weeks' | 'months'
  calMode: 'week' | 'month'
  days: DayKey[]
  dom: number
}

export const DAYS: Array<{ key: DayKey; short: string; name: string; index: number }> = [
  { key: 'mon', short: 'M', name: 'Monday', index: 1 },
  { key: 'tue', short: 'T', name: 'Tuesday', index: 2 },
  { key: 'wed', short: 'W', name: 'Wednesday', index: 3 },
  { key: 'thu', short: 'T', name: 'Thursday', index: 4 },
  { key: 'fri', short: 'F', name: 'Friday', index: 5 },
  { key: 'sat', short: 'S', name: 'Saturday', index: 6 },
  { key: 'sun', short: 'S', name: 'Sunday', index: 0 },
]
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const pad = (n: number) => String(n).padStart(2, '0')
const toISO = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
const fromISO = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}
const daysInMonth = (y: number, m0: number) => new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate()

/** Today's date on this device. */
export function todayISO(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function addDays(iso: string, n: number): string {
  const d = fromISO(iso)
  d.setUTCDate(d.getUTCDate() + n)
  return toISO(d)
}

/** Same day n months later, clamped to the end of shorter months (31 Jan + 1 → 28/29 Feb). */
export function addMonths(iso: string, n: number): string {
  const d = fromISO(iso)
  const total = d.getUTCMonth() + n
  const y = d.getUTCFullYear() + Math.floor(total / 12)
  const m0 = ((total % 12) + 12) % 12
  return toISO(new Date(Date.UTC(y, m0, Math.min(d.getUTCDate(), daysInMonth(y, m0)))))
}

export function weekday(iso: string): number {
  return fromISO(iso).getUTCDay()
}

function addInterval(iso: string, every: number, unit: Unit, times = 1): string {
  if (unit === 'month') return addMonths(iso, every * times)
  return addDays(iso, every * times * (unit === 'week' ? 7 : 1))
}

function matches(rule: Extract<ChoreRule, { kind: 'calendar' }>, iso: string): boolean {
  if (rule.freq === 'weekly') return rule.weekdays.includes(weekday(iso))
  const d = fromISO(iso)
  return d.getUTCDate() === Math.min(rule.dayOfMonth, daysInMonth(d.getUTCFullYear(), d.getUTCMonth()))
}

/** The first date matching a calendar rule on/after (inclusive) or after (exclusive) `fromISO`. */
export function nextCalendarDate(rule: Extract<ChoreRule, { kind: 'calendar' }>, fromISO: string, inclusive: boolean): string {
  let iso = inclusive ? fromISO : addDays(fromISO, 1)
  for (let i = 0; i < 400; i++, iso = addDays(iso, 1)) if (matches(rule, iso)) return iso
  throw new Error('No matching date within a year')
}

/** Due dates for a new chore's first `n` occurrences, starting `startISO` (calendar: first match on/after it). */
export function initialDates(rule: ChoreRule, startISO: string, n: number): string[] {
  if (rule.kind === 'oneoff') return [startISO]
  if (rule.kind === 'interval') return Array.from({ length: n }, (_, i) => addInterval(startISO, rule.every, rule.unit, i))
  const out = [nextCalendarDate(rule, startISO, true)]
  while (out.length < n) out.push(nextCalendarDate(rule, out[out.length - 1], false))
  return out
}

/**
 * After completing on `doneISO`: new dates for the `count` remaining open occurrences (in seq order).
 * Interval chores count from when they were last done; calendar chores keep their dates (null).
 */
export function redate(rule: ChoreRule, doneISO: string, count: number): string[] | null {
  if (rule.kind !== 'interval') return null
  return Array.from({ length: count }, (_, i) => addInterval(doneISO, rule.every, rule.unit, i + 1))
}

/** Due date for a new occurrence added after the last open one. */
export function topUpDate(rule: ChoreRule, lastISO: string): string {
  if (rule.kind === 'interval') return addInterval(lastISO, rule.every, rule.unit)
  if (rule.kind === 'calendar') return nextCalendarDate(rule, lastISO, false)
  return lastISO
}

export type DueStatus = 'overdue' | 'today' | 'week' | 'later'

/** Today sections: Overdue (before today), Today, This week (to Sunday of this Mon–Sun week), Later. */
export function dueStatus(iso: string, today: string): DueStatus {
  if (iso < today) return 'overdue'
  if (iso === today) return 'today'
  const daysToSunday = (7 - weekday(today)) % 7
  return iso <= addDays(today, daysToSunday) ? 'week' : 'later'
}

/** "Today", "Thu 3 Dec", or "Tue 5 Jan 2027" when not this year. */
export function dueLabel(iso: string, today: string): string {
  if (iso === today) return 'Today'
  const d = fromISO(iso)
  const base = `${WEEKDAY_SHORT[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH_SHORT[d.getUTCMonth()]}`
  return iso.slice(0, 4) === today.slice(0, 4) ? base : `${base} ${iso.slice(0, 4)}`
}

export function ruleFromForm(form: ScheduleForm): ChoreRule {
  if (form.mode === 'once') return { kind: 'oneoff' }
  if (form.mode === 'after') return { kind: 'interval', every: form.every, unit: form.unit.replace(/s$/, '') as Unit }
  if (form.calMode === 'month') return { kind: 'calendar', freq: 'monthly', dayOfMonth: form.dom }
  const weekdays = DAYS.filter((d) => form.days.includes(d.key)).map((d) => d.index)
  return { kind: 'calendar', freq: 'weekly', weekdays: weekdays.sort((a, b) => a - b) }
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function listJoin(items: string[]): string {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/** The ScheduleEditor's plain-language summary. */
export function describeSchedule(form: ScheduleForm): string {
  if (form.mode === 'once') return 'Just once, whenever someone gets to it.'
  if (form.mode === 'after') {
    const unit = form.every === 1 ? form.unit.replace(/s$/, '') : form.unit
    return `Due again ${form.every} ${unit} after someone last did it.`
  }
  if (form.calMode === 'month') return `Every month on the ${ordinal(form.dom)}${form.dom > 28 ? ' (or the last day of shorter months).' : '.'}`
  const names = DAYS.filter((d) => form.days.includes(d.key)).map((d) => d.name)
  return names.length ? `Every ${listJoin(names)}, no matter when it was last done.` : 'Pick at least one day.'
}

/** The editor's preview: "If done today: …" (after) or "Next: …" (calendar), three dates. */
export function previewDates(form: ScheduleForm, today: string, n = 3): string[] {
  if (form.mode === 'once') return []
  const rule = ruleFromForm(form)
  if (rule.kind === 'interval') return Array.from({ length: n }, (_, i) => dueLabel(addInterval(today, rule.every, rule.unit, i + 1), today))
  if (rule.kind === 'calendar' && (rule.freq === 'monthly' || rule.weekdays.length > 0)) {
    const out: string[] = []
    let iso = today
    while (out.length < n) {
      iso = nextCalendarDate(rule, iso, false)
      out.push(iso)
    }
    return out.map((d) => dueLabel(d, today))
  }
  return []
}

/** The schedule editor's state for an existing rule (editing a chore). */
export function formFromRule(rule: ChoreRule): ScheduleForm {
  const base: ScheduleForm = { mode: 'once', every: 1, unit: 'weeks', calMode: 'week', days: ['mon'], dom: 1 }
  if (rule.kind === 'interval') return { ...base, mode: 'after', every: rule.every, unit: `${rule.unit}s` as ScheduleForm['unit'] }
  if (rule.kind === 'calendar' && rule.freq === 'monthly') return { ...base, mode: 'calendar', calMode: 'month', dom: rule.dayOfMonth }
  if (rule.kind === 'calendar') return { ...base, mode: 'calendar', calMode: 'week', days: DAYS.filter((d) => rule.weekdays.includes(d.index)).map((d) => d.key) }
  return base
}

/**
 * When the next one is due if the current one is completed (or skipped) on `doneISO`: interval chores
 * count from then; calendar chores keep their dates (the next open one, or the next match).
 */
export function nextDueAfter(rule: ChoreRule, doneISO: string, currentDue: string, laterOpen: string[]): string | null {
  if (rule.kind === 'oneoff') return null
  if (rule.kind === 'interval') return addInterval(doneISO, rule.every, rule.unit)
  return laterOpen[0] ?? nextCalendarDate(rule, currentDue > doneISO ? currentDue : doneISO, false)
}
