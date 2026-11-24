import { act, render } from '@testing-library/react'
import { StrictMode } from 'react'
import { ChorePreview } from './ChorePreview'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const boxes = (container: HTMLElement) => [...container.querySelectorAll('[role="checkbox"]')]

test('is decorative: hidden from assistive tech and out of the tab order', () => {
  const { container } = render(<ChorePreview />)
  expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
  for (const box of boxes(container)) expect(box).toHaveAttribute('tabindex', '-1')
})

test('autoplays once within 5 seconds, then stops', () => {
  const { container } = render(
    <StrictMode>
      <ChorePreview />
    </StrictMode>,
  )
  act(() => vi.advanceTimersByTime(1400))
  expect(boxes(container)[0]).toHaveAttribute('aria-checked', 'true')
  act(() => vi.advanceTimersByTime(3600))
  expect(boxes(container).map((b) => b.getAttribute('aria-checked'))).toEqual(['false', 'false'])
  expect(vi.getTimerCount()).toBe(0)
})

test('unmounting mid-animation leaves no timers behind', () => {
  const { unmount } = render(<ChorePreview />)
  act(() => vi.advanceTimersByTime(1500))
  unmount()
  expect(vi.getTimerCount()).toBe(0)
})

test('does not autoplay under reduced motion', () => {
  const matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })
  vi.stubGlobal('matchMedia', matchMedia)
  const { container } = render(<ChorePreview />)
  act(() => vi.advanceTimersByTime(5000))
  expect(boxes(container).every((b) => b.getAttribute('aria-checked') === 'false')).toBe(true)
  vi.unstubAllGlobals()
})
