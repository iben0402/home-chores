import type { Occurrence } from '../../data/chores'
import type { ChoreFilter } from '../../components/FilterChips'
import { dueStatus, type DueStatus } from '../../lib/schedule'

export type ListSection = { status: DueStatus; label: string; rows: Occurrence[] }
const SECTIONS: Array<[DueStatus, string]> = [
  ['overdue', 'Overdue'],
  ['today', 'Today'],
  ['week', 'This week'],
  ['later', 'Later'],
]

/** The earliest open occurrence of each chore (occurrences come sorted by due date). */
function earliestPerChore(occurrences: Occurrence[]): Occurrence[] {
  const seen = new Set<string>()
  return [...occurrences]
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.seq - b.seq)
    .filter((o) => (seen.has(o.choreId) ? false : (seen.add(o.choreId), true)))
}

/**
 * What Today (or a room) shows (spec §8.9): Everyone / Unassigned = the earliest open occurrence
 * per chore; Mine = everything assigned to me, later occurrences included. Grouped into sections.
 */
export function buildChoreList(
  occurrences: Occurrence[],
  opts: { uid: string; filter: ChoreFilter; today: string; roomId?: string },
): { sections: ListSection[]; counts: Record<ChoreFilter, number> } {
  const inScope = opts.roomId ? occurrences.filter((o) => o.roomId === opts.roomId) : occurrences
  const earliest = earliestPerChore(inScope)
  const lists: Record<ChoreFilter, Occurrence[]> = {
    everyone: earliest,
    unassigned: earliest.filter((o) => o.assigneeUid === null),
    mine: [...inScope].filter((o) => o.assigneeUid === opts.uid).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.seq - b.seq),
  }
  const rows = lists[opts.filter]
  return {
    sections: SECTIONS.map(([status, label]) => ({ status, label, rows: rows.filter((o) => dueStatus(o.dueDate, opts.today) === status) })).filter((s) => s.rows.length > 0),
    counts: { mine: lists.mine.length, everyone: lists.everyone.length, unassigned: lists.unassigned.length },
  }
}

/** Per room: open chores (earliest occurrence each) and how many of those are overdue. */
export function roomCounts(occurrences: Occurrence[], today: string): Record<string, { open: number; overdue: number }> {
  const out: Record<string, { open: number; overdue: number }> = {}
  for (const o of earliestPerChore(occurrences)) {
    const room = (out[o.roomId] ??= { open: 0, overdue: 0 })
    room.open += 1
    if (o.dueDate < today) room.overdue += 1
  }
  return out
}
