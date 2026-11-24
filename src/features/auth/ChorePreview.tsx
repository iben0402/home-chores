import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ChoreRow, type ChoreRowData } from '../../components/ChoreRow'

const CHORES: ChoreRowData[] = [
  { title: 'Bins out', room: 'General', due: { status: 'today', label: 'Today' }, assignee: { name: 'Tom Reid', color: 1 } },
  { title: 'Wipe the hob', room: 'Kitchen', due: { status: 'week', label: 'Thu 3 Dec' }, assignee: { name: 'Maja Lis', color: 2 } },
]

type Phase = 'in' | 'out' | 'back'
type RowState = { done: boolean; phase: Phase }

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

function rowStyle(phase: Phase, reduce: boolean): CSSProperties {
  if (phase === 'out') {
    return reduce
      ? { opacity: 0, transition: 'opacity 120ms linear' }
      : { opacity: 0, filter: 'blur(6px)', transform: 'translateY(-6px) scale(0.98)', transition: 'opacity 320ms var(--ease-accelerate), filter 320ms var(--ease-accelerate), transform 320ms var(--ease-accelerate)' }
  }
  if (phase === 'back') {
    return reduce ? { opacity: 0, transition: 'none' } : { opacity: 0, filter: 'blur(6px)', transform: 'translateY(8px) scale(0.98)', transition: 'none' }
  }
  return {
    opacity: 1,
    transition: reduce ? 'opacity 120ms linear' : 'opacity 360ms var(--ease-decelerate), filter 360ms var(--ease-decelerate), transform 360ms var(--ease-decelerate)',
  }
}

/**
 * Two example chores on the Welcome screen. Decorative: hidden from screen readers and out of the
 * tab order. Autoplays one tick (tick → hold 700ms → fade out → back) that is over within 5s,
 * so nothing moves on its own after that (WCAG 2.2.2). Tapping a row replays it.
 */
export function ChorePreview() {
  const [rows, setRows] = useState<RowState[]>(CHORES.map(() => ({ done: false, phase: 'in' })))
  const [reduce] = useState(prefersReducedMotion)
  const timers = useRef(new Set<number>())
  const playing = useRef(new Set<number>())

  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timers.current.delete(id)
      fn()
    }, ms)
    timers.current.add(id)
  }
  const patch = (i: number, next: Partial<RowState>) =>
    setRows((current) => current.map((row, j) => (j === i ? { ...row, ...next } : row)))

  const play = (i: number) => {
    if (playing.current.has(i)) return
    playing.current.add(i)
    patch(i, { done: true, phase: 'in' })
    later(() => patch(i, { phase: 'out' }), 700)
    later(() => patch(i, { done: false, phase: 'back' }), 1920)
    later(() => {
      patch(i, { phase: 'in' })
      playing.current.delete(i)
    }, 1960)
  }

  useEffect(() => {
    const pending = timers.current
    const active = playing.current
    if (!reduce) later(() => play(0), 1400)
    return () => {
      pending.forEach(clearTimeout)
      pending.clear()
      active.clear()
    }
    // Mount-only: one autoplay per visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div aria-hidden="true" className="mt-2 overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
      {CHORES.map((chore, i) => (
        <div key={chore.title} style={rowStyle(rows[i].phase, reduce)} className={i > 0 ? 'border-t border-border' : undefined}>
          <ChoreRow chore={{ ...chore, done: rows[i].done }} onToggle={() => play(i)} decorative />
        </div>
      ))}
    </div>
  )
}
