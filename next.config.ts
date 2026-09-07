import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',
  // `output: 'export'` has no server to resize images on request, and Next
  // refuses to build with the default loader because of it. The images here
  // are already the size they are drawn at, so there is nothing to optimize.
  images: { unoptimized: true },
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
