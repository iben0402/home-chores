import { useRef, useState } from 'react'
import { authErrorMessage, errorCode, type AuthErrorField } from '../../data/auth'

export type FieldErrors = Partial<Record<AuthErrorField, string>>

/**
 * Runs one auth request at a time (repeat submits while busy are ignored) and turns
 * Firebase errors into copy-sheet messages keyed by field.
 */
export function useSubmit() {
  const [busy, setBusy] = useState<false | 'form' | 'google'>(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const inFlight = useRef(false)

  async function run(kind: 'form' | 'google', request: () => Promise<void>): Promise<boolean> {
    if (inFlight.current) return false
    inFlight.current = true
    setBusy(kind)
    setErrors({})
    try {
      await request()
      return true
    } catch (error) {
      const { field, message } = authErrorMessage(errorCode(error))
      setErrors({ [field]: message })
      return false
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  return { busy, errors, setErrors, run }
}
