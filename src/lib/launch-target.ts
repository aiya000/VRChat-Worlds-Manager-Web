import { launchUrlFor } from '@/lib/sync/launched-instances'
import type { Platform } from '@/lib/types'

/**
 * The Play Store build of VRChat. `https://vrchat.com/.well-known/assetlinks.json`
 * names it as an app that handles `vrchat.com` links on Android.
 */
export const VRCHAT_ANDROID_PACKAGE = 'com.vrchat.mobile.playstore'

export function isAndroidBrowser(userAgent: string): boolean {
  return /\bAndroid\b/.test(userAgent)
}

/**
 * An Android intent URL that names the app outright and carries the same
 * `vrchat://launch` link the desktop client takes.
 *
 * Handing Chrome the plain `vrchat://` URL in a new tab is what used to
 * happen, and on a phone it left a blank tab: a custom scheme opened from a
 * tab that was itself just opened has no user gesture to launch anything
 * with. This is navigated to in place instead.
 *
 * There is deliberately no fallback URL. `https://vrchat.com/home/launch` was
 * tried as the link and as the fallback, and the app did not claim it -- its
 * universal-link declaration covers `/home/device` alone -- so the fallback
 * page opened, said the instance did not exist, and looked like the app had
 * answered. With no fallback, an app that does not take this scheme does
 * nothing visible, and the invite sent alongside is what gets the person in.
 */
export function androidLaunchUrlFor(
  worldId: string,
  instanceId: string,
): string {
  const data = launchUrlFor(worldId, instanceId).replace(/^vrchat:\/\//, '')
  return `intent://${data}#Intent;scheme=vrchat;package=${VRCHAT_ANDROID_PACKAGE};end`
}

export type LaunchTarget =
  /** The desktop client, through its own scheme, in a window of its own. */
  | { kind: 'client'; url: string }
  /** The Android app, by navigating this document to an intent URL. */
  | { kind: 'android-app'; url: string }
  /** Nothing to open: the world has no Android build to open it in. */
  | { kind: 'not-on-android' }

/**
 * What happened when the button was pressed, for the screen to report.
 *
 * On Android the app is asked two ways -- the intent, and an invite to the
 * person's own account, which the app shows as a notification whether or not
 * it took the intent -- so the outcome says whether the invite went.
 */
export type LaunchOutcome =
  | { kind: 'client' }
  | { kind: 'android-app'; invited: boolean }
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
