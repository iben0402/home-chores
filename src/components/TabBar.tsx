import { NavLink } from 'react-router'
import { cx } from './cx'
import { Icon, type IconName } from './Icon'

const TABS: Array<{ path: string; label: string; icon: IconName }> = [
  { path: '', label: 'Today', icon: 'list-todo' },
  { path: '/rooms', label: 'Rooms', icon: 'door-open' },
  { path: '/history', label: 'History', icon: 'history' },
  { path: '/household', label: 'Household', icon: 'users-round' },
]

/** Bottom navigation: Today · Rooms · History · Household. */
export function TabBar({ hid }: { hid: string }) {
  return (
    <nav aria-label="Main" className="z-(--z-header) w-full shrink-0 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid h-(--size-tabbar) max-w-(--size-content) grid-cols-4">
      {TABS.map((tab) => (
        <NavLink
          key={tab.label}
          to={`/h/${hid}${tab.path}`}
          end={tab.path === ''}
          className={({ isActive }) =>
            cx(
              'group flex min-h-(--size-touch) flex-col items-center justify-center gap-0.5 text-[12px] leading-4 no-underline',
              isActive ? 'font-bold text-primary' : 'font-medium text-fg-muted',
            )
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={cx(
                  'flex h-7 w-14 items-center justify-center rounded-full transition-colors duration-(--duration-fast)',
                  isActive ? 'bg-primary-soft' : 'group-hover:bg-surface-hover',
                )}
              >
                <Icon name={tab.icon} size={22} />
              </span>
              {tab.label}
            </>
          )}
        </NavLink>
      ))}
      </div>
    </nav>
  )
}
