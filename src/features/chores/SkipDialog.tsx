import { useState } from 'react'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { TextField } from '../../components/TextField'
import { skipOccurrence, type Occurrence, type UndoToken } from '../../data/chores'
import type { Member } from '../../data/households'
import { db } from '../../lib/firebase'
import { dueLabel, nextDueAfter, todayISO } from '../../lib/schedule'
import { firstName } from '../../lib/names'
import { useChore } from './useChore'

/**
 * Admin: "Skip {chore} on {date}?" with an optional reason (Copy sheet v1 › Skip confirm).
 * `laterOpen` are the chore's other open occurrences, in order, for "The next one is due …".
 */
export function SkipDialog({ hid, occurrence, laterOpen, members, me, onSkipped, onFailed, onCancel }: {
  hid: string
  occurrence: Occurrence
  laterOpen: Occurrence[]
  members: Map<string, Member>
  me: { uid: string; displayName: string }
  onSkipped: (token: UndoToken) => void
  onFailed: () => void
  onCancel: () => void
}) {
  const chore = useChore(hid, occurrence.choreId)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const today = todayISO()
  const date = dueLabel(occurrence.dueDate, today)
  const next = chore ? nextDueAfter(chore.rule, today, occurrence.dueDate, laterOpen.map((o) => o.dueDate)) : null
  const who = occurrence.assigneeUid
    ? occurrence.assigneeUid === me.uid
      ? 'you’re no longer assigned'
      : `${firstName(members.get(occurrence.assigneeUid)?.displayName) || 'the assignee'} is no longer assigned`
    : null
  const body = [
    `It’s logged as skipped in History${who ? `, and ${who}` : ''}.`,
    next ? `The next one is due ${dueLabel(next, today)}.` : '',
  ].filter(Boolean).join(' ')

  async function skip() {
    setBusy(true)
    try {
      onSkipped(await skipOccurrence(db, hid, occurrence.id, me, today, reason))
    } catch {
      onFailed()
    }
  }

  return (
    <ConfirmDialog
      title={`Skip ${occurrence.choreTitle} ${occurrence.dueDate === today ? 'today' : `on ${date}`}?`}
      body={body}
      confirmLabel="Skip"
      confirmIcon="skip-forward"
      confirmVariant="primary"
      loading={busy}
      onConfirm={() => void skip()}
      onCancel={onCancel}
    >
      <TextField
        className="mt-4"
        label="Reason"
        labelAction={<span className="text-[14px] text-fg-muted">Optional</span>}
        placeholder="e.g. away that weekend"
        maxLength={200}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
    </ConfirmDialog>
  )
}
