import { useRef, type KeyboardEvent } from 'react'
import { cx } from './cx'

/** A radio group drawn as a segmented control. */
export function SegmentedControl<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Array<{ value: T; label: string }>; onChange: (v: T) => void }) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  function onKeyDown(e: KeyboardEvent, i: number) {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key]
    if (!step) return
    e.preventDefault()
    const next = (i + step + options.length) % options.length
    onChange(options[next].value)
    refs.current[next]?.focus()
  }
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-[3px] rounded-md border border-border bg-surface-sunken p-[3px]">
      {options.map((o, i) => {
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
              'relative min-h-10 flex-1 cursor-pointer rounded-[8px] px-2 text-[14px] leading-[18px] font-semibold after:absolute after:inset-x-0 after:-inset-y-[3px] focus-visible:outline-offset-0',
              on ? 'bg-surface text-fg shadow-sm outline outline-1 -outline-offset-1 outline-border-strong' : 'text-fg-muted hover:text-fg',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
