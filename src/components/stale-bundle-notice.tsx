'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useLocalization } from '@/hooks/use-localization'
import { APP_DB_NAME, APP_IDB_VERSION } from '@/lib/services/db'
import { discardCachedBundle } from '@/lib/stale-bundle'

/**
 * Reads the schema version already on disk without opening the database.
 *
 * Opening it would be the wrong tool twice over: at a version below the stored
 * one it throws, and with no version at all it would create an empty database
 * if none exists yet, racing whatever Dexie is about to do.
 */
async function storedDatabaseVersion(): Promise<number | null> {
  if (typeof indexedDB === 'undefined' || indexedDB.databases === undefined) {
    return null
  }

  try {
    const databases = await indexedDB.databases()
    const found = databases.find((entry) => entry.name === APP_DB_NAME)
    return found?.version ?? null
  } catch {
    return null
  }
}

/**
 * Shown when this bundle is older than the data it is looking at -- an offline
 * shell served from a stale cache, or a tab left open across a release that
 * changed the schema. Every query would fail with `VersionError`, which without
 * this reads as the app simply never finishing loading.
 */
export function StaleBundleNotice() {
  const { t } = useLocalization()
  const [isStale, setIsStale] = useState(false)

  useEffect(() => {
    let cancelled = false

    storedDatabaseVersion().then((version) => {
      if (!cancelled && version !== null && version > APP_IDB_VERSION) {
        setIsStale(true)
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  if (!isStale) {
    return null
  }

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      className="fixed inset-0 z-100 flex items-center justify-center bg-background p-6"
    >
      <div className="flex w-full max-w-md flex-col gap-4 rounded-lg border p-6">
        <h2 className="text-lg font-semibold">{t('stale-bundle:title')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('stale-bundle:description')}
        </p>
        <Button
          className="h-12 w-full text-base"
          onClick={async () => {
            // Not a plain reload: whatever served this bundle would serve it
            // again, and the button would be scenery.
            await discardCachedBundle()
            window.location.reload()
          }}
        >
          {t('stale-bundle:reload')}
        </Button>
      </div>
    </div>
  )
}
