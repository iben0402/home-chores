import type { ReactNode } from 'react'
import { cx } from './cx'
import { Icon } from './Icon'

/** Calm note on a sunken well, with an info icon (e.g. "A General room is already there."). */
export function InfoNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('flex items-start gap-3 rounded-md bg-surface-sunken px-4 py-3 text-[15px] leading-[22px] text-fg [&_strong]:font-semibold', className)}>
      <Icon name="info" className="mt-px shrink-0 text-primary" />
      <span>{children}</span>
    </div>
  )
}
