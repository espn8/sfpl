import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

const THEME_STORAGE_KEY = 'promptlibrary.theme.mode'
const MEDIA_QUERY = '(prefers-color-scheme: dark)'

export type ThemeMode = 'dark' | 'light' | 'system'
type ResolvedTheme = 'dark' | 'light'

type ThemeContextValue = {
  mode: ThemeMode
  resolvedTheme: ResolvedTheme
  setMode: (mode: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

function getStoredThemeMode(): ThemeMode | null {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
  if (stored === 'dark' || stored === 'light' || stored === 'system') {
    return stored
  }
  return null
}

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia(MEDIA_QUERY).matches ? 'dark' : 'light'
}

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'system') {
    return getSystemTheme()
  }
  return mode
}

function applyResolvedTheme(theme: ResolvedTheme): void {
  const root = document.documentElement
  root.setAttribute('data-theme', theme)
  root.style.colorScheme = theme
}

export function initializeThemeOnBoot(): void {
  const mode = getStoredThemeMode() ?? 'dark'
  applyResolvedTheme(resolveTheme(mode))
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => getStoredThemeMode() ?? 'dark')
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(mode))

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode)
    const nextResolvedTheme = resolveTheme(mode)
    setResolvedTheme(nextResolvedTheme)
    applyResolvedTheme(nextResolvedTheme)
  }, [mode])

  useEffect(() => {
    if (mode !== 'system') {
      return undefined
    }

    const mediaQuery = window.matchMedia(MEDIA_QUERY)
    const onThemeChange = () => {
      const nextResolvedTheme = getSystemTheme()
      setResolvedTheme(nextResolvedTheme)
      applyResolvedTheme(nextResolvedTheme)
    }

    mediaQuery.addEventListener('change', onThemeChange)
    return () => mediaQuery.removeEventListener('change', onThemeChange)
  }, [mode])

  const setMode = useCallback((nextMode: ThemeMode) => {
    setModeState(nextMode)
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      resolvedTheme,
      setMode,
    }),
    [mode, resolvedTheme, setMode],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}
