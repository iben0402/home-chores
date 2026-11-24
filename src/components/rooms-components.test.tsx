import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import type { RoomIcon } from '../data/rooms'
import { ConfirmDialog } from './ConfirmDialog'
import { IconPicker } from './IconPicker'
import { RoomCard } from './RoomCard'

describe('RoomCard', () => {
  test('names the room and its counts; "All clear" at zero', () => {
    render(
      <>
        <RoomCard name="Kitchen" icon="cooking-pot" open={3} overdue={1} onClick={() => {}} />
        <RoomCard name="Laundry" icon="shirt" open={0} onClick={() => {}} />
      </>,
    )
    expect(screen.getByRole('button', { name: 'Kitchen, 3 open, 1 overdue' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Laundry, 0 open' })).toHaveTextContent('All clear')
  })
})

describe('ConfirmDialog', () => {
  test('is an alertdialog; Cancel is focused first; Escape cancels; confirm confirms', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog title="Delete Living room?" body="Its 3 chores move to General. Their history stays." confirmLabel="Delete room" onCancel={onCancel} onConfirm={onConfirm} />,
    )
    const dialog = screen.getByRole('alertdialog', { name: 'Delete Living room?' })
    expect(dialog).toHaveAccessibleDescription('Its 3 chores move to General. Their history stays.')
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Delete room' }))
    expect(onConfirm).toHaveBeenCalled()
  })
})

describe('IconPicker', () => {
  test('is a radio group; arrows move the choice', async () => {
    const user = userEvent.setup()
    function Harness() {
      const [icon, setIcon] = useState<RoomIcon>('house')
      return <IconPicker value={icon} onChange={setIcon} />
    }
    render(<Harness />)
    const house = screen.getByRole('radio', { name: 'House' })
    expect(house).toBeChecked()
    expect(screen.getAllByRole('radio')).toHaveLength(8)
    house.focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'Cooking pot' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Cooking pot' })).toHaveFocus()
  })
})
