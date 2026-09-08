/**
 * What Chrome fires when it is willing to install this app, and would
 * otherwise show its own prompt for. Calling `preventDefault()` on it hands
 * the moment to us, to spend on a press of our own.
 *
 * Not in the DOM types: no browser but Chrome and its relatives implement it.
 */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * Whether the app was opened from the home screen rather than in a browser tab.
 *
 * An app already installed has no use for instructions on installing it (#69).
 * The sync settings used to read this too, to warn that Google's popup might
 * not come back from a Custom Tab; #104 replaced the popup with a navigation,
 * and the warning went with it.
 */
export function isRunningInstalled(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    // Safari on iOS predates `display-mode` and reports it here instead.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/**
 * Whether this is a browser that will never fire the install event, and so has
 * to be told the steps in words.
 *
 * iOS has no install prompt at all: every browser there is Safari's engine,
 * and adding to the home screen is done from the share sheet by hand.
 */
export function needsManualInstallSteps(userAgent: string): boolean {
  return /iPhone|iPad|iPod/.test(userAgent)
}

const INSTALLED_QUERIES = [
  '(display-mode: standalone)',
  '(display-mode: fullscreen)',
  '(display-mode: minimal-ui)',
]

/**
 * Calls back whenever the answer to `isRunningInstalled()` could have changed:
 * the display mode switched, or the browser finished installing the app.
 *
 * Shaped for `useSyncExternalStore`, which is how a component reads a value
 * that lives outside React without setting state from an effect.
 */
export function subscribeToInstalled(onChange: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }
  const queries = INSTALLED_QUERIES.map((query) => window.matchMedia(query))
  for (const query of queries) {
    query.addEventListener('change', onChange)
  }
  window.addEventListener('appinstalled', onChange)
  return () => {
    for (const query of queries) {
      query.removeEventListener('change', onChange)
    }
    window.removeEventListener('appinstalled', onChange)
  }
}

/** For a value that is read once and never changes, such as the user agent. */
export function subscribeToNothing(): () => void {
  return () => {}
}
