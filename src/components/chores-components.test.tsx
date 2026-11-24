import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import type { ScheduleForm } from '../lib/schedule'
import { ChoreRow } from './ChoreRow'
import { FilterChips } from './FilterChips'
import { NumberStepper } from './NumberStepper'
import { ScheduleEditor } from './ScheduleEditor'
import { SectionHeader } from './SectionHeader'
import { Snackbar } from './Snackbar'

test('FilterChips: a radio group with counts', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(<FilterChips value="everyone" onChange={onChange} counts={{ mine: 2, everyone: 5, unassigned: 1 }} />)
  expect(screen.getByRole('radiogroup', { name: 'Show chores' })).toBeInTheDocument()
  expect(screen.getByRole('radio', { name: /Everyone/ })).toBeChecked()
  expect(screen.getByRole('radio', { name: /Mine/ })).toHaveTextContent('Mine2')
  await user.click(screen.getByRole('radio', { name: /Unassigned/ }))
  expect(onChange).toHaveBeenCalledWith('unassigned')
})

test('SectionHeader: label and count', () => {
  render(<SectionHeader tone="overdue" label="Overdue" count={2} />)
  expect(screen.getByRole('heading', { name: /Overdue · 2/ })).toBeInTheDocument()
})

test('Snackbar: message and Undo', async () => {
  const user = userEvent.setup()
  const onUndo = vi.fn()
  render(<Snackbar message="Bins out — done" actionLabel="Undo" onAction={onUndo} />)
  expect(screen.getByRole('status')).toHaveTextContent('Bins out — done')
  await user.click(screen.getByRole('button', { name: 'Undo' }))
  expect(onUndo).toHaveBeenCalled()
})

test('NumberStepper stays within bounds', async () => {
  const user = userEvent.setup()
  function Harness() {
    const [n, setN] = useState(1)
    return <NumberStepper value={n} min={1} max={3} label="Number of weeks" onChange={setN} />
  }
  render(<Harness />)
  expect(screen.getByRole('button', { name: 'Decrease' })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Increase' }))
  await user.click(screen.getByRole('button', { name: 'Increase' }))
  expect(screen.getByRole('group', { name: 'Number of weeks' })).toHaveTextContent('3')
  expect(screen.getByRole('button', { name: 'Increase' })).toBeDisabled()
})

describe('ScheduleEditor', () => {
  // The stepper's <output> is also a status; the schedule summary is the last one.
  const summary = () => screen.getAllByRole('status').at(-1)!
  function Harness({ initial }: { initial: ScheduleForm }) {
    const [value, setValue] = useState(initial)
    return <ScheduleEditor value={value} onChange={setValue} today="2026-11-24" />
  }
  const base: ScheduleForm = { mode: 'after', every: 1, unit: 'weeks', calMode: 'week', days: ['mon'], dom: 1 }

  test('after it’s done: summary and “if done today” preview', () => {
    render(<Harness initial={base} />)
    expect(screen.getByRole('radio', { name: 'After it’s done' })).toBeChecked()
    expect(summary()).toHaveTextContent('Due again 1 week after someone last did it.')
    expect(summary()).toHaveTextContent('If done today: Tue 1 Dec · Tue 8 Dec · Tue 15 Dec')
  })

  test('on set days: toggling days updates the summary', async () => {
    const user = userEvent.setup()
    render(<Harness initial={base} />)
    await user.click(screen.getByRole('radio', { name: 'On set days' }))
    expect(summary()).toHaveTextContent('Every Monday, no matter when it was last done.')
    await user.click(screen.getByRole('button', { name: 'Thursday' }))
    expect(screen.getByRole('button', { name: 'Thursday' })).toHaveAttribute('aria-pressed', 'true')
    expect(summary()).toHaveTextContent('Every Monday and Thursday, no matter when it was last done.')
    expect(summary()).toHaveTextContent('Next: Thu 26 Nov · Mon 30 Nov · Thu 3 Dec')
  })
})

describe('ChoreRow', () => {
  test('unassigned shows Take it; one-off shows its kind and who raised it', async () => {
    const user = userEvent.setup()
    const onTake = vi.fn()
    render(
      <ChoreRow
        chore={{ title: 'Clean your dishes in the sink', room: 'Kitchen', due: { status: 'today', label: 'Today' }, kind: 'oneoff', from: 'Tom', assignee: null }}
        onTake={onTake}
      />,
    )
    expect(screen.getByText('One-off')).toBeInTheDocument()
    expect(screen.getByText('from Tom')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Take it: Clean your dishes in the sink' }))
    expect(onTake).toHaveBeenCalled()
  })

  test('repeating chores say so to screen readers', () => {
    render(<ChoreRow chore={{ title: 'Vacuuming', due: { status: 'week', label: 'Thu 3 Dec' }, kind: 'interval', assignee: null }} />)
    expect(screen.getByText('Repeats')).toHaveClass('sr-only')
  })
})
