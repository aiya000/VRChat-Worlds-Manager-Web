import { describe, expect, it } from 'vitest'

import {
  EXIT_GUARD_KEY,
  isGuardEntry,
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
  // length says nothing about whether back would leave. Guarding it anyway is
  // what #188 turned on: reading length there left the guard off entirely.
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

describe('telling the guard entry from what lies beyond it', () => {
  it('knows its own entry', () => {
    expect(isGuardEntry({ [EXIT_GUARD_KEY]: true })).toBe(true)
  })

  it('knows an entry of the router, and one with no state at all', () => {
    expect(isGuardEntry({ tree: ['', {}] })).toBe(false)
    expect(isGuardEntry(null)).toBe(false)
    expect(isGuardEntry(undefined)).toBe(false)
  })
})
