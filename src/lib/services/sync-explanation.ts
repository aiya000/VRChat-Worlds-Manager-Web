/**
 * Whether this device has already been told how syncing works.
 *
 * The explanation is shown once, before the first press, and then stays out
 * of the way; "show it again" lives on the settings screen.
 */
const EXPLAINED_KEY = 'syncExplained'

export function wasSyncExplained(): boolean {
  if (typeof window === 'undefined') {
    return true
  }
  return localStorage.getItem(EXPLAINED_KEY) === 'true'
}

export function rememberSyncExplained(): void {
  if (typeof window === 'undefined') {
    return
  }
  localStorage.setItem(EXPLAINED_KEY, 'true')
}
