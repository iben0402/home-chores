import type { Ref } from 'react'
import { Icon } from './Icon'

type Props = {
  household: string
  onSwitch?: () => void
  /** The notification bell shows when `onBell` is given. */
  unread?: number
  onBell?: () => void
  bellOpen?: boolean
  bellRef?: Ref<HTMLButtonElement>
}

/** Top bar: which household you're in (tap to switch), and the notification bell with its unread count. */
export function AppHeader({ household, onSwitch, unread = 0, onBell, bellOpen, bellRef }: Props) {
  return (
    <header className="sticky top-0 z-(--z-header) h-(--size-header) shrink-0 bg-canvas">
      <div className="mx-auto flex h-full w-full max-w-(--size-content) items-center justify-between px-2">
        {onSwitch ? (
          <button
            type="button"
            aria-haspopup="dialog"
            aria-label={`Household: ${household}. Switch household`}
            onClick={onSwitch}
            className="inline-flex max-w-[75%] min-h-(--size-touch) cursor-pointer items-center gap-1.5 rounded-md px-2 text-[18px] leading-6 font-bold text-fg hover:bg-surface-hover"
          >
            <span className="truncate">{household}</span>
            <Icon name="chevron-down" />
          </button>
        ) : (
          <p className="m-0 truncate px-2 text-[18px] leading-6 font-bold">{household}</p>
        )}
        {onBell && (
          <button
            ref={bellRef}
            type="button"
            aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
            aria-haspopup="dialog"
            aria-expanded={bellOpen ?? false}
            onClick={onBell}
            className="relative inline-flex size-(--size-touch) shrink-0 cursor-pointer items-center justify-center rounded-full text-fg transition-colors duration-(--duration-fast) hover:bg-surface-hover active:bg-surface-sunken"
          >
            <Icon name="bell" />
            {unread > 0 && (
              <span
                aria-hidden="true"
                className="absolute top-1 right-0.5 h-5 min-w-5 rounded-full bg-primary px-[5px] text-center text-[12px] leading-5 font-bold text-on-primary tabular-nums shadow-[0_0_0_2px_var(--color-canvas)]"
              >
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
        )}
      </div>
    </header>
  )
}
