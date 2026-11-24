import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { Button } from '../../components/Button'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { FieldLabel, FieldMessage } from '../../components/Field'
import { inputClass } from '../../components/fieldStyles'
import { Icon } from '../../components/Icon'
import { InfoNote } from '../../components/InfoNote'
import { NumberStepper } from '../../components/NumberStepper'
import { ScheduleEditor } from '../../components/ScheduleEditor'
import { SelectField } from '../../components/SelectField'
import { TextField } from '../../components/TextField'
import { TopBar } from '../../components/TopBar'
import { archiveChore, assignOccurrence, deleteChore, updateChore, type Chore } from '../../data/chores'
import { formFromRule, ruleFromForm, todayISO, type ScheduleForm } from '../../lib/schedule'
import { db } from '../../lib/firebase'
import { FormError } from '../auth/parts'
import { useAuth } from '../auth/useAuth'
import { useRooms } from '../rooms/useRooms'
import { useHousehold } from '../shell/useHousehold'
import { useIsAdmin } from '../shell/useIsAdmin'
import { useChore } from './useChore'
import { useMembers, useOpenOccurrences } from './useHouseholdData'

/** Edit a chore: admins any; a one-off's creator their own. Repeating chores archive; one-offs delete. */
export function EditChorePage() {
  const { choreId = '' } = useParams()
  const household = useHousehold()
  const isAdmin = useIsAdmin()
  const { user } = useAuth()
  const chore = useChore(household.id, choreId)
  if (chore === undefined || !user) return null
  const back = `/h/${household.id}/chores/${choreId}`
  if (!chore || !(isAdmin || (chore.kind === 'oneoff' && chore.createdBy === user.uid))) return <Navigate to={back} replace />
  return <EditForm key={chore.id} chore={chore} isAdmin={isAdmin} back={back} />
}

function EditForm({ chore, isAdmin, back }: { chore: Chore; isAdmin: boolean; back: string }) {
  const household = useHousehold()
  const { user } = useAuth()
  const navigate = useNavigate()
  const rooms = useRooms(household.id)
  const members = useMembers(household.id)
  const occurrences = useOpenOccurrences(household.id)
  const today = todayISO()
  const oneoff = chore.kind === 'oneoff'
  const upcoming = (occurrences ?? []).filter((o) => o.choreId === chore.id).sort((a, b) => a.seq - b.seq)
  const next = upcoming[0]

  const [title, setTitle] = useState(chore.title)
  const [roomId, setRoomId] = useState(chore.roomId)
  const [note, setNote] = useState(chore.description)
  const [schedule, setSchedule] = useState<ScheduleForm>(formFromRule(chore.rule))
  const [lookahead, setLookahead] = useState(chore.lookahead)
  const [due, setDue] = useState<string | null>(null)
  const [who, setWho] = useState<string | null | undefined>(undefined)
  const [errors, setErrors] = useState<{ title?: string; schedule?: string; form?: string }>({})
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)

  if (!rooms || !occurrences || !user) return null
  const dueValue = due ?? next?.dueDate ?? today
  const whoValue = who === undefined ? (next?.assigneeUid ?? null) : who
  const canClearWho = isAdmin || next?.assigneeUid == null || next?.assigneeUid === user.uid

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    const next_ = {
      title: title.trim() ? undefined : 'Say what needs doing.',
      schedule: !oneoff && schedule.mode === 'calendar' && schedule.calMode === 'week' && schedule.days.length === 0 ? 'Pick at least one day.' : undefined,
    }
    setErrors(next_)
    if (next_.title || next_.schedule) return
    setBusy(true)
    try {
      await updateChore(
        db,
        household.id,
        chore.id,
        oneoff
          ? { title: title.trim(), description: note.trim(), roomId, dueDate: dueValue }
          : { title: title.trim(), description: note.trim(), roomId, rule: ruleFromForm(schedule), lookahead },
        today,
      )
      if (oneoff && next && whoValue !== next.assigneeUid) await assignOccurrence(db, household.id, next.id, whoValue, user!.uid)
      navigate(back, { replace: true })
    } catch {
      setErrors({ form: 'Something went wrong. Try again.' })
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    try {
      if (oneoff) await deleteChore(db, household.id, chore.id)
      else await archiveChore(db, household.id, chore.id)
      navigate(`/h/${household.id}`, { replace: true })
    } catch {
      setConfirming(false)
      setErrors({ form: 'Something went wrong. Try again.' })
      setBusy(false)
    }
  }

  const memberOptions = [...members.values()].map((m) => ({ value: m.uid, label: m.uid === user.uid ? 'Me' : m.displayName }))

  return (
    <form noValidate onSubmit={onSubmit} aria-label="Edit chore" className="flex min-h-[calc(100dvh-var(--size-tabbar))] flex-col">
      <TopBar title="Edit chore" back={back} close />
      <div className="flex flex-1 flex-col gap-4 px-4 pt-2 pb-6">
        {oneoff && (
          <InfoNote>{chore.createdBy === user.uid ? 'You added this one-off chore, so you can change or delete it.' : 'As an admin you can change or delete this one-off chore.'}</InfoNote>
        )}
        <TextField label="What needs doing?" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} error={errors.title} />
        <SelectField label="Room" value={roomId} onChange={setRoomId} options={rooms.map((r) => ({ value: r.id, label: r.name }))} />
        {!oneoff && (
          <>
            <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
              <ScheduleEditor value={schedule} onChange={setSchedule} today={today} allowOnce={false} />
              <FieldMessage id="schedule-msg" error={errors.schedule} />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[14px] leading-5 font-semibold">Show next</span>
              <div className="flex items-center gap-3">
                <NumberStepper value={lookahead} min={1} max={8} label="Number of upcoming times" onChange={setLookahead} />
                <span>times</span>
              </div>
              <p className="m-0 text-[13px] leading-[18px] text-fg-muted">Each one can have its own person. Between 1 and 8.</p>
            </div>
          </>
        )}
        {oneoff && next && (
          <>
            <div className="flex flex-col gap-1.5">
              <FieldLabel htmlFor="due">Due</FieldLabel>
              <input id="due" type="date" className={inputClass} value={dueValue} onChange={(e) => setDue(e.target.value)} />
            </div>
            <SelectField
              label="Who does it?"
              value={whoValue ?? ''}
              onChange={(v) => setWho(v || null)}
              options={[...(canClearWho ? [{ value: '', label: 'Nobody yet — anyone can take it' }] : []), ...memberOptions]}
            />
          </>
        )}
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="note">
            Note <span className="font-normal text-fg-muted">(optional)</span>
          </FieldLabel>
          <textarea id="note" rows={3} maxLength={1000} placeholder="Anything that helps" value={note} onChange={(e) => setNote(e.target.value)} className={`${inputClass} py-3`} />
        </div>
        <FormError message={errors.form} />
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="inline-flex min-h-(--size-touch) cursor-pointer items-center gap-2 self-start rounded-md px-3 font-semibold text-danger hover:bg-surface-hover"
        >
          <Icon name="trash-2" />
          {oneoff ? 'Delete chore' : 'Archive chore'}
        </button>
      </div>
      <div className="sticky bottom-(--size-tabbar) border-t border-border bg-surface px-4 pt-3 pb-5">
        <Button type="submit" variant="primary" size="lg" block loading={busy && !confirming}>
          Save changes
        </Button>
      </div>
      {confirming && (
        <ConfirmDialog
          title={oneoff ? `Delete ${chore.title}?` : `Archive ${chore.title}?`}
          body={
            oneoff
              ? 'It’s removed from everyone’s list. Nothing is added to History.'
              : `Its ${upcoming.length} upcoming ${upcoming.length === 1 ? 'time is' : 'times are'} removed. History stays.`
          }
          confirmLabel={oneoff ? 'Delete chore' : 'Archive'}
          confirmIcon={oneoff ? 'trash-2' : 'inbox'}
          loading={busy}
          onCancel={() => setConfirming(false)}
          onConfirm={() => void remove()}
        />
      )}
    </form>
  )
}
