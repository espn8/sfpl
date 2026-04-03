import { useTheme, type ThemeMode } from '../../app/providers/ThemeProvider'

const THEME_OPTIONS: Array<{ label: string; value: ThemeMode }> = [
  { label: 'Dark', value: 'dark' },
  { label: 'Light', value: 'light' },
  { label: 'System', value: 'system' },
]

export function ThemeModeToggle() {
  const { mode, resolvedTheme, setMode } = useTheme()

  return (
    <div className="inline-flex items-center gap-2">
      <label className="text-sm font-medium text-(--color-text-muted)" htmlFor="theme-mode-select">
        Theme
      </label>
      <select
        id="theme-mode-select"
        className="rounded-md border border-(--color-border) bg-(--color-surface) px-2 py-1 text-sm text-(--color-text) hover:bg-(--color-surface-muted) focus-visible:ring-2 focus-visible:ring-(--color-primary) focus-visible:outline-none"
        value={mode}
        onChange={(event) => setMode(event.currentTarget.value as ThemeMode)}
      >
        {THEME_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span className="text-xs text-(--color-text-muted)">Active: {resolvedTheme}</span>
    </div>
  )
}
