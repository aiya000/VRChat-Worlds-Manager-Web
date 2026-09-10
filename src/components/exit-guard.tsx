'use client'

import { useExitGuard } from '@/hooks/use-exit-guard'

/**
 * Mounted at the root: the back gesture is there on every screen, and the one
 * it would leave from is whichever screen the app was opened at.
 */
export function ExitGuard(): null {
  useExitGuard()
  return null
}
