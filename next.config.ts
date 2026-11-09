import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',
  // `output: 'export'` has no server to resize images on request, and Next
  // refuses to build with the default loader because of it. The images here
  // are already the size they are drawn at, so there is nothing to optimize.
  images: { unoptimized: true },
  // Playwright reaches the dev server as `127.0.0.1`, which Next counts as
  // another origin than `localhost` and, since 16.4, refuses its dev resources
  // to: the page then never hydrates and every spec times out. The pages.dev
  // specs serve the dev server under that hostname, so it needs the same.
  allowedDevOrigins: ['127.0.0.1', 'vrchat-worlds-manager-web.pages.dev'],
  // Since 16.4, `next dev` appends its own block to AGENTS.md on every start
  // when it detects an agent. AGENTS.md keeps a hand-made copy of it instead
  // (the section "From Next.js"), without the markers `next dev` would strip.
  agentRules: false,
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version ?? 'unknown',
    // What the service worker names its cache after, which cannot be the
    // release version: `develop` deploys many times between releases, and a
    // name that stays the same across them leaves the shell precached by the
    // first deploy answering for every one after it. The commit is what
    // actually changes per deploy.
    NEXT_PUBLIC_BUILD_ID:
      process.env.GITHUB_SHA ?? process.env.npm_package_version ?? 'dev',
  },
}

export default nextConfig
