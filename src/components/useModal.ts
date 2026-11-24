import { useEffect, useRef, type RefObject } from 'react'

/**
 * Shared modal behaviour (sheets and dialogs, rendered in a portal outside #root): the app behind
 * is inert, Escape anywhere closes, focus moves into `focusRef` and returns to the trigger.
 */
export function useModal(onClose: () => void, focusRef: RefObject<HTMLElement | null>) {
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null
    const root = document.getElementById('root')
    if (root) root.inert = true
    focusRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current()
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (root) root.inert = false
      trigger?.focus?.()
    }
  }, [focusRef])
}
