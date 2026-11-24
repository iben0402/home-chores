// Per-device convenience: which household "/" opens. Storage may be unavailable (private mode).
const KEY = 'chours:lastHousehold'

export function getLastHousehold(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function setLastHousehold(hid: string): void {
  try {
    localStorage.setItem(KEY, hid)
  } catch {
    // Not remembering is fine.
  }
}
