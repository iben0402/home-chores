import type { Occurrence } from '../../data/chores'
import { buildChoreList, roomCounts } from './choreList'

const occ = (o: Partial<Occurrence> & { id: string; choreId: string; dueDate: string }): Occurrence => ({
  choreTitle: o.choreId,
  roomId: 'kitchen',
  kind: 'interval',
  seq: 0,
  status: 'open',
  assigneeUid: null,
  createdBy: 'u1',
  createdByName: 'Anna',
  ...o,
})

const today = '2026-11-24' // Tuesday
const list: Occurrence[] = [
  occ({ id: 'bins1', choreId: 'bins', dueDate: '2026-11-23', seq: 0, assigneeUid: 'tom' }),
  occ({ id: 'bins2', choreId: 'bins', dueDate: '2026-11-30', seq: 1 }),
  occ({ id: 'vac1', choreId: 'vac', dueDate: '2026-11-26', seq: 0 }),
  occ({ id: 'vac2', choreId: 'vac', dueDate: '2026-12-03', seq: 1, assigneeUid: 'me' }),
  occ({ id: 'dish', choreId: 'dish', dueDate: today, kind: 'oneoff', assigneeUid: 'me', roomId: 'bath' }),
]

test('Everyone: the earliest open occurrence of each chore, in sections', () => {
  const view = buildChoreList(list, { uid: 'me', filter: 'everyone', today })
  expect(view.sections.map((s) => [s.status, s.rows.map((r) => r.id)])).toEqual([
    ['overdue', ['bins1']],
    ['today', ['dish']],
    ['week', ['vac1']],
  ])
})

test('Mine: everything assigned to me, including later occurrences', () => {
  const view = buildChoreList(list, { uid: 'me', filter: 'mine', today })
  expect(view.sections.flatMap((s) => s.rows.map((r) => r.id))).toEqual(['dish', 'vac2'])
  expect(view.sections.map((s) => s.status)).toEqual(['today', 'later'])
})

test('Unassigned: earliest per chore with nobody on it', () => {
  const view = buildChoreList(list, { uid: 'me', filter: 'unassigned', today })
  expect(view.sections.flatMap((s) => s.rows.map((r) => r.id))).toEqual(['vac1'])
})

test('counts for the chips', () => {
  expect(buildChoreList(list, { uid: 'me', filter: 'everyone', today }).counts).toEqual({ mine: 2, everyone: 3, unassigned: 1 })
})

test('room filter and room counts (open chores, overdue)', () => {
  const view = buildChoreList(list, { uid: 'me', filter: 'everyone', today, roomId: 'bath' })
  expect(view.sections.flatMap((s) => s.rows.map((r) => r.id))).toEqual(['dish'])
  expect(roomCounts(list, today)).toEqual({ kitchen: { open: 2, overdue: 1 }, bath: { open: 1, overdue: 0 } })
})
