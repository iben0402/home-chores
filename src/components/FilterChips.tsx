import { useRef, type KeyboardEvent } from 'react'
import { cx } from './cx'
import { Icon } from './Icon'

export type ChoreFilter = 'mine' | 'everyone' | 'unassigned'
const OPTIONS: Array<{ value: ChoreFilter; label: string }> = [
  { value: 'mine', label: 'Mine' },
  { value: 'everyone', label: 'Everyone' },
  { value: 'unassigned', label: 'Unassigned' },
]

/** Mine · Everyone · Unassigned, as a radio group (one tab stop; arrows move). */
export function FilterChips({ value, onChange, counts }: { value: ChoreFilter; onChange: (v: ChoreFilter) => void; counts?: Record<ChoreFilter, number> }) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  function onKeyDown(e: KeyboardEvent, i: number) {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key]
    if (!step) return
    e.preventDefault()
    const next = (i + step + OPTIONS.length) % OPTIONS.length
    onChange(OPTIONS[next].value)
    refs.current[next]?.focus()
  }
  return (
    <div role="radiogroup" aria-label="Show chores" className="flex gap-2 overflow-x-auto px-4 pt-3 pb-1 [scrollbar-width:none]">
      {OPTIONS.map((o, i) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cx(
              'relative inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border px-4 text-[14px] leading-5 font-medium whitespace-nowrap after:absolute after:inset-x-0 after:-inset-y-1',
              on ? 'border-primary bg-primary text-on-primary' : 'border-border-strong bg-surface text-fg hover:bg-surface-hover',
            )}
          >
            {on && <Icon name="check" size={16} />}
            {o.label}
            {counts && <span className="tabular-nums opacity-85">{counts[o.value]}</span>}
          </button>
        )
      })}
    </div>
  )
}
