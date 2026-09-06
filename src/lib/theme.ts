export type Theme = 'light' | 'dark' | 'system'

/**
 * The theme as `next-themes` wants it.
 *
 * `next-themes` owns the `theme` key in local storage and writes it bare,
 * while this app's own preference writer JSON-encodes everything it stores, so
 * the same theme can be on disk as either `dark` or `"dark"` -- see
 * `canonicalizeSettingValue`. Anything else falls back to following the system.
 */
export function normalizeThemeValue(theme: string): Theme {
  const unwrapped =
    theme.startsWith('"') && theme.endsWith('"') ? theme.slice(1, -1) : theme

  if (unwrapped === 'light' || unwrapped === 'dark' || unwrapped === 'system') {
    return unwrapped
  }

  return 'system'
}
