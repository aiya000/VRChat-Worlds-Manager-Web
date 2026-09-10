import { describe, expect, it } from 'vitest'

import {
  matchesPlatformFilters,
  narrowestSearchPlatform,
} from '@/lib/platform-filter'

const PC_ONLY = ['standalonewindows'] as const
const PC_AND_ANDROID = ['standalonewindows', 'android'] as const
const EVERYTHING = ['standalonewindows', 'android', 'ios'] as const

describe('matching a world against the platform checkboxes', () => {
  it('lets everything through when nothing is checked', () => {
    expect(matchesPlatformFilters([...PC_ONLY], [])).toBe(true)
    expect(matchesPlatformFilters([], [])).toBe(true)
    expect(matchesPlatformFilters(['unknownplatform'], [])).toBe(true)
  })

  it('asks whether the world supports the checked platform', () => {
    expect(matchesPlatformFilters([...PC_AND_ANDROID], ['android'])).toBe(true)
    expect(matchesPlatformFilters([...PC_ONLY], ['android'])).toBe(false)
  })

  it('wants all of them when several are checked, not any of them', () => {
    expect(
      matchesPlatformFilters(
        [...PC_AND_ANDROID],
        ['standalonewindows', 'android'],
      ),
    ).toBe(true)
    expect(
      matchesPlatformFilters([...PC_ONLY], ['standalonewindows', 'android']),
    ).toBe(false)
    expect(
      matchesPlatformFilters([...PC_AND_ANDROID], ['android', 'ios']),
    ).toBe(false)
    expect(matchesPlatformFilters([...EVERYTHING], ['android', 'ios'])).toBe(
      true,
    )
  })

  it('counts a world VRChat described in unknown terms as unknown', () => {
    expect(matchesPlatformFilters(['unknownplatform'], ['unknown'])).toBe(true)
    expect(matchesPlatformFilters([...PC_ONLY], ['unknown'])).toBe(false)
  })

  it('counts a world with no platforms at all as unknown', () => {
    expect(matchesPlatformFilters([], ['unknown'])).toBe(true)
  })

  it('still means AND when "unknown" is one of the boxes', () => {
    // A world can support PC and carry a package this app cannot name.
    expect(
      matchesPlatformFilters(
        ['standalonewindows', 'unknownplatform'],
        ['standalonewindows', 'unknown'],
      ),
    ).toBe(true)
    expect(
      matchesPlatformFilters([...PC_ONLY], ['standalonewindows', 'unknown']),
    ).toBe(false)
  })
})

describe('picking the one platform VRChat is asked about', () => {
  it('asks about nothing when nothing is checked', () => {
    expect(narrowestSearchPlatform([])).toBe(null)
  })

  it('asks about the only checked platform', () => {
    expect(narrowestSearchPlatform(['android'])).toBe('android')
    expect(narrowestSearchPlatform(['standalonewindows'])).toBe(
      'standalonewindows',
    )
  })

  it('asks about the narrowest one, so the page comes back least diluted', () => {
    expect(narrowestSearchPlatform(['standalonewindows', 'android'])).toBe(
      'android',
    )
    expect(narrowestSearchPlatform(['standalonewindows', 'ios'])).toBe('ios')
    expect(
      narrowestSearchPlatform(['standalonewindows', 'android', 'ios']),
    ).toBe('ios')
  })
})
