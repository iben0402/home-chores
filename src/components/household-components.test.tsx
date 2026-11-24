import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { MemoryRouter } from 'react-router'
import { BottomSheet } from './BottomSheet'
import { CodeInput } from './CodeInput'
import { InviteCard } from './InviteCard'
import { TabBar } from './TabBar'

describe('CodeInput', () => {
  test('formats as you type and reports the normalised code', async () => {
    const user = userEvent.setup()
    const seen: string[] = []
    function Harness() {
      const [code, setCode] = useState('')
      return (
        <CodeInput
          value={code}
          onChange={(next) => {
            seen.push(next)
            setCode(next)
          }}
        />
      )
    }
    render(<Harness />)
    const input = screen.getByLabelText('Invite code')
    await user.type(input, 'k7qm 4x')
    expect(input).toHaveValue('K7QM-4X')
    expect(seen.at(-1)).toBe('K7QM4X')
    await user.clear(input)
    await user.paste('k7qm-4xrt-and-more')
    expect(input).toHaveValue('K7QM-4XRT')
    expect(input).toHaveAccessibleDescription('Paste it or type it. Dashes and spaces don’t matter.')
  })

  test('error replaces the hint', () => {
    render(<CodeInput value="K7QM4XRB" onChange={() => {}} error="That code doesn’t match a household. Check it with whoever sent it." />)
    expect(screen.getByLabelText('Invite code')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Invite code')).toHaveAccessibleDescription('That code doesn’t match a household. Check it with whoever sent it.')
  })
})

describe('InviteCard', () => {
  test('shows the code in groups of four and spells it for screen readers', () => {
    render(<InviteCard code="K7QM4XRT" onCopy={() => {}} onShare={() => {}} />)
    const code = screen.getByLabelText('Invite code: K 7 Q M 4 X R T')
    expect(code).toHaveTextContent('K7QM-4XRT')
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument()
  })
})

describe('BottomSheet', () => {
  test('is modal: the app behind it is inert, and it has a Close button', async () => {
    const user = userEvent.setup()
    const root = document.createElement('div')
    root.id = 'root'
    document.body.appendChild(root)
    const onClose = vi.fn()
    const { unmount } = render(
      <BottomSheet title="Invite someone" onClose={onClose}>
        <p>Body</p>
      </BottomSheet>,
      { container: root },
    )
    expect(root.inert).toBe(true)
    expect(root.contains(screen.getByRole('dialog', { name: 'Invite someone' }))).toBe(false)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalled()
    unmount()
    expect(root.inert).toBe(false)
    root.remove()
  })

  test('Escape closes even when focus is elsewhere', () => {
    const onClose = vi.fn()
    render(
      <BottomSheet title="Invite someone" onClose={onClose}>
        <p>Body</p>
      </BottomSheet>,
    )
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  test('is a dialog, takes focus and closes on Escape', () => {
    const onClose = vi.fn()
    render(
      <BottomSheet title="Invite people" onClose={onClose}>
        <p>Body</p>
      </BottomSheet>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Invite people' })
    expect(dialog).toHaveFocus()
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})

describe('TabBar', () => {
  test('marks the current tab', () => {
    render(
      <MemoryRouter initialEntries={['/h/abc/history']}>
        <TabBar hid="abc" />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'History' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Today' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: 'Today' })).toHaveAttribute('href', '/h/abc')
  })
})
