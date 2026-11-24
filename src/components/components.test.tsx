import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Avatar } from './Avatar'
import { Button } from './Button'
import { ChoreRow } from './ChoreRow'
import { DueBadge } from './DueBadge'
import { OfflineNotice } from './OfflineNotice'
import { PasswordField } from './PasswordField'
import { TextField } from './TextField'

describe('Button', () => {
  test('loading sets aria-busy and disables', () => {
    render(<Button loading>Log in</Button>)
    const button = screen.getByRole('button', { name: /log in/i })
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button).toBeDisabled()
  })
})

describe('TextField', () => {
  test('error sets aria-invalid and describes the input', () => {
    render(<TextField label="Email" error="There’s already an account with this email." />)
    const input = screen.getByLabelText('Email')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('There’s already an account with this email.')
  })

  test('hint describes the input when there is no error', () => {
    render(<TextField label="Your name" hint="This is what people in your household see." />)
    expect(screen.getByLabelText('Your name')).toHaveAccessibleDescription(
      'This is what people in your household see.',
    )
  })
})

describe('PasswordField', () => {
  test('toggle shows and hides the password and flips its label', async () => {
    const user = userEvent.setup()
    render(<PasswordField label="Password" />)
    const input = screen.getByLabelText('Password', { selector: 'input' })
    expect(input).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(input).toHaveAttribute('type', 'text')
    const hide = screen.getByRole('button', { name: 'Hide password' })
    expect(hide).toHaveAttribute('aria-pressed', 'true')
    await user.click(hide)
    expect(input).toHaveAttribute('type', 'password')
  })
})

describe('OfflineNotice', () => {
  test('appears on offline event and hides on online', () => {
    render(<OfflineNotice />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    act(() => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
      window.dispatchEvent(new Event('offline'))
    })
    expect(screen.getByRole('status')).toHaveTextContent('You’re offline. You can keep typing; we’ll connect when you’re back.')
    act(() => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
      window.dispatchEvent(new Event('online'))
    })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})

describe('Avatar', () => {
  test('uses initials of first two words', () => {
    render(
      <>
        <Avatar name="Anna Nowak" color={1} />
        <Avatar name="Tom" color={2} />
      </>,
    )
    expect(screen.getByLabelText('Anna Nowak')).toHaveTextContent('AN')
    expect(screen.getByLabelText('Tom')).toHaveTextContent('T')
  })
})

describe('DueBadge', () => {
  test('overdue badge announces Overdue:', () => {
    render(<DueBadge status="overdue" label="Mon 30 Nov" />)
    expect(screen.getByText('Overdue:')).toHaveClass('sr-only')
    expect(screen.getByText('Mon 30 Nov')).toBeInTheDocument()
  })
})

describe('ChoreRow', () => {
  test('checkbox reports toggle with the new state', () => {
    const onToggle = vi.fn()
    render(
      <ChoreRow
        chore={{ title: 'Bins out', room: 'General', due: { status: 'today', label: 'Today' } }}
        onToggle={onToggle}
      />,
    )
    const box = screen.getByRole('checkbox', { name: 'Mark done: Bins out' })
    expect(box).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(box)
    expect(onToggle).toHaveBeenCalledWith(true)
  })
})
