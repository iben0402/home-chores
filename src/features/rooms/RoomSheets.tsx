import { useState, type FormEvent } from 'react'
import { BottomSheet } from '../../components/BottomSheet'
import { Button } from '../../components/Button'
import { IconPicker } from '../../components/IconPicker'
import { TextField } from '../../components/TextField'
import type { Room, RoomIcon } from '../../data/rooms'
import { FormError } from '../auth/parts'

const NAME_REQUIRED = 'Give the room a name.'
const FAILED = 'Something went wrong. Try again.'

function useSave(onDone: () => void) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  async function save(action: () => Promise<unknown>) {
    if (busy) return
    setBusy(true)
    setError(undefined)
    try {
      await action()
      onDone()
    } catch {
      setError(FAILED)
      setBusy(false)
    }
  }
  return { busy, error, save }
}

export function AddRoomSheet({ onAdd, onClose }: { onAdd: (room: { name: string; icon: RoomIcon }) => Promise<unknown>; onClose: () => void }) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState<RoomIcon>('house')
  const [nameError, setNameError] = useState<string>()
  const { busy, error, save } = useSave(onClose)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setNameError(NAME_REQUIRED)
    void save(() => onAdd({ name: name.trim(), icon }))
  }

  return (
    <BottomSheet title="Add a room" onClose={onClose}>
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4 px-5">
        <TextField
          label="Room name"
          placeholder="e.g. Hallway"
          maxLength={80}
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setNameError(undefined)
          }}
          error={nameError}
        />
        <IconPicker value={icon} onChange={setIcon} />
        <FormError message={error} />
        <Button type="submit" variant="primary" size="lg" block loading={busy}>
          Add room
        </Button>
      </form>
    </BottomSheet>
  )
}

export function RenameRoomSheet({ room, onRename, onClose }: { room: Room; onRename: (name: string) => Promise<unknown>; onClose: () => void }) {
  const [name, setName] = useState(room.name)
  const [nameError, setNameError] = useState<string>()
  const { busy, error, save } = useSave(onClose)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setNameError(NAME_REQUIRED)
    void save(() => onRename(name.trim()))
  }

  return (
    <BottomSheet title="Rename room" onClose={onClose}>
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4 px-5">
        <TextField
          label="Room name"
          maxLength={80}
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setNameError(undefined)
          }}
          hint={room.isDefault ? 'General can’t be deleted. Chores from deleted rooms move here.' : undefined}
          error={nameError}
        />
        <FormError message={error} />
        <Button type="submit" variant="primary" size="lg" block loading={busy}>
          Save
        </Button>
      </form>
    </BottomSheet>
  )
}
