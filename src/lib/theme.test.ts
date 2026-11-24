import { applyTheme, getThemePref, setThemePref } from './theme'

function systemDark(dark: boolean) {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: dark, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
}

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
})
afterEach(() => vi.unstubAllGlobals())

test('defaults to system, which follows the device', () => {
  systemDark(true)
  expect(getThemePref()).toBe('system')
  applyTheme()
  expect(document.documentElement.dataset.theme).toBe('dark')
})

test('light or dark is remembered and applied', () => {
  systemDark(true)
  setThemePref('light')
  expect(localStorage.getItem('theme')).toBe('light')
  expect(document.documentElement.dataset.theme).toBe('light')
  setThemePref('system')
  expect(localStorage.getItem('theme')).toBeNull()
  expect(document.documentElement.dataset.theme).toBe('dark')
})

test('ignores unknown stored values', () => {
  systemDark(false)
  localStorage.setItem('theme', 'purple')
  expect(getThemePref()).toBe('system')
})
