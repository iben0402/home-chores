import { Icon } from './Icon'

export function NumberStepper({ value, min = 1, max = 99, label, onChange }: { value: number; min?: number; max?: number; label: string; onChange: (n: number) => void }) {
  const set = (n: number) => onChange(Math.max(min, Math.min(max, n)))
  const btn = 'flex size-(--size-touch) cursor-pointer items-center justify-center rounded-[9px] text-primary enabled:hover:bg-surface-hover disabled:cursor-not-allowed disabled:text-fg-disabled'
  return (
    <div role="group" aria-label={label} className="inline-flex items-center rounded-md border border-border-strong bg-surface">
      <button type="button" aria-label="Decrease" disabled={value <= min} onClick={() => set(value - 1)} className={btn}>
        <Icon name="minus" />
      </button>
      <output aria-live="polite" className="min-w-10 text-center text-[17px] font-bold tabular-nums">
        {value}
      </output>
      <button type="button" aria-label="Increase" disabled={value >= max} onClick={() => set(value + 1)} className={btn}>
        <Icon name="plus" />
      </button>
    </div>
  )
}
