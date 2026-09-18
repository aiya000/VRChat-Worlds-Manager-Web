import { describe, expect, it } from 'vitest'

import {
  DRIVE_SYNC_HOME,
  isDriveSyncUnavailableAt,
} from '@/lib/drive-sync-origin'

/**
 * `pages.dev` was taken off the OAuth client's authorised domains when brand
 * verification moved to `vrcww.com` (#107), so the app served there can do
 * everything but sync, and has to say so (#205).
 */
describe('where Google Drive sync works', () => {
  it('is not at either pages.dev address the app is still served from', () => {
    expect(
      isDriveSyncUnavailableAt('vrchat-worlds-manager-web.pages.dev'),
    ).toBe(true)
    expect(
      isDriveSyncUnavailableAt('develop.vrchat-worlds-manager-web.pages.dev'),
    ).toBe(true)
  })

  it("is at the app's own domain, production and develop alike", () => {
    expect(isDriveSyncUnavailableAt('vrcww.com')).toBe(false)
    expect(isDriveSyncUnavailableAt('develop.vrcww.com')).toBe(false)
  })

  it('is at localhost, which the OAuth client registers for development', () => {
    expect(isDriveSyncUnavailableAt('localhost')).toBe(false)
    expect(isDriveSyncUnavailableAt('127.0.0.1')).toBe(false)
  })

  it('does not mistake a lookalike for pages.dev', () => {
    expect(isDriveSyncUnavailableAt('pages.dev.example.com')).toBe(false)
    expect(isDriveSyncUnavailableAt('notpages.dev')).toBe(false)
  })

  it('sends people to the launch screen, not the landing page', () => {
    // `/` is the brand-verification landing page and stays put; `/start` is
    // what decides between the first-run setup and the list.
    expect(DRIVE_SYNC_HOME).toBe('https://vrcww.com/start')
  })
})
