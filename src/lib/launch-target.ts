import { launchUrlFor } from '@/lib/sync/launched-instances'
import type { Platform } from '@/lib/types'

export function isAndroidBrowser(userAgent: string): boolean {
  return /\bAndroid\b/.test(userAgent)
}

export type LaunchTarget =
  /** The desktop client, through its own scheme, in a window of its own. */
  | { kind: 'client'; url: string }
  /** The Android app, through an invite to the person's own account. */
  | { kind: 'android-app' }
  /** Nothing to open: the world has no Android build to open it in. */
  | { kind: 'not-on-android' }

/**
 * What happened when the button was pressed, for the screen to report.
 *
 * On Android nothing is opened, so the invite is the whole of it and the
 * outcome says whether it went.
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
 *
 * Android carries no URL because no link opens the app into an instance. The
 * app declares three URL filters and none of them is `vrchat://` or a
 * `vrchat.com` launch path, so an intent naming the package sent Chrome to
 * the app's Play Store page instead (#150) and one without the package did
 * nothing visible. The self-invite, which the app shows as a notification, is
 * the only way in -- see the well-known files in `AGENTS.md`.
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
  return { kind: 'android-app' }
}
