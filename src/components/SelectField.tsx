import { useId } from 'react'
import { cx } from './cx'
import { FieldLabel, FieldMessage } from './Field'
import { inputClass } from './fieldStyles'
import { Icon } from './Icon'

type Option = { value: string; label: string }

/** Native select, styled. With `label` it is a full field; with only `ariaLabel` an inline control. */
export function SelectField({ label, ariaLabel, hint, value, options, onChange, className }: { label?: string; ariaLabel?: string; hint?: string; value: string; options: Option[]; onChange: (v: string) => void; className?: string }) {
  const id = useId()
  const select = (
    <div className={cx('relative', !label && className)}>
      <select
        id={id}
        value={value}
        aria-label={label ? undefined : ariaLabel}
        aria-describedby={hint ? `${id}-msg` : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={cx(inputClass, 'cursor-pointer appearance-none pr-10')}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Icon name="chevron-down" className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-fg-muted" />
    </div>
  )
  if (!label) return select
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {select}
      <FieldMessage id={`${id}-msg`} hint={hint} />
    </div>
  )
}
