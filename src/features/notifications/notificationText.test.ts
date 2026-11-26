import { describe, expect, test } from 'vitest'
import type { AppNotification } from '../../data/notifications'
import { groupOf, relativeTime, sentenceOf, sentenceText } from './notificationText'

const now = new Date(2026, 11, 8, 14, 0) // Tue 8 Dec 2026, 14:00
const ago = (ms: number) => new Date(now.getTime() - ms)
const MIN = 60_000

describe('relativeTime', () => {
  test.each([
    [ago(20_000), 'Just now'],
    [ago(5 * MIN), '5 min ago'],
    [ago(60 * MIN), '1 hour ago'],
    [ago(3 * 60 * MIN), '3 hours ago'],
    [new Date(2026, 11, 7, 18, 40), 'Yesterday, 18:40'],
    [new Date(2026, 11, 3, 9, 0), 'Thu 3 Dec'],
    [new Date(2025, 11, 30, 9, 0), 'Tue 30 Dec 2025'],
  ])('%s → %s', (at, label) => expect(relativeTime(at, now)).toBe(label))
})

test('groups: Today, Yesterday, Earlier (by calendar day)', () => {
  expect(groupOf(new Date(2026, 11, 8, 0, 5), now)).toBe('Today')
  expect(groupOf(new Date(2026, 11, 7, 23, 59), now)).toBe('Yesterday')
  expect(groupOf(new Date(2026, 11, 6, 12, 0), now)).toBe('Earlier')
})

describe('sentences (Copy sheet v1)', () => {
  const base: AppNotification = {
    id: 'n', type: 'assigned', householdId: 'h', householdName: 'Flat', choreId: 'c', choreTitle: 'Vacuuming',
    fromUid: 'a', fromName: 'Anna Kowal', fromColor: 2, read: false, createdAt: now,
  }
  const text = (n: Partial<AppNotification>) => sentenceText(sentenceOf({ ...base, ...n }, '2026-12-08'))
  test.each([
    [{ dueDate: '2026-12-10' }, 'Anna assigned you Vacuuming · Thu 10 Dec'],
    [{}, 'Anna assigned you Vacuuming'],
    [{ type: 'changed' as const, dueDate: '2026-12-12' }, 'Anna changed Vacuuming: now Sat 12 Dec'],
    [{ type: 'changed' as const }, 'Anna changed Vacuuming: now any time'],
    [{ type: 'renamed' as const, previousTitle: 'Hoovering' }, 'Anna renamed Hoovering to Vacuuming'],
    [{ type: 'removed' as const, dueDate: '2026-12-10' }, 'Anna removed Vacuuming · Thu 10 Dec'],
    [{ type: 'removed' as const }, 'Anna removed Vacuuming'],
  ])('%o', (n, expected) => expect(text(n)).toBe(expected))
})
