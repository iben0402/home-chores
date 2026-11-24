import type { RoomIcon } from '../data/rooms'
import { Icon } from './Icon'

/** A tile on the Rooms tab: one per room, with its open-chores count. Overdue is amber, never red. */
export function RoomCard({ name, icon, open, overdue = 0, onClick }: { name: string; icon: RoomIcon; open: number; overdue?: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${name}, ${open} open${overdue ? `, ${overdue} overdue` : ''}`}
      className="flex min-h-[120px] cursor-pointer flex-col items-start gap-3 rounded-lg border border-border bg-surface p-4 text-left text-fg shadow-sm transition-colors duration-(--duration-fast) hover:bg-surface-hover active:bg-surface-sunken"
    >
      <span aria-hidden="true" className="grid size-10 place-items-center rounded-md bg-primary-soft text-primary">
        <Icon name={icon} size={22} />
      </span>
      <span className="text-[16px] leading-[22px] font-semibold [overflow-wrap:anywhere]">{name}</span>
      <span aria-hidden="true" className="mt-auto flex flex-col gap-0.5 text-[13px] leading-[18px] text-fg-muted">
        <span>{open === 0 ? 'All clear' : `${open} open`}</span>
        {overdue > 0 && (
          <span className="inline-flex items-center gap-1 font-semibold text-status-overdue-fg">
            <Icon name="clock-alert" size={14} />
            {overdue} overdue
          </span>
        )}
      </span>
    </button>
  )
}
