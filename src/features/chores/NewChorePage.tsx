import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Button } from '../../components/Button'
import { FieldLabel, FieldMessage } from '../../components/Field'
import { inputClass } from '../../components/fieldStyles'
import { InfoNote } from '../../components/InfoNote'
import { ScheduleEditor } from '../../components/ScheduleEditor'
import { SelectField } from '../../components/SelectField'
import { TextField } from '../../components/TextField'
import { TopBar } from '../../components/TopBar'
import { createChore } from '../../data/chores'
import { ruleFromForm, todayISO, type ScheduleForm } from '../../lib/schedule'
import { db } from '../../lib/firebase'
import { FormError } from '../auth/parts'
import { useAuth } from '../auth/useAuth'
import { useRooms } from '../rooms/useRooms'
import { useMembers } from './useHouseholdData'
import { useHousehold } from '../shell/useHousehold'
import { useIsAdmin } from '../shell/useIsAdmin'

/**
 * New chore. Members add one-offs (title, room, due date, note); admins also get the schedule
 * editor for repeating chores. Assigning someone comes with assignments (part 2).
 */
export function NewChorePage() {
  const household = useHousehold()
  const isAdmin = useIsAdmin()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const rooms = useRooms(household.id)
  const members = useMembers(household.id)
  const [assignee, setAssignee] = useState('')
  const today = todayISO()

  const [title, setTitle] = useState('')
  const [roomId, setRoomId] = useState(params.get('room') ?? '')
  const [due, setDue] = useState(today)
  const [note, setNote] = useState('')
  const [schedule, setSchedule] = useState<ScheduleForm>({ mode: 'once', every: 1, unit: 'weeks', calMode: 'week', days: ['mon'], dom: 1 })
  const [errors, setErrors] = useState<{ title?: string; due?: string; schedule?: string; form?: string }>({})
  const [busy, setBusy] = useState(false)

  if (!rooms || !user) return null
  const room = rooms.some((r) => r.id === roomId) ? roomId : (rooms.find((r) => r.isDefault) ?? rooms[0])?.id ?? ''
  const once = !isAdmin || schedule.mode === 'once'
  // A date is asked for one-offs (Due) and for "after it's done" chores (First due).
  const afterDone = !once && schedule.mode === 'after'

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (busy || !user) return
    const next = {
      title: title.trim() ? undefined : 'Say what needs doing.',
      due: (once || afterDone) && !/^\d{4}-\d{2}-\d{2}$/.test(due) ? 'Pick a date.' : undefined,
      schedule: !once && schedule.mode === 'calendar' && schedule.calMode === 'week' && schedule.days.length === 0 ? 'Pick at least one day.' : undefined,
    }
    setErrors(next)
    if (next.title || next.due || next.schedule) {
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      return
    }
    setBusy(true)
    try {
      await createChore(db, household.id, { uid: user.uid, displayName: user.displayName ?? '' }, {
        title: title.trim(),
        description: note.trim(),
        roomId: room,
        rule: once ? { kind: 'oneoff' } : ruleFromForm(schedule),
        startISO: once || afterDone ? due : today,
        assigneeUid: assignee || null,
      })
      navigate(`/h/${household.id}`, { replace: true })
    } catch {
      setErrors({ form: 'Something went wrong. Try again.' })
      setBusy(false)
    }
  }

  return (
    <form noValidate onSubmit={onSubmit} aria-label="New chore" className="flex min-h-[calc(100dvh-var(--size-tabbar))] flex-col">
      <TopBar title="New chore" back={`/h/${household.id}`} close />
      <div className="flex flex-1 flex-col gap-4 px-4 pt-2 pb-6">
        <TextField
          label="What needs doing?"
          placeholder="e.g. Wipe the hob"
          maxLength={80}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={errors.title}
        />
        <SelectField label="Room" value={room} onChange={setRoomId} options={rooms.map((r) => ({ value: r.id, label: r.name }))} />
        {isAdmin && (
          <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
            <ScheduleEditor value={schedule} onChange={setSchedule} today={today} />
            <FieldMessage id="schedule-msg" error={errors.schedule} />
          </div>
        )}
        {(once || afterDone) && (
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="due">{once ? 'Due' : 'First due'}</FieldLabel>
            <input
              id="due"
              type="date"
              className={inputClass}
              value={due}
              min={today}
              onChange={(e) => setDue(e.target.value)}
              aria-invalid={errors.due ? true : undefined}
              aria-describedby="due-msg"
            />
            <FieldMessage
              id="due-msg"
              error={errors.due}
              hint={once ? undefined : 'The next ones follow from this date, and move when it’s done late or early.'}
            />
          </div>
        )}
        <SelectField
          label={isAdmin && !once ? 'Who does the first one?' : 'For'}
          hint={isAdmin && !once ? 'You can assign each time separately on the chore’s page.' : undefined}
          value={assignee}
          onChange={setAssignee}
          options={[
            { value: '', label: 'Nobody yet — anyone can take it' },
            ...[...members.values()].map((m) => ({ value: m.uid, label: m.uid === user.uid ? 'Me' : m.displayName })),
          ]}
        />
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="note">
            Note <span className="font-normal text-fg-muted">(optional)</span>
          </FieldLabel>
          <textarea id="note" rows={3} maxLength={1000} placeholder="Anything that helps" value={note} onChange={(e) => setNote(e.target.value)} className={`${inputClass} py-3`} />
        </div>
        {!isAdmin && (
          <InfoNote>
            <strong>One-off chore.</strong> It disappears once it’s done. Repeating chores are set up by an admin.
          </InfoNote>
        )}
        <FormError message={errors.form} />
      </div>
      <div className="sticky bottom-(--size-tabbar) border-t border-border bg-surface px-4 pt-3 pb-5">
        <Button type="submit" variant="primary" size="lg" block icon="plus" loading={busy}>
          {once ? 'Add chore' : 'Add repeating chore'}
        </Button>
      </div>
    </form>
  )
}
