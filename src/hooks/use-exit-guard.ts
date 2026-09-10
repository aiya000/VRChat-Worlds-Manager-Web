'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { toast } from 'sonner'
import { useLocalization } from '@/hooks/use-localization'
import {
  armExitGuard,
  EXIT_GUARD_WINDOW_MS,
  isGuardEntry,
  wantsExitGuard,
} from '@/lib/exit-guard'
import { isRunningInstalled } from '@/lib/pwa'

/** The screen that only decides where the app starts, and replaces itself. */
const SPLASH_PATH = '/'

/**
 * Asks for the back gesture twice before the app is left, the way an Android
 * app does: the first press says what the next one will do, and only a press
 * that comes within the couple of seconds after it goes through.
 *
 * The app keeps one history entry of its own on top of the one it was opened
 * at. Back spends that entry rather than the app, and this is what notices --
 * a press deeper in the app pops an entry of the router's instead and is left
 * alone. Once the warning has been shown the guard is gone, so a second press
 * finds no history at all and the browser closes the app itself; if the couple
 * of seconds pass without one, the guard is put back and the next press starts
 * over.
 */
export function useExitGuard(): void {
  const { t } = useLocalization()
  const pathname = usePathname()

  // `t` is a new function on every render, and this listens for the life of
  // the page, so it is kept current from an effect rather than depended on.
  const tRef = useRef(t)
  useEffect(() => {
    tRef.current = t
  })

  const armed = useRef(false)

  // Not on the splash screen, which replaces itself with wherever the app
  // starts: an entry pushed there guards a page that is about to become
  // another one, and the user would see the splash again on the way out.
  useEffect(() => {
    if (armed.current || pathname === SPLASH_PATH) {
      return
    }
    const onGuardEntry = isGuardEntry(window.history.state)
    const wanted = wantsExitGuard({
      historyLength: window.history.length,
      onGuardEntry,
      installed: isRunningInstalled(),
      touch: navigator.maxTouchPoints > 0,
    })
    if (!wanted) {
      return
    }

    armed.current = true
    // A reload of the guard entry lands on one that is already in place.
    if (!onGuardEntry) {
      armExitGuard()
    }
  }, [pathname])

  useEffect(() => {
    let rearming: ReturnType<typeof setTimeout> | null = null

    const handlePopState = (event: PopStateEvent) => {
      // Landing on the guard is the app's own entry being shown again, not an
      // attempt to leave: the press came from somewhere deeper in the app.
      if (!armed.current || isGuardEntry(event.state) || rearming !== null) {
        return
      }

      toast(tRef.current('exit-guard:press-back-again'), {
        duration: EXIT_GUARD_WINDOW_MS,
      })
      rearming = setTimeout(() => {
        rearming = null
        armExitGuard()
      }, EXIT_GUARD_WINDOW_MS)
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
      if (rearming !== null) {
        clearTimeout(rearming)
      }
    }
  }, [])
}
