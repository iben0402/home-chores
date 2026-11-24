import { Icon } from './Icon'

/** Brief confirmation with an optional Undo. Sits above the tab bar; announced politely. */
export function Snackbar({ message, actionLabel = 'Undo', onAction }: { message: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--size-tabbar)+0.75rem+env(safe-area-inset-bottom))] z-(--z-snackbar) flex justify-center px-3">
      <div role="status" className="pointer-events-auto flex min-h-12 w-full max-w-(--size-content) animate-snackbar-in items-center gap-3 rounded-md bg-surface-inverse py-1 pr-1 pl-4 text-[15px] leading-5 text-fg-inverse shadow-md">
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <Icon name="circle-check" />
          <span>{message}</span>
        </span>
        {onAction && (
          <button
            type="button"
            onClick={onAction}
            className="inline-flex min-h-(--size-touch) cursor-pointer items-center gap-1.5 rounded-sm px-3 text-[15px] font-bold text-inverse-action hover:bg-[rgba(127,127,127,0.18)]"
          >
            <Icon name="undo-2" size={18} />
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  )
}
