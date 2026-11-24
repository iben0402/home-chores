import { useEffect, useRef, useState } from 'react'
import { authErrorMessage, errorCode, type AuthErrorField } from '../../data/auth'

export type FieldErrors = Partial<Record<AuthErrorField, string>>
type Kind = 'form' | 'google'

/**
 * Runs auth requests for one form and turns Firebase errors into copy-sheet messages by field.
 * - While the form request runs, repeat submits and Google are ignored.
 * - A form submit may replace a pending Google popup (Firebase takes ~10s to report a closed
 *   popup); the stale popup's late result is then ignored.
 * - After errors appear, focus moves to the first invalid field so it is announced.
 */
export function useSubmit() {
  const [busy, setBusy] = useState<false | Kind>(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const formRef = useRef<HTMLFormElement>(null)
  const current = useRef<{ id: number; kind: Kind } | null>(null)
  const lastId = useRef(0)

  useEffect(() => {
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  }, [errors])

  async function run(kind: Kind, request: () => Promise<void>): Promise<boolean> {
    const active = current.current
    if (active && (active.kind === 'form' || kind === 'google')) return false
    const id = ++lastId.current
    current.current = { id, kind }
    const isCurrent = () => current.current?.id === id
    setBusy(kind)
    setErrors({})
    try {
      await request()
      return isCurrent()
    } catch (error) {
      if (isCurrent()) {
        const { field, message } = authErrorMessage(errorCode(error))
        setErrors({ [field]: message })
      }
      return false
    } finally {
      if (isCurrent()) {
        current.current = null
        setBusy(false)
      }
    }
  }

  return { busy, errors, setErrors, run, formRef }
}
