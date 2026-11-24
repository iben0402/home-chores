import { useEffect, useMemo, useState } from 'react'
import { Avatar } from '../../components/Avatar'
import { BottomSheet } from '../../components/BottomSheet'
import { Button } from '../../components/Button'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { cx } from '../../components/cx'
import { DueBadge } from '../../components/DueBadge'
import { EmptyState } from '../../components/EmptyState'
import { Icon, type IconName } from '../../components/Icon'
import { SheetAction } from '../../components/SheetAction'
import { Snackbar } from '../../components/Snackbar'
import { deleteEntry, undoFromHistory, undoMinutesLeft, watchHistory, UNDO_MINUTES, type HistoryEntry } from '../../data/history'
import { db } from '../../lib/firebase'
import { firstName } from '../../lib/names'
import { useAuth } from '../auth/useAuth'
import { useMembers } from '../chores/useHouseholdData'
import { useRooms } from '../rooms/useRooms'
import { useHousehold } from '../shell/useHousehold'
import { useIsAdmin } from '../shell/useIsAdmin'
import { dayLabel, dayPhrase, groupByDay, timeLabel } from './historyModel'

type Filters = { person: string; room: string }
const ALL: Filters = { person: 'all', room: 'all' }

/** History: who did what, where and when. Neutral by design: no counts per person, no rankings. */
export function HistoryPage() {
  const household = useHousehold()
  const isAdmin = useIsAdmin()
  const { user } = useAuth()
  const members = useMembers(household.id)
  const rooms = useRooms(household.id)
  const roomMap = useMemo(() => new Map((rooms ?? []).map((r) => [r.id, r])), [rooms])
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null)
  const [filters, setFilters] = useState<Filters>(ALL)
  const [filtering, setFiltering] = useState(false)
  const [open, setOpen] = useState<HistoryEntry | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<HistoryEntry | null>(null)
  const [snack, setSnack] = useState<string | null>(null)
  const [, tick] = useState(0)

  useEffect(() => watchHistory(db, household.id, setEntries, () => setEntries([])), [household.id])
  // Undo windows count down; refresh the labels every half minute.
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 30_000)
    return () => window.clearInterval(id)
  }, [])
  useEffect(() => {
    if (!snack) return
    const id = window.setTimeout(() => setSnack(null), 5000)
    return () => window.clearTimeout(id)
  }, [snack])

  if (!entries || !user) return null

  const who = (e: HistoryEntry) => (e.doneBy === user.uid ? 'You' : firstName(e.doneByName))
  const personName = filters.person === user.uid ? 'You' : firstName(members.get(filters.person)?.displayName)
  const roomName = roomMap.get(filters.room)?.name ?? ''
  const visible = entries.filter((e) => (filters.person === 'all' || e.doneBy === filters.person) && (filters.room === 'all' || e.roomId === filters.room))

  async function undo(e: HistoryEntry) {
    setOpen(null)
    try {
      await undoFromHistory(db, household.id, e)
      setSnack(`${e.choreTitle} is back on Today`)
    } catch {
      setSnack('Couldn’t undo that. It may be too late now.')
    }
  }

  async function remove(e: HistoryEntry) {
    setConfirmDelete(null)
    try {
      await deleteEntry(db, household.id, e.id)
    } catch {
      setSnack('Couldn’t delete that entry. Try again.')
    }
  }

  return (
    <div className="pb-10">
      <h1 className="m-0 px-4 pt-2 text-title">History</h1>
      {entries.length === 0 ? (
        <EmptyState icon="history" title="Nothing done yet" body="When someone ticks off or skips a chore, it’s listed here with who did it and when." />
      ) : (
        <>
          <div role="group" aria-label="Filter history" className="flex gap-2 px-4 pt-3 pb-1">
            <FilterButton icon="users-round" label={filters.person === 'all' ? 'Everyone' : personName} active={filters.person !== 'all'} onClick={() => setFiltering(true)} />
            <FilterButton icon="door-open" label={filters.room === 'all' ? 'All rooms' : roomName} active={filters.room !== 'all'} onClick={() => setFiltering(true)} />
          </div>
          {visible.length === 0 ? (
            <EmptyState
              icon="history"
              title="No matching entries"
              body={`Nothing in History matches ${
                filters.person === 'all' ? roomName : filters.room === 'all' ? personName : `${personName} in ${roomName}`
              }.`}
            >
              <Button variant="secondary" size="lg" block onClick={() => setFilters(ALL)}>
                Clear filters
              </Button>
            </EmptyState>
          ) : (
            groupByDay(visible).map((group) => (
              <section key={group.label} aria-labelledby={`day-${group.label}`}>
                <h2 id={`day-${group.label}`} className="sticky top-0 z-(--z-sticky) m-0 bg-canvas px-4 pt-5 pb-2 text-overline text-fg-muted uppercase">
                  {group.label}
                </h2>
                <div role="list" className="[&>*+*]:border-t [&>*+*]:border-border">
                  {group.entries.map((e) => {
                    const left = undoMinutesLeft(e, user.uid)
                    const member = members.get(e.doneBy)
                    const meta = [timeLabel(e.doneAt), who(e), left > 0 && `undo until ${timeLabel(new Date(e.doneAt.getTime() + UNDO_MINUTES * 60000))}`].filter(Boolean).join(' · ')
                    return (
                      <div role="listitem" key={e.id}>
                        <button type="button" onClick={() => setOpen(e)} className="flex min-h-(--size-row) w-full cursor-pointer items-start gap-3 bg-surface px-4 py-3 text-left hover:bg-surface-hover active:bg-surface-sunken">
                          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                            <span className="line-clamp-2 text-body-medium text-fg">{e.choreTitle}</span>
                            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-[18px] text-fg-muted">
                              {roomMap.get(e.roomId) && <span>{roomMap.get(e.roomId)!.name}</span>}
                              <DueBadge status="done" label="Done" />
                              <span>{meta}</span>
                            </span>
                          </div>
                          <span className="self-center">
                            <Avatar name={e.doneBy === user.uid ? `${e.doneByName} (you)` : e.doneByName} color={member?.color ?? 8} />
                          </span>
                        </button>
                      </div>
                    )
                  })}
                </div>
              </section>
            ))
          )}
        </>
      )}

      {filtering && (
        <FilterSheet
          initial={filters}
          people={[{ value: 'all', label: 'Everyone' }, ...[...members.values()].map((m) => ({ value: m.uid, label: m.uid === user.uid ? 'You' : firstName(m.displayName) }))]}
          rooms={[{ value: 'all', label: 'All rooms' }, ...(rooms ?? []).map((r) => ({ value: r.id, label: r.name }))]}
          onApply={(next) => {
            setFilters(next)
            setFiltering(false)
          }}
          onClose={() => setFiltering(false)}
        />
      )}

      {open && (
        <BottomSheet
          title={open.choreTitle}
          subtitle={`Done by ${open.doneBy === user.uid ? 'you' : firstName(open.doneByName)} · ${dayLabel(open.doneAt)}, ${timeLabel(open.doneAt)}${roomMap.get(open.roomId) ? ` · ${roomMap.get(open.roomId)!.name}` : ''}`}
          onClose={() => setOpen(null)}
        >
          {undoMinutesLeft(open, user.uid) > 0 && (
            <SheetAction icon="undo-2" label="Undo — not done yet" trail={`${undoMinutesLeft(open, user.uid)} min left`} onClick={() => void undo(open)} />
          )}
          {isAdmin && (
            <>
              <div role="separator" className="mx-5 my-1 h-px bg-border" />
              <SheetAction
                icon="trash-2"
                label="Delete entry"
                danger
                onClick={() => {
                  setConfirmDelete(open)
                  setOpen(null)
                }}
              />
            </>
          )}
          {undoMinutesLeft(open, user.uid) === 0 && !isAdmin && (
            <p className="m-0 px-5 pb-2 text-[14px] leading-5 text-fg-muted">Only the person who ticked it can undo it, for 10 minutes. Admins can delete entries made by mistake.</p>
          )}
        </BottomSheet>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete this entry?"
          body={`${confirmDelete.choreTitle}, done by ${confirmDelete.doneBy === user.uid ? 'you' : firstName(confirmDelete.doneByName)} ${dayPhrase(confirmDelete.doneAt)}, is removed from History for everyone. Use this for entries made by mistake.`}
          confirmLabel="Delete entry"
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => void remove(confirmDelete)}
        />
      )}

      {snack && <Snackbar message={snack} />}
    </div>
  )
}

function FilterButton({ icon, label, active, onClick }: { icon: IconName; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={onClick}
      className={cx(
        'relative inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border px-4 text-[14px] leading-5 font-medium after:absolute after:inset-x-0 after:-inset-y-1',
        active ? 'border-primary bg-primary-soft text-primary' : 'border-border-strong bg-surface text-fg hover:bg-surface-hover',
      )}
    >
      <Icon name={icon} size={16} />
      <span>{label}</span>
      <Icon name="chevron-down" size={16} />
    </button>
  )
}

function ChoiceChips({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (v: string) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2 px-5">
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cx(
              'relative inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border px-4 text-[14px] leading-5 font-medium after:absolute after:inset-x-0 after:-inset-y-1',
              on ? 'border-primary bg-primary text-on-primary' : 'border-border-strong bg-surface text-fg hover:bg-surface-hover',
            )}
          >
            {on && <Icon name="check" size={16} />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function FilterSheet({ initial, people, rooms, onApply, onClose }: {
  initial: Filters
  people: Array<{ value: string; label: string }>
  rooms: Array<{ value: string; label: string }>
  onApply: (f: Filters) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(initial)
  return (
    <BottomSheet title="Filter history" onClose={onClose}>
      <div className="flex flex-col gap-1">
        <span className="px-5 text-[14px] leading-5 font-semibold">Person</span>
        <ChoiceChips label="Person" value={draft.person} options={people} onChange={(person) => setDraft({ ...draft, person })} />
        <span className="px-5 pt-3 text-[14px] leading-5 font-semibold">Room</span>
        <ChoiceChips label="Room" value={draft.room} options={rooms} onChange={(room) => setDraft({ ...draft, room })} />
        <div className="flex gap-2 px-5 pt-5">
          <Button variant="secondary" size="lg" className="flex-1" onClick={() => setDraft(ALL)}>
            Clear
          </Button>
          <Button variant="primary" size="lg" className="flex-[2]" onClick={() => onApply(draft)}>
            Show entries
          </Button>
        </div>
      </div>
    </BottomSheet>
  )
}
