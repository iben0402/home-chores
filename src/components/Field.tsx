import type { ReactNode } from 'react'
import { Icon } from './Icon'

/** Label row: the label plus an optional trailing action (e.g. "Forgot password?"). */
export function FieldLabel({ htmlFor, children, action }: { htmlFor: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <label htmlFor={htmlFor} className="text-[14px] leading-5 font-semibold text-fg">
        {children}
      </label>
      {action}
    </div>
  )
}

/** The error (with icon) if there is one, otherwise the hint. */
export function FieldMessage({ id, error, hint }: { id: string; error?: string; hint?: string }) {
  if (error) {
    return (
      <p id={id} className="m-0 flex items-start gap-1.5 text-[13px] leading-[18px] text-danger">
        <Icon name="circle-alert" size={16} className="mt-px shrink-0" />
        <span>{error}</span>
      </p>
    )
  }
  if (hint) {
    return (
      <p id={id} className="m-0 text-[13px] leading-[18px] text-fg-muted">
        {hint}
      </p>
    )
  }
  return null
}
