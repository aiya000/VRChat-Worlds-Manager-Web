/**
 * Which terms of use the person signing in agreed to.
 *
 * Agreement is given by signing in: the login screen says so, with the terms
 * one tap away, above the button that does it. That is the form standard
 * terms take under Japanese law (Civil Code art. 548-2) -- shown before the
 * act, no checkbox needed -- and it is also the moment the risk the terms
 * are about begins, since nothing talks to VRChat before it.
 *
 * The version agreed to is kept on the device so that a later revision can
 * be told from the one that was accepted, and asked about once if it ever
 * has to be.
 */

/** Keep in step with `terms:last-updated` in the locales. */
export const TERMS_VERSION = '2026-09-12'

const ACCEPTED_KEY = 'termsAcceptedVersion'

export function rememberTermsAccepted(): void {
  if (typeof window === 'undefined') {
    return
  }
  localStorage.setItem(ACCEPTED_KEY, TERMS_VERSION)
}

/** The version the device agreed to, or `null` if it never signed in. */
export function acceptedTermsVersion(): string | null {
  if (typeof window === 'undefined') {
    return null
  }
  return localStorage.getItem(ACCEPTED_KEY)
}
