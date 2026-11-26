import { useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button'
import type { IconName } from './Icon'
import { useModal } from './useModal'

type ConfirmDialogProps = {
  title: string
  body: string
  confirmLabel: string
  confirmIcon?: IconName
  /** Destructive by default; primary for actions that aren't (e.g. Skip). */
  confirmVariant?: 'destructive' | 'primary'
  loading?: boolean
  /** Extra content between the body and the buttons (e.g. an optional field). */
  children?: ReactNode
  onConfirm: () => void
  onCancel: () => void
}

/** Modal confirmation for destructive actions. Cancel is focused first, so Enter never destroys. */
export function ConfirmDialog({ title, body, confirmLabel, confirmIcon = 'trash-2', confirmVariant = 'destructive', loading, onConfirm, onCancel, children }: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const bodyId = useId()
  useModal(onCancel, cancelRef)

  return createPortal(
    <div className="fixed inset-0 z-(--z-dialog) flex items-center justify-center">
      <div aria-hidden="true" onClick={onCancel} className="absolute inset-0 animate-[fade-in_var(--duration-base)_var(--ease-standard)] bg-scrim" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="relative w-[calc(100%-3rem)] max-w-[360px] animate-[fade-in_var(--duration-base)_var(--ease-decelerate)] rounded-lg bg-surface-raised px-5 pt-6 pb-4 shadow-lg"
      >
        <h2 id={titleId} className="m-0 mb-2 text-heading">
          {title}
        </h2>
        <p id={bodyId} className="m-0 text-body text-fg-muted">
          {body}
        </p>
        {children}
        <div className="mt-6 flex flex-wrap-reverse justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-(--size-touch) cursor-pointer items-center justify-center rounded-md border border-border-strong bg-surface px-4 text-[16px] leading-5 font-semibold text-fg hover:bg-surface-hover"
          >
            Cancel
          </button>
          <Button variant={confirmVariant} icon={confirmIcon} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
