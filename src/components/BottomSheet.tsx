import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { IconButton } from './IconButton'

/**
 * Modal sheet from the bottom. Rendered outside the app root, which is made inert while it's open
 * (so Tab and screen readers stay in the sheet). Escape, the scrim or Close dismiss it; focus
 * returns to whatever opened it. On desktop it sits in the centred content column.
 */
export function BottomSheet({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null
    const root = document.getElementById('root')
    if (root) root.inert = true
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current()
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (root) root.inert = false
      trigger?.focus?.()
    }
  }, [])

  return createPortal(
    <>
      <div aria-hidden="true" onClick={onClose} className="fixed inset-0 z-(--z-scrim) animate-[fade-in_var(--duration-base)_var(--ease-standard)] bg-scrim" />
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-(--z-sheet) flex justify-center">
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className="pointer-events-auto max-h-[88dvh] w-full max-w-(--size-content) animate-sheet-in overflow-auto rounded-t-xl bg-surface-raised pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-lg focus-visible:outline-none"
        >
          <div aria-hidden="true" className="mx-auto mb-1 h-1 w-9 rounded-full bg-border-strong" />
          <div className="flex items-start gap-2 pr-2 pb-3 pl-5">
            <div className="flex-1 pt-2.5">
              <h2 id={titleId} className="m-0 text-heading">
                {title}
              </h2>
              {subtitle && <p className="mt-0.5 mb-0 text-[14px] leading-5 text-fg-muted">{subtitle}</p>}
            </div>
            <IconButton icon="x" label="Close" onClick={onClose} />
          </div>
          {children}
        </div>
      </div>
    </>,
    document.body,
  )
}
