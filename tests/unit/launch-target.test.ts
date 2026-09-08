import { describe, expect, it } from 'vitest'

import { isAndroidBrowser, launchTargetFor } from '@/lib/launch-target'

const WORLD = 'wrld_1234'
const INSTANCE = '12345~region(jp)'

const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36'
const DESKTOP_CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
// Quest's browser is Android underneath, and VRChat there is the Android app.
const QUEST_BROWSER =
  'Mozilla/5.0 (X11; Linux x86_64; Quest 3) AppleWebKit/537.36 (KHTML, like Gecko) OculusBrowser/34.0 Chrome/128.0.0.0 VR Safari/537.36'

describe('telling an Android browser apart', () => {
  it('sees a phone', () => {
    expect(isAndroidBrowser(ANDROID_CHROME)).toBe(true)
  })

  it('does not see a desktop', () => {
    expect(isAndroidBrowser(DESKTOP_CHROME)).toBe(false)
  })

  it('does not take a Quest for a phone on its word alone', () => {
    // The Quest browser does not say "Android", so it goes the desktop way.
    // That is the safe side: a `vrchat://` link is what worked there before.
    expect(isAndroidBrowser(QUEST_BROWSER)).toBe(false)
  })
})

describe('where "open in VRChat" goes', () => {
  it('opens the desktop client anywhere that is not Android', () => {
    expect(
      launchTargetFor({
        worldId: WORLD,
        instanceId: INSTANCE,
        userAgent: DESKTOP_CHROME,
        platforms: ['standalonewindows'],
      }),
    ).toEqual({
      kind: 'client',
      url: 'vrchat://launch?ref=vrchat.com&id=wrld_1234:12345~region(jp)',
    })
  })

  it('carries no URL on Android, where no link opens the app', () => {
    // An intent naming the package reached the Play Store page (#150), and
    // one without it did nothing; the self-invite is the only way in.
    expect(
      launchTargetFor({
        worldId: WORLD,
        instanceId: INSTANCE,
        userAgent: ANDROID_CHROME,
        platforms: ['standalonewindows', 'android'],
      }),
    ).toEqual({ kind: 'android-app' })
  })

  it('says so on an Android phone when the world has no Android build', () => {
    expect(
      launchTargetFor({
        worldId: WORLD,
        instanceId: INSTANCE,
        userAgent: ANDROID_CHROME,
        platforms: ['standalonewindows'],
      }),
    ).toEqual({ kind: 'not-on-android' })
  })

  it('tries the app when nobody knows what the world was built for', () => {
    expect(
      launchTargetFor({
        worldId: WORLD,
        instanceId: INSTANCE,
        userAgent: ANDROID_CHROME,
        platforms: null,
      }).kind,
    ).toBe('android-app')
  })

  it('does not let the Android rule touch a desktop', () => {
    expect(
      launchTargetFor({
        worldId: WORLD,
        instanceId: INSTANCE,
        userAgent: DESKTOP_CHROME,
        platforms: ['android'],
      }).kind,
    ).toBe('client')
  })
})
