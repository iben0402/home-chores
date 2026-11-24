import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Avatar } from '../../components/Avatar'
import { Button } from '../../components/Button'
import { DueBadge } from '../../components/DueBadge'
import { EmptyState } from '../../components/EmptyState'
import { Icon } from '../../components/Icon'
import { SectionHeader } from '../../components/SectionHeader'
import { Snackbar } from '../../components/Snackbar'
import { TopBar } from '../../components/TopBar'
import { assignOccurrence, completeOccurrence, undoCompletion, type Occurrence, type UndoToken } from '../../data/chores'
import { watchHistory, type HistoryEntry } from '../../data/history'
import { describeSchedule, dueLabel, dueStatus, formFromRule, todayISO } from '../../lib/schedule'
import { db } from '../../lib/firebase'
import { firstName } from '../../lib/names'
import { useAuth } from '../auth/useAuth'
import { dayLabel, timeLabel } from '../history/historyModel'
import { useRooms } from '../rooms/useRooms'
import { useHousehold } from '../shell/useHousehold'
import { useIsAdmin } from '../shell/useIsAdmin'
import { AssignSheet } from './AssignSheet'
import { useChore } from './useChore'
import { useMembers, useOpenOccurrences } from './useHouseholdData'

/** One chore: when it comes round, the next times (each with its own person), recent history. */
export function ChorePage() {
  const { choreId = '' } = useParams()
  const household = useHousehold()
  const isAdmin = useIsAdmin()
  const { user } = useAuth()
  const chore = useChore(household.id, choreId)
  const occurrences = useOpenOccurrences(household.id)
  const members = useMembers(household.id)
  const rooms = useRooms(household.id)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [assigning, setAssigning] = useState<Occurrence | null>(null)
  const [snack, setSnack] = useState<{ message: string; undo?: UndoToken } | null>(null)
  const [busy, setBusy] = useState(false)
  const today = todayISO()

  useEffect(() => watchHistory(db, household.id, (all) => setHistory(all.filter((e) => e.choreId === choreId))), [household.id, choreId])
  useEffect(() => {
    if (!snack) return
    const id = window.setTimeout(() => setSnack(null), 5000)
    return () => window.clearTimeout(id)
  }, [snack])

  if (chore === undefined || !occurrences || !user) return null
  const back = `/h/${household.id}`
  if (chore === null) {
    return (
      <>
        <TopBar title="Chore" back={back} />
        <EmptyState icon="circle-alert" title="We couldn’t find that" body="It may have been deleted, or the link is out of date.">
          <Link to={back} className="inline-flex min-h-[52px] w-full items-center justify-center rounded-md border border-border-strong bg-surface px-5 text-[17px] font-semibold text-fg no-underline">
            Go to Today
          </Link>
        </EmptyState>
      </>
    )
  }

  const me = { uid: user.uid, displayName: user.displayName ?? '' }
  const upcoming = occurrences.filter((o) => o.choreId === chore.id).sort((a, b) => a.seq - b.seq)
  const room = rooms?.find((r) => r.id === chore.roomId)
  const canEdit = isAdmin || (chore.kind === 'oneoff' && chore.createdBy === user.uid)
  const last = history[0]
  const nameOf = (uid: string | null) => (uid === user.uid ? 'You' : uid ? firstName(members.get(uid)?.displayName) : 'Nobody yet')

  async function assign(o: Occurrence, uid: string | null) {
    setAssigning(null)
    try {
      await assignOccurrence(db, household.id, o.id, uid, user!.uid)
    } catch {
      setSnack({ message: 'Couldn’t change who it’s for. Try again.' })
    }
  }

  async function markDone() {
    const next = upcoming[0]
    if (!next || busy) return
    setBusy(true)
    try {
      const token = await completeOccurrence(db, household.id, next.id, me, today)
      setSnack({ message: `${chore!.title} — done`, undo: token })
    } catch {
      setSnack({ message: 'Couldn’t mark it done. Try again.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pb-28">
      <TopBar title={chore.title} back={back}>
        {canEdit && (
          <Link to={`/h/${household.id}/chores/${chore.id}/edit`} aria-label="Edit chore" className="inline-flex size-(--size-touch) items-center justify-center rounded-full text-fg hover:bg-surface-hover">
            <Icon name="pencil" />
          </Link>
        )}
      </TopBar>
      <div className="flex flex-col gap-4 px-4 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          {room && (
            <span className="inline-flex h-6 items-center gap-1 rounded-sm bg-status-upcoming-bg px-2 text-[13px] text-status-upcoming-fg">
              <Icon name={room.icon} size={14} />
              {room.name}
            </span>
          )}
          {upcoming[0] && <DueBadge status={dueStatus(upcoming[0].dueDate, today)} label={`Due ${dueLabel(upcoming[0].dueDate, today)}`} />}
        </div>
        <div className="flex items-start gap-3 rounded-md bg-surface-sunken px-4 py-3 text-[15px] leading-[22px]">
          <Icon name={chore.kind === 'oneoff' ? 'circle-dot' : 'repeat-2'} className="mt-px shrink-0 text-primary" />
          <span>
            <strong className="font-semibold">{chore.kind === 'oneoff' ? `One-off chore, added by ${chore.createdBy === user.uid ? 'you' : firstName(chore.createdByName)}.` : describeSchedule(formFromRule(chore.rule))}</strong>
            {last && (
              <span className="mt-0.5 block text-[13px] leading-[18px] text-fg-muted">
                Last done {dayLabel(last.doneAt)} by {last.doneBy === user.uid ? 'you' : firstName(last.doneByName)}
              </span>
            )}
          </span>
        </div>
        {chore.description && <p className="m-0 text-[15px] leading-[22px] whitespace-pre-line">{chore.description}</p>}
      </div>

      {upcoming.length > 0 && (
        <section aria-labelledby="next-times">
          <SectionHeader id="next-times" tone="week" label={upcoming.length === 1 ? 'Next time' : `Next ${upcoming.length} times`} />
          <div role="list" className="[&>*+*]:border-t [&>*+*]:border-border">
            {upcoming.map((o) => {
              const date = dueLabel(o.dueDate, today)
              const member = o.assigneeUid ? members.get(o.assigneeUid) : undefined
              return (
                <div role="listitem" key={o.id} className="flex min-h-[60px] items-center gap-3 bg-surface py-2 pr-2 pl-4">
                  <span className="flex-1 text-[16px] leading-[22px] font-medium">{date}</span>
                  <button
                    type="button"
                    aria-label={`${date}: ${o.assigneeUid ? `assigned to ${o.assigneeUid === user.uid ? 'you' : firstName(member?.displayName) || 'someone'}` : 'nobody yet'}. Change`}
                    onClick={() => setAssigning(o)}
                    className="inline-flex min-h-(--size-touch) cursor-pointer items-center gap-2 rounded-full px-3 text-[15px] hover:bg-surface-hover"
                  >
                    {o.assigneeUid ? (
                      <Avatar name={member?.displayName ?? 'Someone'} color={member?.color ?? 8} size="sm" />
                    ) : (
                      <span aria-hidden="true" className="grid size-(--size-avatar-sm) place-items-center rounded-full border-2 border-dashed border-status-unassigned-fg bg-status-unassigned-bg text-status-unassigned-fg">
                        <Icon name="user-round" size={14} />
                      </span>
                    )}
                    <span>{nameOf(o.assigneeUid)}</span>
                    <Icon name="chevron-down" size={18} className="text-fg-muted" />
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {history.length > 0 && (
        <section aria-labelledby="recently">
          <h2 id="recently" className="m-0 px-4 pt-5 pb-2 text-overline text-fg-muted uppercase">
            Recently
          </h2>
          <div role="list" className="[&>*+*]:border-t [&>*+*]:border-border">
            {history.slice(0, 3).map((e) => (
              <div role="listitem" key={e.id} className="flex min-h-14 items-center gap-3 bg-surface px-4 py-2">
                <span className="flex flex-1 flex-col">
                  <span className="text-body-medium">Done by {e.doneBy === user.uid ? 'you' : firstName(e.doneByName)}</span>
                  <span className="text-[13px] leading-[18px] text-fg-muted">
                    {dayLabel(e.doneAt)}, {timeLabel(e.doneAt)}
                  </span>
                </span>
                <Avatar name={e.doneByName} color={members.get(e.doneBy)?.color ?? 8} size="sm" />
              </div>
            ))}
          </div>
        </section>
      )}

      {upcoming.length > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(var(--size-tabbar)+env(safe-area-inset-bottom))] z-(--z-fab) flex justify-center border-t border-border bg-surface">
          <div className="w-full max-w-(--size-content) px-4 pt-3 pb-4">
            <Button variant="primary" size="lg" block icon="check" loading={busy} onClick={() => void markDone()}>
              Mark done
            </Button>
          </div>
        </div>
      )}

      {assigning && (
        <AssignSheet occurrence={assigning} members={members} me={user.uid} isAdmin={isAdmin} onAssign={(uid) => void assign(assigning, uid)} onClose={() => setAssigning(null)} />
      )}
      {snack && (
        <Snackbar
          message={snack.message}
          onAction={
            snack.undo
              ? () => {
                  const token = snack.undo!
                  setSnack(null)
                  void undoCompletion(db, household.id, token).catch(() => setSnack({ message: 'Couldn’t undo that. Try again from History.' }))
                }
              : undefined
          }
        />
      )}
    </div>
  )
}
