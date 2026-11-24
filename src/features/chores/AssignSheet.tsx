import { AssigneePicker } from '../../components/AssigneePicker'
import { BottomSheet } from '../../components/BottomSheet'
import type { Occurrence } from '../../data/chores'
import type { Member } from '../../data/households'
import { dueLabel, todayISO } from '../../lib/schedule'

/** "Assign to…" for one occurrence. Members may only clear their own assignment (admins any). */
export function AssignSheet({ occurrence, members, me, isAdmin, onAssign, onClose }: {
  occurrence: Occurrence
  members: Map<string, Member>
  me: string
  isAdmin: boolean
  onAssign: (uid: string | null) => void
  onClose: () => void
}) {
  const list = [...members.values()].sort((a, b) => Number(b.uid === me) - Number(a.uid === me))
  const allowNobody = isAdmin || occurrence.assigneeUid === null || occurrence.assigneeUid === me
  return (
    <BottomSheet title="Assign to…" subtitle={`${occurrence.choreTitle} · ${dueLabel(occurrence.dueDate, todayISO())}`} onClose={onClose}>
      <AssigneePicker
        members={list.map((m) => ({ uid: m.uid, name: m.displayName, color: m.color, you: m.uid === me }))}
        value={occurrence.assigneeUid}
        allowNobody={allowNobody}
        onChange={onAssign}
      />
    </BottomSheet>
  )
}
