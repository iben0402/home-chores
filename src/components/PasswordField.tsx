import { useId, useState } from 'react'
import { cx } from './cx'
import { FieldLabel, FieldMessage } from './Field'
import { inputClass } from './fieldStyles'
import { Icon } from './Icon'
import type { TextFieldProps } from './TextField'

/** TextField with a show/hide toggle. */
export function PasswordField({ label, hint, error, labelAction, id, className, ...input }: Omit<TextFieldProps, 'type'>) {
  const autoId = useId()
  const inputId = id ?? autoId
  const messageId = `${inputId}-msg`
  const [shown, setShown] = useState(false)
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <FieldLabel htmlFor={inputId} action={labelAction}>
        {label}
      </FieldLabel>
      <div className="relative">
        <input
          id={inputId}
          type={shown ? 'text' : 'password'}
          className={cx(inputClass, 'pr-[52px]')}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? messageId : undefined}
          {...input}
        />
        <button
          type="button"
          aria-label={shown ? 'Hide password' : 'Show password'}
          aria-pressed={shown}
          aria-controls={inputId}
          onClick={() => setShown((s) => !s)}
          className="absolute top-0.5 right-0.5 inline-flex size-(--size-touch) cursor-pointer items-center justify-center rounded-full text-fg-muted transition-colors duration-(--duration-fast) hover:bg-surface-hover"
        >
          <Icon name={shown ? 'eye-off' : 'eye'} size={22} />
        </button>
      </div>
      <FieldMessage id={messageId} error={error} hint={hint} />
    </div>
  )
}
