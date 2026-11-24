import { useEffect, useRef, useState } from 'react'
import { ChoreRow } from '../../components/ChoreRow'
import { Fab } from '../../components/Fab'
import type { ChoreFilter } from '../../components/FilterChips'
import { SectionHeader } from '../../components/SectionHeader'
import { Snackbar } from '../../components/Snackbar'
import { completeOccurrence, takeOccurrence, undoCompletion, type Occurrence, type UndoToken } from '../../data/chores'
import type { Member } from '../../data/households'
import type { Room } from '../../data/rooms'
import { dueLabel, todayISO } from '../../lib/schedule'
import { db } from '../../lib/firebase'
import { firstName } from '../../lib/names'
import { useAuth } from '../auth/useAuth'
import { buildChoreList } from './choreList'

type Snack = { message: string; undo?: UndoToken } | null

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
  const today = todayISO()
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
                />
              )
            })}
          </div>
        </section>
      ))}
      {fab && <Fab to={fab.to} label={fab.label} lifted={!!snack} />}
      {snack && <Snackbar message={snack.message} onAction={snack.undo ? () => void undo(snack.undo!) : undefined} />}
    </>
  )
}
