import { cx } from './cx'
import { Icon, type IconName } from './Icon'

type Tone = 'overdue' | 'today' | 'week' | 'later'
const ICONS: Record<Tone, IconName> = { overdue: 'clock-alert', today: 'sun', week: 'calendar', later: 'calendar-days' }
const COLORS: Record<Tone, string> = { overdue: 'text-status-overdue-fg', today: 'text-status-today-fg', week: 'text-fg-muted', later: 'text-fg-muted' }

/** Sticky group label for the Today list: Overdue · Today · This week · Later. */
export function SectionHeader({ tone, label, count, id }: { tone: Tone; label: string; count?: number; id?: string }) {
  return (
    <h2 id={id} className={cx('sticky top-0 z-(--z-sticky) m-0 flex items-center gap-2 bg-canvas px-4 pt-5 pb-2 text-overline uppercase', COLORS[tone])}>
      <Icon name={ICONS[tone]} size={16} />
      <span>{label}</span>{' '}
      {count !== undefined && <span className="font-medium tracking-normal text-fg-muted">· {count}</span>}
    </h2>
  )
}
