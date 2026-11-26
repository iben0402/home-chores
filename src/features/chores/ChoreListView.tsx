import { useEffect, useRef, useState } from 'react'
import { ChoreRow } from '../../components/ChoreRow'
import { Fab } from '../../components/Fab'
import type { ChoreFilter } from '../../components/FilterChips'
import { SectionHeader } from '../../components/SectionHeader'
import { Snackbar } from '../../components/Snackbar'
import { assignOccurrence, completeOccurrence, takeOccurrence, undoCompletion, type Occurrence, type UndoToken } from '../../data/chores'
import type { Member } from '../../data/households'
import type { Room } from '../../data/rooms'
import { dueLabel, todayISO } from '../../lib/schedule'
import { db } from '../../lib/firebase'
import { firstName } from '../../lib/names'
import { useAuth } from '../auth/useAuth'
import { buildChoreList } from './choreList'
import { AssignSheet } from './AssignSheet'
import { BottomSheet } from '../../components/BottomSheet'
import { SheetAction } from '../../components/SheetAction'
import type { IconName } from '../../components/Icon'
import { Icon } from '../../components/Icon'
import { Link } from 'react-router'
import { useIsAdmin } from '../shell/useIsAdmin'
import { SkipDialog } from './SkipDialog'

type Snack = { message: string; undo?: UndoToken; icon?: IconName } | null

/**
 * The sectioned chore list for Today and a room: tick off (row holds, then fades; snackbar with Undo),
 * and Take it. A ticked row stays as a "ghost" for its leaving animation after Firestore drops it.
 */
export function ChoreListView({ hid, occurrences, filter, roomId, rooms, members, showRoom = true, fab }: {
  hid: string
  occurrences: Occurrence[]
  filter: ChoreFilter
  roomId?: string
  rooms: Map<string, Room>
  members: Map<string, Member>
  showRoom?: boolean
  /** The floating add button; the list owns it so it can lift above the snackbar. */
  fab?: { to: string; label?: string }
}) {
  const { user } = useAuth()
  const isAdmin = useIsAdmin()
  const today = todayISO()
  const [sheet, setSheet] = useState<{ kind: 'actions' | 'assign' | 'skip'; occurrence: Occurrence } | null>(null)
  const [ghosts, setGhosts] = useState<Map<string, Occurrence>>(new Map())
  const [snack, setSnack] = useState<Snack>(null)
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  if (!user) return null
  const me = { uid: user.uid, displayName: user.displayName ?? '' }
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms))

  function showSnack(next: Snack) {
    setSnack(next)
    const shown = next
    later(() => setSnack((current) => (current === shown ? null : current)), 5000)
  }

  async function tick(o: Occurrence) {
    setGhosts((g) => new Map(g).set(o.id, o))
    later(() => setGhosts((g) => ((g = new Map(g)), g.delete(o.id), g)), 1000)
    try {
      const token = await completeOccurrence(db, hid, o.id, me, today)
      showSnack({ message: `${o.choreTitle} — done`, undo: token })
    } catch (error) {
      setGhosts((g) => ((g = new Map(g)), g.delete(o.id), g))
      showSnack({ message: /already/.test(String(error)) ? 'Someone already ticked that off.' : 'Couldn’t mark it done. Try again.' })
    }
  }

  async function undo(token: UndoToken) {
    setSnack(null)
    setGhosts((g) => ((g = new Map(g)), g.delete(token.occurrenceId), g))
    try {
      await undoCompletion(db, hid, token)
    } catch {
      showSnack({ message: 'Couldn’t undo that. Try again from History.' })
    }
  }

  async function take(o: Occurrence) {
    try {
      await takeOccurrence(db, hid, o.id, me.uid)
      showSnack({ message: `You took ${o.choreTitle}` })
    } catch {
      showSnack({ message: 'Couldn’t take it. Someone may have just taken it.' })
    }
  }

  async function assign(o: Occurrence, uid: string | null) {
    setSheet(null)
    if (uid === o.assigneeUid) return
    try {
      await assignOccurrence(db, hid, o.id, uid, me.uid)
      const name = uid === me.uid ? 'you' : uid ? firstName(members.get(uid)?.displayName) : null
      showSnack({ message: name ? `Assigned to ${name}` : 'Unassigned' })
    } catch {
      showSnack({ message: 'Couldn’t change who it’s for. Try again.' })
    }
  }

  // Ghosts keep a just-ticked row on screen while it animates out.
  const merged = [...occurrences.filter((o) => !ghosts.has(o.id)), ...ghosts.values()]
  const { sections } = buildChoreList(merged, { uid: me.uid, filter, today, roomId })

  return (
    <>
      {sections.map((section) => (
        <section key={section.status} aria-labelledby={`sec-${section.status}`}>
          <SectionHeader id={`sec-${section.status}`} tone={section.status} label={section.label} count={section.rows.length} />
          <div role="list" className="[&>*+*]:border-t [&>*+*]:border-border">
            {section.rows.map((o) => {
              const assignee = o.assigneeUid ? members.get(o.assigneeUid) : undefined
              const done = ghosts.has(o.id)
              return (
                <ChoreRow
                  key={o.id}
                  leaving={done}
                  chore={{
                    title: o.choreTitle,
                    room: showRoom ? rooms.get(o.roomId)?.name : undefined,
                    due: { status: section.status, label: dueLabel(o.dueDate, today) },
                    kind: o.kind,
                    from: o.kind === 'oneoff' && o.createdBy !== me.uid ? firstName(o.createdByName) : undefined,
                    assignee: o.assigneeUid
                      ? { name: assignee?.displayName ?? 'Someone', color: assignee?.color ?? 8, you: o.assigneeUid === me.uid }
                      : null,
                    done,
                  }}
                  onToggle={(checked) => checked && !done && void tick(o)}
                  onTake={() => void take(o)}
                  onOpen={done ? undefined : () => setSheet({ kind: 'actions', occurrence: o })}
                  onAssignee={done ? undefined : () => setSheet({ kind: 'assign', occurrence: o })}
                />
              )
            })}
          </div>
        </section>
      ))}
      {sheet?.kind === 'actions' && (
        <RowSheet
          occurrence={sheet.occurrence}
          subtitle={[
            rooms.get(sheet.occurrence.roomId)?.name,
            dueLabel(sheet.occurrence.dueDate, today),
            sheet.occurrence.assigneeUid === me.uid ? 'you' : sheet.occurrence.assigneeUid ? firstName(members.get(sheet.occurrence.assigneeUid)?.displayName) : 'nobody yet',
          ].filter(Boolean).join(' · ')}
          me={me.uid}
          hid={hid}
          onTake={() => {
            setSheet(null)
            void take(sheet.occurrence)
          }}
          onUnassign={() => void assign(sheet.occurrence, null)}
          onAssignTo={() => setSheet({ kind: 'assign', occurrence: sheet.occurrence })}
          onSkip={isAdmin && sheet.occurrence.kind !== 'oneoff' ? () => setSheet({ kind: 'skip', occurrence: sheet.occurrence }) : undefined}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === 'skip' && (
        <SkipDialog
          hid={hid}
          occurrence={sheet.occurrence}
          laterOpen={occurrences.filter((o) => o.choreId === sheet.occurrence.choreId && o.seq > sheet.occurrence.seq).sort((a, b) => a.seq - b.seq)}
          members={members}
          me={me}
          onSkipped={(token) => {
            setSheet(null)
            showSnack({ message: 'Skipped', icon: 'skip-forward', undo: token })
          }}
          onFailed={() => {
            setSheet(null)
            showSnack({ message: 'Couldn’t skip it. Try again.' })
          }}
          onCancel={() => setSheet(null)}
        />
      )}
      {sheet?.kind === 'assign' && (
        <AssignSheet occurrence={sheet.occurrence} members={members} me={me.uid} isAdmin={isAdmin} onAssign={(uid) => void assign(sheet.occurrence, uid)} onClose={() => setSheet(null)} />
      )}
      {fab && <Fab to={fab.to} label={fab.label} lifted={!!snack} />}
      {snack && <Snackbar message={snack.message} icon={snack.icon} onAction={snack.undo ? () => void undo(snack.undo!) : undefined} />}
    </>
  )
}

/** Row actions: Take it / Unassign me, Assign to…, Skip this time (admin), Open chore. */
function RowSheet({ occurrence, subtitle, me, hid, onTake, onUnassign, onAssignTo, onSkip, onClose }: {
  occurrence: Occurrence
  subtitle: string
  me: string
  hid: string
  onTake: () => void
  onUnassign: () => void
  onAssignTo: () => void
  onSkip?: () => void
  onClose: () => void
}) {
  return (
    <BottomSheet title={occurrence.choreTitle} subtitle={subtitle} onClose={onClose}>
      {occurrence.assigneeUid === null && <SheetAction icon="hand" label="Take it" onClick={onTake} />}
      {occurrence.assigneeUid === me && <SheetAction icon="user-round-minus" label="Unassign me" onClick={onUnassign} />}
      <SheetAction icon="user-round-plus" label="Assign to…" onClick={onAssignTo} />
      {onSkip && <SheetAction icon="skip-forward" label="Skip this time" trail="Admin" onClick={onSkip} />}
      <div role="separator" className="mx-5 my-1 h-px bg-border" />
      <Link to={`/h/${hid}/chores/${occurrence.choreId}`} className="flex min-h-14 w-full items-center gap-4 px-5 text-body-medium text-fg no-underline hover:bg-surface-hover">
        <Icon name="arrow-up-right" size={22} className="text-fg-muted" />
        Open chore
      </Link>
    </BottomSheet>
  )
}
