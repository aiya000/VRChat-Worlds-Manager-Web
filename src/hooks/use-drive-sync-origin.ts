import { useSyncExternalStore } from 'react'
import { isDriveSyncUnavailableAt } from '@/lib/drive-sync-origin'

/**
 * The hostname this page is served from, when Google Drive sync will not work
 * there; `null` when it will, and always `null` while prerendering.
 *
 * Read through `useSyncExternalStore` rather than in an effect: the static
 * export has no `window` at build time, and the answer has to agree between
 * the prerendered HTML and the first client render.
 */
export function useDriveSyncUnavailableHostname(): string | null {
  return useSyncExternalStore(
    subscribeToNothing,
    () =>
      isDriveSyncUnavailableAt(window.location.hostname)
        ? window.location.hostname
        : null,
    () => null,
  )
}

/** The hostname does not change while a page lives. */
function subscribeToNothing(): () => void {
  return () => {}
}
