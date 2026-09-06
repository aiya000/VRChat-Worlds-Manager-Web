'use client'

import React, { Suspense } from 'react'
import { AppSidebar } from './components/app-sidebar'
import { PopupManager } from './hook/usePopups/popup-manager'
import { PatreonProvider } from '@/contexts/patreon-context'
import { SidebarProvider } from '@/components/ui/sidebar'
import { useDriveAutoSync } from '@/hooks/use-drive-auto-sync'
import { usePulledPreferences } from '@/hooks/use-pulled-preferences'
import type { CSSProperties } from 'react'

// Central client shell so hooks like useSearchParams live fully inside a client boundary
export function ListViewClientShell({
  children,
}: {
  children: React.ReactNode
}) {
  // Here rather than in the root layout: this is the part of the app that owns
  // the data being synced. Setup runs outside it on purpose -- deciding where
  // this device's data should come from is exactly the moment not to have
  // something quietly merging Drive's copy into it.
  useDriveAutoSync()
  usePulledPreferences()

  return (
    <Suspense fallback={null}>
      <PatreonProvider>
        {/*
          The sidebar collapses away at every width, which is what a VR overlay
          panel and a phone both need -- neither can spare a fixed 250px column,
          and neither can operate the drag-to-resize handle this used to carry
          (a VR laser pointer cannot hit a 1px target, and touch never could).
        */}
        {/* Wide enough for the product name to stay on one line. */}
        <SidebarProvider
          style={{ '--sidebar-width': '17rem' } as CSSProperties}
        >
          <AppSidebar />
          {/* A div, not a `main`: the root layout already provides that
              landmark, and `main` may not be nested inside another one. */}
          <div
            data-testid="list-view-content"
            className="flex-1 min-w-0 h-svh overflow-y-auto no-webview-scroll-bar"
          >
            {children}
          </div>
          <PopupManager />
        </SidebarProvider>
      </PatreonProvider>
    </Suspense>
  )
}

export default ListViewClientShell
