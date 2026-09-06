import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',
  // `output: 'export'` has no server to resize images on request, and Next
  // refuses to build with the default loader because of it. The images here
  // are already the size they are drawn at, so there is nothing to optimize.
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version ?? 'unknown',
  },
}

export default nextConfig
