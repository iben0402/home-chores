import { Icon } from './Icon'

/** Top bar: which household you're in (tap to switch). The bell arrives with notifications. */
export function AppHeader({ household, onSwitch }: { household: string; onSwitch?: () => void }) {
  return (
    <header className="sticky top-0 z-(--z-header) h-(--size-header) shrink-0 bg-canvas">
      <div className="mx-auto flex h-full w-full max-w-(--size-content) items-center px-2">
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
      </div>
    </header>
  )
}
