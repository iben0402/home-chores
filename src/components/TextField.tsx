import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cx } from './cx'
import { FieldLabel, FieldMessage } from './Field'
import { inputClass } from './fieldStyles'

export type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  hint?: string
  error?: string
  labelAction?: ReactNode
}

export function TextField({ label, hint, error, labelAction, id, className, ...input }: TextFieldProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const messageId = `${inputId}-msg`
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <FieldLabel htmlFor={inputId} action={labelAction}>
        {label}
      </FieldLabel>
      <input
        id={inputId}
        className={inputClass}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? messageId : undefined}
        {...input}
      />
      <FieldMessage id={messageId} error={error} hint={hint} />
    </div>
  )
}
