import type { ReactNode } from 'react'
import { cx } from './cx'
import { Icon, type IconName } from './Icon'

export type DueStatus = 'overdue' | 'today' | 'week' | 'later' | 'date' | 'done' | 'skipped' | 'unassigned'

// Status = colour pair + icon + words (never colour alone).
const styles: Record<DueStatus, { className: string; icon: IconName }> = {
  overdue: { className: 'bg-status-overdue-bg text-status-overdue-fg font-semibold', icon: 'clock-alert' },
  today: { className: 'bg-status-today-bg text-status-today-fg font-semibold', icon: 'sun' },
  week: { className: 'bg-status-upcoming-bg text-status-upcoming-fg', icon: 'calendar' },
  later: { className: 'bg-status-upcoming-bg text-status-upcoming-fg', icon: 'calendar-days' },
  date: { className: 'bg-status-upcoming-bg text-status-upcoming-fg', icon: 'calendar' },
  done: { className: 'bg-status-done-bg text-status-done-fg', icon: 'check' },
  skipped: { className: 'bg-status-skipped-bg text-status-skipped-fg border border-dashed border-border-strong', icon: 'skip-forward' },
  unassigned: { className: 'bg-status-unassigned-bg text-status-unassigned-fg', icon: 'user-round' },
}

export function DueBadge({ status, label }: { status: DueStatus; label: ReactNode }) {
  const { className, icon } = styles[status]
  return (
    <span className={cx('inline-flex h-6 items-center gap-1 rounded-sm px-2 text-[13px] leading-[18px] font-medium whitespace-nowrap', className)}>
      <Icon name={icon} size={14} />
      {status === 'overdue' && <span className="sr-only">Overdue:</span>}
      <span>{label}</span>
    </span>
  )
}
