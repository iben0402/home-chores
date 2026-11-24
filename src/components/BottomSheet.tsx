import { useEffect, useId, useRef, type ReactNode } from 'react'

/**
 * Modal sheet from the bottom: scrim, grabber, title. Takes focus on open, returns it on close,
 * closes on Escape or a tap on the scrim. On desktop it sits in the centred content column.
 */
export function BottomSheet({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null
    ref.current?.focus()
    return () => trigger?.focus?.()
  }, [])

  return (
    <>
      <div aria-hidden="true" onClick={onClose} className="fixed inset-0 z-(--z-scrim) animate-[fade-in_var(--duration-base)_var(--ease-standard)] bg-scrim" />
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-(--z-sheet) flex justify-center">
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          onKeyDown={(e) => e.key === 'Escape' && onClose()}
          className="pointer-events-auto max-h-[88dvh] w-full max-w-(--size-content) animate-sheet-in overflow-auto rounded-t-xl bg-surface-raised pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-lg focus-visible:outline-none"
        >
          <div aria-hidden="true" className="mx-auto mb-3 h-1 w-9 rounded-full bg-border-strong" />
          <div className="px-5 pb-3">
            <h2 id={titleId} className="m-0 text-heading">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 mb-0 text-[14px] leading-5 text-fg-muted">{subtitle}</p>}
          </div>
          {children}
        </div>
      </div>
    </>
  )
}
