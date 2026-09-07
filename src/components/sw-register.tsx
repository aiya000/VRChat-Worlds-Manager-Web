'use client'

import { useEffect } from 'react'

export function SwRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // The build is part of the script URL so that each deploy installs its
      // own worker with its own cache, and the previous one's precached shell
      // is thrown away rather than served forever. The release version is not
      // enough: `develop` ships many builds under one version.
      const build = process.env.NEXT_PUBLIC_BUILD_ID ?? 'unknown'
      navigator.serviceWorker
        // `updateViaCache: 'none'` so the browser fetches this script itself
        // rather than answering from its own HTTP cache. A worker that has
        // gone wrong is exactly the case where waiting up to a day to notice
        // a new one is the difference between a fix arriving and not.
        .register(`/sw.js?v=${encodeURIComponent(build)}`, {
          updateViaCache: 'none',
        })
        .then((reg) => {
          console.info(`Service Worker registered: ${reg.scope}`)
        })
        .catch((err) => {
          console.error(`Service Worker registration failed: ${err}`)
        })
    }
  }, [])

  return null
}
