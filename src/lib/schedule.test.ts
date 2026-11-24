import {
  addDays,
  addMonths,
  describeSchedule,
  dueLabel,
  dueStatus,
  initialDates,
  nextCalendarDate,
  previewDates,
  redate,
  ruleFromForm,
  todayISO,
  topUpDate,
  type ScheduleForm,
} from './schedule'

const form = (f: Partial<ScheduleForm>): ScheduleForm => ({ mode: 'after', every: 1, unit: 'weeks', calMode: 'week', days: ['mon'], dom: 1, ...f })

describe('date arithmetic', () => {
  test('todayISO uses local time', () => {
    expect(todayISO(new Date(2026, 10, 24, 23, 59))).toBe('2026-11-24')
  })
  test.each([
    ['2026-11-30', 1, '2026-12-01'],
    ['2026-12-31', 1, '2027-01-01'],
    ['2026-03-01', -1, '2026-02-28'],
    ['2026-03-29', 7, '2026-04-05'], // across a DST change
  ])('addDays(%s, %i) = %s', (iso, n, expected) => expect(addDays(iso, n)).toBe(expected))
  test.each([
    ['2026-01-31', 1, '2026-02-28'],
    ['2024-01-31', 1, '2024-02-29'],
    ['2026-08-31', 1, '2026-09-30'],
    ['2026-11-15', 2, '2027-01-15'],
  ])('addMonths(%s, %i) = %s (clamped to month end)', (iso, n, expected) => expect(addMonths(iso, n)).toBe(expected))
})

describe('rules from the schedule editor', () => {
  test('after it’s done → interval', () => {
    expect(ruleFromForm(form({ mode: 'after', every: 2, unit: 'weeks' }))).toEqual({ kind: 'interval', every: 2, unit: 'week' })
  })
  test('on set days → weekly calendar (0 = Sunday)', () => {
    expect(ruleFromForm(form({ mode: 'calendar', calMode: 'week', days: ['mon', 'sun'] }))).toEqual({ kind: 'calendar', freq: 'weekly', weekdays: [0, 1] })
  })
  test('day of the month → monthly calendar', () => {
    expect(ruleFromForm(form({ mode: 'calendar', calMode: 'month', dom: 31 }))).toEqual({ kind: 'calendar', freq: 'monthly', dayOfMonth: 31 })
  })
  test('once → one-off', () => {
    expect(ruleFromForm(form({ mode: 'once' }))).toEqual({ kind: 'oneoff' })
  })
})

describe('occurrence dates', () => {
  const weekly = { kind: 'interval', every: 1, unit: 'week' } as const
  const bins = { kind: 'calendar', freq: 'weekly', weekdays: [1] } as const // Mondays
  const monthEnd = { kind: 'calendar', freq: 'monthly', dayOfMonth: 31 } as const

  test('interval: first due on the start date, then every interval', () => {
    expect(initialDates(weekly, '2026-11-24', 4)).toEqual(['2026-11-24', '2026-12-01', '2026-12-08', '2026-12-15'])
  })
  test('monthly interval stays on the same day, clamped', () => {
    expect(initialDates({ kind: 'interval', every: 1, unit: 'month' }, '2026-01-31', 3)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31'])
  })
  test('calendar: includes today when it matches', () => {
    expect(initialDates(bins, '2026-11-23', 3)).toEqual(['2026-11-23', '2026-11-30', '2026-12-07'])
    expect(initialDates(bins, '2026-11-24', 2)).toEqual(['2026-11-30', '2026-12-07'])
  })
  test('calendar: day 31 means the last day of shorter months', () => {
    expect(initialDates(monthEnd, '2026-01-15', 4)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'])
  })
  test('several weekdays', () => {
    expect(initialDates({ kind: 'calendar', freq: 'weekly', weekdays: [2, 5] }, '2026-11-24', 4)).toEqual(['2026-11-24', '2026-11-27', '2026-12-01', '2026-12-04'])
  })
  test('nextCalendarDate exclusive vs inclusive', () => {
    expect(nextCalendarDate(bins, '2026-11-23', false)).toBe('2026-11-30')
    expect(nextCalendarDate(bins, '2026-11-23', true)).toBe('2026-11-23')
  })
  test('done late: the remaining queue moves from the completion day', () => {
    expect(redate(weekly, '2026-12-03', 3)).toEqual(['2026-12-10', '2026-12-17', '2026-12-24'])
  })
  test('done early: same rule, counted from when it was done', () => {
    expect(redate({ kind: 'interval', every: 3, unit: 'day' }, '2026-11-20', 2)).toEqual(['2026-11-23', '2026-11-26'])
  })
  test('calendar chores are not re-dated', () => {
    expect(redate(bins, '2026-12-03', 3)).toBeNull()
  })
  test('top-up follows the last open occurrence', () => {
    expect(topUpDate(weekly, '2026-12-24')).toBe('2026-12-31')
    expect(topUpDate(bins, '2026-12-07')).toBe('2026-12-14')
    expect(topUpDate(monthEnd, '2027-01-31')).toBe('2027-02-28')
  })
})

describe('sections and labels (today = Tue 24 Nov 2026)', () => {
  const today = '2026-11-24'
  test.each([
    ['2026-11-23', 'overdue'],
    ['2026-11-24', 'today'],
    ['2026-11-25', 'week'],
    ['2026-11-29', 'week'], // Sunday ends the week
    ['2026-11-30', 'later'],
  ])('%s is %s', (iso, status) => expect(dueStatus(iso, today)).toBe(status))
  test.each([
    ['2026-11-24', 'Today'],
    ['2026-12-03', 'Thu 3 Dec'],
    ['2027-01-05', 'Tue 5 Jan 2027'],
  ])('label %s → %s', (iso, label) => expect(dueLabel(iso, today)).toBe(label))
})

describe('schedule editor summary', () => {
  test.each([
    [form({ mode: 'once' }), 'Just once, whenever someone gets to it.'],
    [form({ mode: 'after', every: 1, unit: 'weeks' }), 'Due again 1 week after someone last did it.'],
    [form({ mode: 'after', every: 3, unit: 'days' }), 'Due again 3 days after someone last did it.'],
    [form({ mode: 'calendar', calMode: 'week', days: ['mon'] }), 'Every Monday, no matter when it was last done.'],
    [form({ mode: 'calendar', calMode: 'week', days: ['tue', 'fri', 'mon'] }), 'Every Monday, Tuesday and Friday, no matter when it was last done.'],
    [form({ mode: 'calendar', calMode: 'week', days: [] }), 'Pick at least one day.'],
    [form({ mode: 'calendar', calMode: 'month', dom: 1 }), 'Every month on the 1st.'],
    [form({ mode: 'calendar', calMode: 'month', dom: 31 }), 'Every month on the 31st (or the last day of shorter months).'],
  ])('%j', (f, text) => expect(describeSchedule(f)).toBe(text))

  test('preview: if done today / next set days', () => {
    expect(previewDates(form({ mode: 'after', every: 1, unit: 'weeks' }), '2026-11-24')).toEqual(['Tue 1 Dec', 'Tue 8 Dec', 'Tue 15 Dec'])
    expect(previewDates(form({ mode: 'calendar', calMode: 'week', days: ['mon'] }), '2026-11-24')).toEqual(['Mon 30 Nov', 'Mon 7 Dec', 'Mon 14 Dec'])
    expect(previewDates(form({ mode: 'once' }), '2026-11-24')).toEqual([])
  })
})
