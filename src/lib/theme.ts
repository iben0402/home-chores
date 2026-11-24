// Light / dark / follow the device. Per device (localStorage "theme"); the boot script in
// index.html applies it before first paint, this module keeps it applied afterwards.

export type ThemePref = 'system' | 'light' | 'dark'
const KEY = 'theme'

export function getThemePref(): ThemePref {
  try {
    const stored = localStorage.getItem(KEY)
    return stored === 'light' || stored === 'dark' ? stored : 'system'
  } catch {
    return 'system'
  }
}

function systemTheme(): 'light' | 'dark' {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(pref: ThemePref = getThemePref()): void {
  document.documentElement.dataset.theme = pref === 'system' ? systemTheme() : pref
}

export function setThemePref(pref: ThemePref): void {
  try {
    if (pref === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, pref)
  } catch {
    // Not remembered (private mode); still applied for this visit.
  }
  applyTheme(pref)
}

/** In "system" mode, follow the device when it switches between light and dark. */
export function followSystemTheme(): () => void {
  const media = window.matchMedia?.('(prefers-color-scheme: dark)')
  const onChange = () => getThemePref() === 'system' && applyTheme('system')
  media?.addEventListener?.('change', onChange)
  return () => media?.removeEventListener?.('change', onChange)
}
