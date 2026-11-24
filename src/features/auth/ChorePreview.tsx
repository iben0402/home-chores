import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { ChoreRow, type ChoreRowData } from '../../components/ChoreRow'

const CHORES: ChoreRowData[] = [
  { title: 'Bins out', room: 'General', due: { status: 'today', label: 'Today' }, assignee: { name: 'Tom Reid', color: 1 } },
  { title: 'Wipe the hob', room: 'Kitchen', due: { status: 'week', label: 'Thu 3 Dec' }, assignee: { name: 'Maja Lis', color: 2 } },
]

type Phase = 'in' | 'out' | 'back'
type RowState = { done: boolean; phase: Phase; busy: boolean }

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

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
 * Two example chores on the Welcome screen. They take turns being ticked off: tick → hold 700ms →
 * fade out → come back. Tapping a checkbox plays it too. No autoplay under reduced motion.
 */
export function ChorePreview() {
  const [rows, setRows] = useState<RowState[]>(CHORES.map(() => ({ done: false, phase: 'in', busy: false })))
  const timers = useRef<number[]>([])
  const reduce = useRef(reducedMotion())

  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms))
  const patch = (i: number, next: Partial<RowState>) =>
    setRows((current) => current.map((row, j) => (j === i ? { ...row, ...next } : row)))

  const play = useCallback((i: number) => {
    setRows((current) => {
      if (current[i].busy) return current
      later(() => patch(i, { phase: 'out' }), 700)
      later(() => patch(i, { done: false, phase: 'back' }), 1920)
      later(() => patch(i, { phase: 'in', busy: false }), 1960)
      return current.map((row, j) => (j === i ? { done: true, phase: 'in', busy: true } : row))
    })
  }, [])

  useEffect(() => {
    const pending = timers.current
    if (reduce.current) return () => pending.forEach(clearTimeout)
    let next = 0
    const loop = (delay: number) =>
      later(() => {
        play(next)
        next = 1 - next
        loop(4800)
      }, delay)
    loop(1400)
    return () => pending.forEach(clearTimeout)
  }, [play])

  return (
    <div role="group" aria-label="Example chores" className="mt-2 overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
      {CHORES.map((chore, i) => (
        <div key={chore.title} style={rowStyle(rows[i].phase, reduce.current)} className={i > 0 ? 'border-t border-border' : undefined}>
          <ChoreRow chore={{ ...chore, done: rows[i].done }} onToggle={() => play(i)} />
        </div>
      ))}
    </div>
  )
}
