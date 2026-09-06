import { describe, expect, it } from 'vitest'

import {
  androidLaunchUrlFor,
  isAndroidBrowser,
  launchTargetFor,
  VRCHAT_ANDROID_PACKAGE,
  webLaunchUrlFor,
} from '@/lib/launch-target'

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

describe('the launch page on the web', () => {
  it('is the one VRChat itself hands out when an instance is shared', () => {
    expect(webLaunchUrlFor(WORLD, '99')).toBe(
      'https://vrchat.com/home/launch?worldId=wrld_1234&instanceId=99',
    )
  })

  it('escapes what an instance id carries', () => {
    const url = new URL(webLaunchUrlFor(WORLD, INSTANCE))
    expect(url.searchParams.get('instanceId')).toBe(INSTANCE)
  })
})

describe('the Android intent URL', () => {
  const url = androidLaunchUrlFor(WORLD, INSTANCE)

  it('names the app rather than leaving the scheme to be resolved', () => {
    expect(url).toContain(`package=${VRCHAT_ANDROID_PACKAGE};`)
    expect(url).toMatch(/^intent:\/\/vrchat\.com\/home\/launch\?/)
    expect(url).toContain('#Intent;scheme=https;')
    expect(url).toMatch(/;end$/)
  })

  it('carries the same two ids as the web page', () => {
    const data = url.replace(/^intent:/, 'https:').split('#Intent')[0]
    expect(data).toBe(webLaunchUrlFor(WORLD, INSTANCE))
  })

  it('falls back to the web page when the app is not there', () => {
    const fallback = url.match(/S\.browser_fallback_url=([^;]+);/)?.[1]
    expect(fallback).toBeDefined()
    expect(decodeURIComponent(fallback!)).toBe(webLaunchUrlFor(WORLD, INSTANCE))
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

  it('hands an Android phone the app when the world has an Android build', () => {
    expect(
      launchTargetFor({
        worldId: WORLD,
        instanceId: INSTANCE,
        userAgent: ANDROID_CHROME,
        platforms: ['standalonewindows', 'android'],
      }),
    ).toEqual({
      kind: 'android-app',
      url: androidLaunchUrlFor(WORLD, INSTANCE),
    })
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
