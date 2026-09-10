/**
 * A signal that this app's own backend turned a request away because a limit
 * was reached, rather than because anything the user did was wrong.
 *
 * The Worker has answered `429` with a reason for a long time, and nothing
 * here read it: every one of them arrived on screen as the same generic
 * error, so "wait a minute", "you have tried to sign in too often" and "the
 * app has spent today's allowance" were indistinguishable (#170).
 *
 * Deliberately free of any import, like the other signals in this directory,
 * so the service layer can raise it without reaching for a toast and the
 * view layer can listen without creating a cycle.
 */

/** Which limit was reached. The strings match what the Worker sends. */
export type BackendLimitKind =
  | 'rate-limit-exceeded'
  | 'sign-in-limit-exceeded'
  | 'daily-quota-exceeded'

const kinds: readonly BackendLimitKind[] = [
  'rate-limit-exceeded',
  'sign-in-limit-exceeded',
  'daily-quota-exceeded',
]

/**
 * Reads the Worker's reason out of a `429` body, or `null` when the body is
 * not one of ours.
 *
 * VRChat itself can answer `429`, and its body is not this shape. Saying
 * "the app has reached its limit" about VRChat's own rate limiting would be
 * a confident lie, so an unrecognised body is left alone.
 */
export function readBackendLimitKind(body: string): BackendLimitKind | null {
  try {
    const parsed: unknown = JSON.parse(body)
    if (typeof parsed !== 'object' || parsed === null) {
      return null
    }
    const error = (parsed as { error?: unknown }).error
    if (typeof error !== 'string') {
      return null
    }
    return kinds.find((kind) => kind === error) ?? null
  } catch {
    return null
  }
}

type Listener = (kind: BackendLimitKind) => void

const listeners = new Set<Listener>()

export function notifyBackendLimitReached(kind: BackendLimitKind): void {
  for (const listener of [...listeners]) {
    listener(kind)
  }
}

export function subscribeToBackendLimitReached(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
