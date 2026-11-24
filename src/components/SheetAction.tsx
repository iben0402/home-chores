import { cx } from './cx'
import { Icon, type IconName } from './Icon'

/** A full-width action row inside a bottom sheet. */
export function SheetAction({ icon, label, trail, danger, onClick }: { icon: IconName; label: string; trail?: string; danger?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'flex min-h-14 w-full cursor-pointer items-center gap-4 px-5 text-left text-body-medium hover:bg-surface-hover active:bg-surface-sunken',
        danger ? 'text-danger' : 'text-fg',
      )}
    >
      <Icon name={icon} size={22} className={danger ? '' : 'text-fg-muted'} />
      <span className="flex-1">{label}</span>
      {trail && <span className="text-[14px] text-fg-muted">{trail}</span>}
    </button>
  )
}
