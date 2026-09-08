'use client'

import { useEffect } from 'react'
import { commands } from '@/lib/commands'
import { subscribeToPreferencesChanged } from '@/lib/services/preferences-changed'
import { applyUiScale } from '@/lib/ui-scale'

/**
 * Puts the stored scale on the document, at startup and whenever a sync or a
 * restore replaces it.
 *
 * The settings screen applies its own change directly, because a write from
 * the screen that shows a setting does not raise the preferences signal --
 * that signal is for the values this app did not choose itself.
 */
export function UiScaleEffect(): null {
  useEffect(() => {
    const readAndApply = () => {
      void commands.getUiScale().then((result) => {
        if (result.status === 'ok') {
          applyUiScale(result.data)
        }
      })
    }

    readAndApply()
    return subscribeToPreferencesChanged(readAndApply)
  }, [])

  return null
}
