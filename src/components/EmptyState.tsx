import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

export function EmptyState({ icon, title, body, children }: { icon: IconName; title: string; body: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-8 pt-10 pb-8 text-center">
      <span aria-hidden="true" className="mb-2 grid size-16 place-items-center rounded-full bg-surface-sunken text-fg-muted">
        <Icon name={icon} size={28} />
      </span>
      <h2 className="m-0 text-title">{title}</h2>
      <p className="m-0 max-w-[300px] text-body text-fg-muted">{body}</p>
      {children && <div className="mt-3 flex w-full max-w-[280px] flex-col gap-2">{children}</div>}
    </div>
  )
}
