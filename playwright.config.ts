import { defineConfig, devices } from '@playwright/test'

// Not 3000: that port is commonly taken by something else on a dev machine,
// and `next dev` silently moves to the next free one when it is.
//
// The `dev` script in `package.json` pins the same port, and the two have to
// stay in step: an OAuth client registers one origin per port, so a dev server
// that quietly landed somewhere else fails to sign in for no visible reason.
const PORT = 3456
const baseURL = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `bunx next dev --turbopack --port ${PORT}`,
    // Cloudflare's "always passes, invisible" test key. With a key baked in,
    // a sign-in asks for a challenge token the way production does; the specs
    // that sign in answer the challenge with `stub-turnstile.ts`.
    env: { NEXT_PUBLIC_TURNSTILE_SITE_KEY: '1x00000000000000000000BB' },
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
