/**
 * Cloudflare Turnstile, in front of the two requests that carry credentials.
 *
 * The Worker is what actually stands between the internet and VRChat's login,
 * and its `Origin` check stops nothing that is not a browser (#61). A
 * Turnstile token is proof that a real browser ran Cloudflare's challenge
 * moments ago, and the Worker turns a credential attempt away without one.
 *
 * Off unless a site key was baked in at build time: with none, nothing is
 * loaded and no header is sent, and the Worker without a secret asks for
 * none. That is what lets the dashboard steps and the code land in either
 * order.
 *
 * The widget is the invisible kind (chosen in the dashboard): nothing to see
 * and nothing to press, which matters where a VR controller is the pointer.
 */

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

const SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

/**
 * A challenge normally answers in well under a second. This is the bound on
 * the case where it never does -- the script blocked, or an interactive
 * challenge nobody is looking at.
 */
const CHALLENGE_TIMEOUT_MS = 30_000

/** Read by the Worker, and never forwarded to VRChat. */
export const TURNSTILE_TOKEN_HEADER = 'X-Turnstile-Token'

interface TurnstileApi {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string
      execution?: 'render' | 'execute'
      callback?: (token: string) => void
      'error-callback'?: (code?: string) => void
      'timeout-callback'?: () => void
      'expired-callback'?: () => void
    },
  ) => string
  execute: (widgetId: string) => void
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

/** The challenge could not be run, or was not passed. */
export class TurnstileError extends Error {}

export function isTurnstileEnabled(): boolean {
  return SITE_KEY !== undefined && SITE_KEY !== ''
}

let scriptLoadPromise: Promise<void> | null = null

function loadScript(): Promise<void> {
  if (window.turnstile !== undefined) {
    return Promise.resolve()
  }
  if (scriptLoadPromise === null) {
    scriptLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = SCRIPT_SRC
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => {
        scriptLoadPromise = null
        reject(new TurnstileError('The Turnstile script could not be loaded'))
      }
      document.head.appendChild(script)
    })
  }
  return scriptLoadPromise
}

/**
 * Runs one challenge and hands back its token.
 *
 * One widget per call, removed afterwards: a token is single-use and good for
 * five minutes, so there is nothing to keep, and a widget left behind would
 * only hold a token that has already been spent.
 */
export async function obtainTurnstileToken(): Promise<string> {
  if (SITE_KEY === undefined || SITE_KEY === '') {
    throw new TurnstileError('No Turnstile site key was configured')
  }
  await loadScript()
  const turnstile = window.turnstile
  if (turnstile === undefined) {
    throw new TurnstileError('The Turnstile script loaded without its API')
  }

  // Appended to the body rather than to the form: an invisible widget draws
  // nothing, and this keeps a rerender of the sign-in screen from unmounting
  // the challenge mid-way.
  const container = document.createElement('div')
  document.body.appendChild(container)

  return new Promise<string>((resolve, reject) => {
    let widgetId: string | null = null
    let settled = false
    const finish = (outcome: () => void) => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timer)
      if (widgetId !== null) {
        turnstile.remove(widgetId)
      }
      container.remove()
      outcome()
    }

    const timer = setTimeout(() => {
      finish(() =>
        reject(new TurnstileError('The Turnstile challenge did not answer')),
      )
    }, CHALLENGE_TIMEOUT_MS)

    widgetId = turnstile.render(container, {
      sitekey: SITE_KEY,
      execution: 'execute',
      callback: (token) => finish(() => resolve(token)),
      'error-callback': (code) =>
        finish(() =>
          reject(
            new TurnstileError(
              `The Turnstile challenge failed${code === undefined ? '' : ` (${code})`}`,
            ),
          ),
        ),
      'timeout-callback': () =>
        finish(() =>
          reject(new TurnstileError('The Turnstile challenge timed out')),
        ),
    })
    turnstile.execute(widgetId)
  })
}
