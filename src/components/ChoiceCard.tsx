import { Link } from 'react-router'
import { cx } from './cx'
import { Icon, type IconName } from './Icon'

type ChoiceCardProps = { to: string; icon: IconName; title: string; description: string; variant?: 'primary' | 'secondary' }

/** A full-width link card for picking a path. One primary per screen. */
export function ChoiceCard({ to, icon, title, description, variant = 'secondary' }: ChoiceCardProps) {
  const primary = variant === 'primary'
  return (
    <Link
      to={to}
      className={cx(
        'flex min-h-24 items-center gap-4 rounded-lg p-4 text-fg no-underline transition-[transform,background-color,border-color] duration-(--duration-fast) active:scale-[0.98]',
        primary ? 'border-2 border-primary bg-primary-soft' : 'border border-border-strong bg-surface p-[17px] hover:bg-surface-hover',
      )}
    >
      <span
        aria-hidden="true"
        className={cx('grid size-12 shrink-0 place-items-center rounded-full', primary ? 'bg-primary text-on-primary' : 'bg-surface-sunken text-fg')}
      >
        <Icon name={icon} size={24} />
      </span>
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="text-heading">{title}</span>
        <span className="text-[14px] leading-5 text-fg-muted">{description}</span>
      </span>
      <Icon name="chevron-right" className={primary ? 'text-primary' : 'text-fg-muted'} />
    </Link>
  )
}
