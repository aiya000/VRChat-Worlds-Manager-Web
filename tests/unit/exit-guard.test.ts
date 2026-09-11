import { describe, expect, it } from 'vitest'

import {
  EXIT_GUARD_KEY,
  EXIT_STOP_KEY,
  isGuardEntry,
  isStopEntry,
  wantsExitGuard,
  type ExitGuardSurroundings,
} from '@/lib/exit-guard'

const PHONE: ExitGuardSurroundings = {
  historyLength: 1,
  onGuardEntry: false,
  installed: false,
  touch: true,
}

const surroundings = (
  overrides: Partial<ExitGuardSurroundings>,
): ExitGuardSurroundings => ({ ...PHONE, ...overrides })

describe('deciding whether to stand in the way of the back gesture', () => {
  it('does on a phone with nothing behind the app', () => {
    expect(wantsExitGuard(PHONE)).toBe(true)
  })

  it('does on an installed app, whatever it is pointed at with', () => {
    expect(
      wantsExitGuard(surroundings({ touch: false, installed: true })),
    ).toBe(true)
  })

  // A PWA does not reliably launch with one entry behind it, so its history
  // length says nothing about whether back would leave.
  it('does on an installed app even with history behind it', () => {
    expect(
      wantsExitGuard(surroundings({ installed: true, historyLength: 3 })),
    ).toBe(true)
  })

  it('does not in a browser tab where back means the page before this one', () => {
    expect(wantsExitGuard(surroundings({ historyLength: 3 }))).toBe(false)
  })

  it('does after a reload of the guard entry, which is history of its own', () => {
    expect(
      wantsExitGuard(surroundings({ historyLength: 2, onGuardEntry: true })),
    ).toBe(true)
  })

  it('does not on a desktop browser, where back would do nothing to warn about', () => {
    expect(wantsExitGuard(surroundings({ touch: false }))).toBe(false)
  })
})

describe('telling the two marked entries from the rest', () => {
  it('knows the guard entry', () => {
    expect(isGuardEntry({ [EXIT_GUARD_KEY]: true })).toBe(true)
    expect(isStopEntry({ [EXIT_GUARD_KEY]: true })).toBe(false)
  })

  it('knows the entry below the guard', () => {
    expect(isStopEntry({ [EXIT_STOP_KEY]: true })).toBe(true)
    expect(isGuardEntry({ [EXIT_STOP_KEY]: true })).toBe(false)
  })

  it('knows an entry of the router, and one with no state at all', () => {
    expect(isGuardEntry({ tree: ['', {}] })).toBe(false)
    expect(isStopEntry({ tree: ['', {}] })).toBe(false)
    expect(isGuardEntry(null)).toBe(false)
    expect(isGuardEntry(undefined)).toBe(false)
    expect(isStopEntry(null)).toBe(false)
  })
})
