import { launchUrlFor } from '@/lib/sync/launched-instances'
import type { Platform } from '@/lib/types'

/**
 * The Play Store build of VRChat. `https://vrchat.com/.well-known/assetlinks.json`
 * names it as the app that handles `vrchat.com` links on Android, which is
 * what makes handing it a launch link worth trying.
 */
export const VRCHAT_ANDROID_PACKAGE = 'com.vrchat.mobile.playstore'

export function isAndroidBrowser(userAgent: string): boolean {
  return /\bAndroid\b/.test(userAgent)
}

/** The launch page on VRChat's own site: what its "share instance" produces. */
export function webLaunchUrlFor(worldId: string, instanceId: string): string {
  const params = new URLSearchParams({ worldId, instanceId })
  return `https://vrchat.com/home/launch?${params.toString()}`
}

/**
 * An Android intent URL that names the app outright.
 *
 * Handing Chrome the plain `vrchat://` URL in a new tab is what used to
 * happen, and on a phone it left a blank tab: a custom scheme opened from a
 * tab that was itself just opened has no user gesture to launch anything
 * with. This form is navigated to in place instead, and says which package
 * to open and where to go when it is not installed -- the same page on the
 * web -- so there is no blank tab either way.
 */
export function androidLaunchUrlFor(
  worldId: string,
  instanceId: string,
): string {
  const web = new URL(webLaunchUrlFor(worldId, instanceId))
  const fallback = encodeURIComponent(web.toString())
  return (
    `intent://${web.host}${web.pathname}${web.search}` +
    `#Intent;scheme=https;package=${VRCHAT_ANDROID_PACKAGE};` +
    `S.browser_fallback_url=${fallback};end`
  )
}

export type LaunchTarget =
  /** The desktop client, through its own scheme, in a window of its own. */
  | { kind: 'client'; url: string }
  /** The Android app, by navigating this document to an intent URL. */
  | { kind: 'android-app'; url: string }
  /** Nothing to open: the world has no Android build to open it in. */
  | { kind: 'not-on-android' }

/**
 * Where "open in VRChat" should go from this device.
 *
 * `platforms` is what VRChat says the world was built for, or `null` when
 * that is not known here -- a saved instance carries the two ids and nothing
 * else. Unknown is treated as possible: the app can say no itself, whereas a
 * button that refuses on a guess cannot be argued with.
 */
export function launchTargetFor(args: {
  worldId: string
  instanceId: string
  userAgent: string
  platforms: Platform[] | null
}): LaunchTarget {
  const { worldId, instanceId, userAgent, platforms } = args
  if (!isAndroidBrowser(userAgent)) {
    return { kind: 'client', url: launchUrlFor(worldId, instanceId) }
  }
  if (platforms !== null && !platforms.includes('android')) {
    return { kind: 'not-on-android' }
  }
  return { kind: 'android-app', url: androidLaunchUrlFor(worldId, instanceId) }
}
