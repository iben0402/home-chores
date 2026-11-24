import { Link } from 'react-router'
import { Icon } from './Icon'

/** The floating "+ New chore", above the tab bar (lifted while a snackbar shows). */
export function Fab({ to, label = 'New chore', lifted }: { to: string; label?: string; lifted?: boolean }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--size-tabbar)+1rem+env(safe-area-inset-bottom))] z-(--z-fab) flex justify-center">
      <div className="flex w-full max-w-(--size-content) justify-end px-4">
        <Link
          to={to}
          className={`pointer-events-auto inline-flex h-(--size-fab) items-center justify-center gap-2 rounded-full bg-primary pr-5 pl-4 text-[16px] font-semibold text-on-primary no-underline shadow-md transition-transform duration-(--duration-base) ease-standard hover:bg-primary-hover active:scale-[0.96] ${lifted ? '-translate-y-[60px]' : ''}`}
        >
          <Icon name="plus" size={24} />
          {label}
        </Link>
      </div>
    </div>
  )
}
