import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { Navigate } from 'react-router'
import { Button } from '../../components/Button'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { cx } from '../../components/cx'
import { Icon } from '../../components/Icon'
import { IconButton } from '../../components/IconButton'
import { TopBar } from '../../components/TopBar'
import { addRoom, deleteRoom, reorderRooms, updateRoom, type Room } from '../../data/rooms'
import { db } from '../../lib/firebase'
import { FormError } from '../auth/parts'
import { useHousehold } from '../shell/useHousehold'
import { useIsAdmin } from '../shell/useIsAdmin'
import { AddRoomSheet, RenameRoomSheet } from './RoomSheets'
import { useRooms } from './useRooms'

type Open = { kind: 'add' } | { kind: 'rename'; room: Room } | { kind: 'delete'; room: Room } | null

/** 1c · Manage rooms (admin): reorder (drag or arrow keys), rename, delete, add. */
export function ManageRoomsPage() {
  const household = useHousehold()
  const isAdmin = useIsAdmin()
  const rooms = useRooms(household.id)
  const [open, setOpen] = useState<Open>(null)
  const [order, setOrder] = useState<string[] | null>(null) // local order while dragging/saving
  const [announcement, setAnnouncement] = useState('')
  const [error, setError] = useState<string>()
  const [deleting, setDeleting] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const rowRefs = useRef(new Map<string, HTMLLIElement>())
  const handleRefs = useRef(new Map<string, HTMLButtonElement>())
  const drag = useRef<{ id: string; start: string[] } | null>(null)
  const focusAfter = useRef<string | null>(null)

  const general = rooms?.find((r) => r.isDefault)
  const movable = (rooms ?? []).filter((r) => !r.isDefault)
  const byId = new Map(movable.map((r) => [r.id, r]))
  const ids = (order ?? movable.map((r) => r.id)).filter((id) => byId.has(id))

  // Keep keyboard focus on the handle that was just moved (the list re-renders).
  useEffect(() => {
    if (focusAfter.current) handleRefs.current.get(focusAfter.current)?.focus()
    focusAfter.current = null
  })

  if (!isAdmin) return <Navigate to={`/h/${household.id}/rooms`} replace />
  if (!rooms) return null

  const total = rooms.length

  async function save(next: string[], movedId: string) {
    setOrder(next)
    const room = byId.get(movedId)
    setAnnouncement(`${room?.name}, moved to position ${next.indexOf(movedId) + 2} of ${total}.`)
    setError(undefined)
    try {
      await reorderRooms(db, household.id, next)
    } catch {
      setOrder(null)
      setError('Something went wrong. Try again.')
    }
  }

  function move(id: string, by: number) {
    const from = ids.indexOf(id)
    const to = from + by
    if (to < 0 || to >= ids.length) return
    const next = [...ids]
    next.splice(to, 0, ...next.splice(from, 1))
    focusAfter.current = id
    void save(next, id)
  }

  function onHandleKey(e: KeyboardEvent, id: string) {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      move(id, e.key === 'ArrowUp' ? -1 : 1)
    }
  }

  function onPointerDown(e: PointerEvent, id: string) {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { id, start: ids }
    setDraggingId(id)
    setOrder(ids)
  }

  function onPointerMove(e: PointerEvent) {
    const active = drag.current
    if (!active) return
    // The row the pointer is over becomes the dragged row's new position.
    const current = order ?? ids
    const target = current.findIndex((rid) => {
      const rect = rowRefs.current.get(rid)?.getBoundingClientRect()
      return rect && e.clientY >= rect.top && e.clientY < rect.bottom
    })
    const from = current.indexOf(active.id)
    if (target === -1 || target === from) return
    const next = [...current]
    next.splice(target, 0, ...next.splice(from, 1))
    setOrder(next)
  }

  function onPointerUp() {
    const active = drag.current
    drag.current = null
    setDraggingId(null)
    if (!active) return
    const next = order ?? ids
    if (next.join() === active.start.join()) return setOrder(null)
    void save(next, active.id)
  }

  function onPointerCancel() {
    drag.current = null
    setDraggingId(null)
    setOrder(null)
  }

  const row = 'flex min-h-16 items-center gap-2 border-t border-border bg-surface py-2 pr-2 pl-1'

  return (
    <>
      <TopBar title="Manage rooms" back={`/h/${household.id}/rooms`} />
      <p className="m-0 px-4 pb-3 text-[15px] leading-[22px] text-fg-muted">
        Drag to change the order on the Rooms tab. Deleting a room moves its chores to General.
      </p>
      <p role="status" className="sr-only">
        {announcement}
      </p>
      <ul aria-label="Rooms" className="m-0 list-none border-b border-border p-0">
        {general && (
          <li className={row}>
            <span aria-hidden="true" className="w-11 shrink-0" />
            <RoomIconTile room={general} />
            <RoomText name={general.name} caption="Always first · can’t be deleted" />
            <IconButton icon="pencil" label={`Rename ${general.name}`} onClick={() => setOpen({ kind: 'rename', room: general })} />
            <span aria-hidden="true" className="w-11 shrink-0" />
          </li>
        )}
        {ids.map((id) => {
          const room = byId.get(id)!
          const dragging = draggingId === id
          return (
            <li
              key={id}
              ref={(el) => {
                if (el) rowRefs.current.set(id, el)
                else rowRefs.current.delete(id)
              }}
              className={cx(row, dragging && 'relative z-10 shadow-md')}
            >
              <button
                ref={(el) => {
                  if (el) handleRefs.current.set(id, el)
                  else handleRefs.current.delete(id)
                }}
                type="button"
                aria-label={`Reorder ${room.name}`}
                aria-roledescription="drag handle"
                aria-describedby="reorder-help"
                onKeyDown={(e) => onHandleKey(e, id)}
                onPointerDown={(e) => onPointerDown(e, id)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerCancel}
                className="inline-flex size-(--size-touch) shrink-0 cursor-grab touch-none items-center justify-center rounded-full text-fg-muted hover:bg-surface-hover active:cursor-grabbing"
              >
                <Icon name="grip-vertical" />
              </button>
              <RoomIconTile room={room} />
              <RoomText name={room.name} caption="No chores" />
              <IconButton icon="pencil" label={`Rename ${room.name}`} onClick={() => setOpen({ kind: 'rename', room })} />
              <IconButton icon="trash-2" tone="danger" label={`Delete ${room.name}`} onClick={() => setOpen({ kind: 'delete', room })} />
            </li>
          )
        })}
      </ul>
      <p id="reorder-help" className="sr-only">
        Use the up and down arrow keys to move this room.
      </p>
      <div className="flex flex-col gap-3 px-4 pt-4 pb-6">
        <FormError message={error} />
        <Button variant="secondary" size="lg" block icon="plus" onClick={() => setOpen({ kind: 'add' })}>
          Add a room
        </Button>
      </div>

      {open?.kind === 'add' && <AddRoomSheet onAdd={(room) => addRoom(db, household.id, room)} onClose={() => setOpen(null)} />}
      {open?.kind === 'rename' && (
        <RenameRoomSheet room={open.room} onRename={(name) => updateRoom(db, household.id, open.room.id, { name })} onClose={() => setOpen(null)} />
      )}
      {open?.kind === 'delete' && (
        <ConfirmDialog
          title={`Delete ${open.room.name}?`}
          body="It has no chores."
          confirmLabel="Delete room"
          loading={deleting}
          onCancel={() => setOpen(null)}
          onConfirm={async () => {
            setDeleting(true)
            try {
              await deleteRoom(db, household.id, open.room.id)
              setOpen(null)
            } catch {
              setError('Something went wrong. Try again.')
              setOpen(null)
            } finally {
              setDeleting(false)
            }
          }}
        />
      )}
    </>
  )
}

function RoomIconTile({ room }: { room: Room }) {
  return (
    <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-md bg-primary-soft text-primary">
      <Icon name={room.icon} size={22} />
    </span>
  )
}

function RoomText({ name, caption }: { name: string; caption: string }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="truncate text-[16px] leading-[22px] font-semibold">{name}</span>
      <span className="text-[13px] leading-[18px] text-fg-muted">{caption}</span>
    </span>
  )
}
