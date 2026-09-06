'use client'

import { useTheme } from 'next-themes'
import { useContext, useEffect, useRef } from 'react'
import { LocalizationContext } from '@/components/localization-context'
import { commands } from '@/lib/commands'
import { subscribeToPreferencesChanged } from '@/lib/services/preferences-changed'
import { normalizeThemeValue } from '@/lib/theme'

/**
 * Puts a synced theme and language on screen the moment they arrive.
 *
 * These two are not held by any one screen: `next-themes` reads the theme once
 * at startup, and the language lives in a context read the same way. A sync
 * writing either of them to local storage therefore changed nothing anybody
 * could see until the next reload -- the sync had worked and the app looked
 * exactly as if it had not.
 *
 * The rest of the settings are read where they are used, and re-read the same
 * way through `subscribeToPreferencesChanged`.
 */
export function usePulledPreferences(): void {
  const { setTheme } = useTheme()
  const { setLanguage } = useContext(LocalizationContext)

  // Both are rebuilt whenever their provider renders, so depending on them
  // directly would tear this subscription down and rebuild it constantly.
  const apply = useRef({ setTheme, setLanguage })
  useEffect(() => {
    apply.current = { setTheme, setLanguage }
  })

  useEffect(
    () =>
      subscribeToPreferencesChanged(() => {
        void commands.getTheme().then((result) => {
          if (result.status === 'ok') {
            apply.current.setTheme(normalizeThemeValue(result.data))
          }
        })
        void commands.getLanguage().then((result) => {
          if (result.status === 'ok') {
            apply.current.setLanguage(result.data)
          }
        })
      }),
    [],
  )
}
