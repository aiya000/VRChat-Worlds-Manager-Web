'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { useLocalization } from '@/hooks/use-localization'
import { VrProjectionNotice } from '@/components/vr-projection-notice'
import { PwaInstallNotice } from '@/components/pwa-install-notice'
import { Button } from '@/components/ui/button'
import { CONTACT_PAGE_PATH } from '@/components/contact-links'
import { MessageSquareWarning } from 'lucide-react'
import Link from 'next/link'

/**
 * How to keep this app, and how to use it in a headset.
 *
 * Both used to sit on the About page, above the credits. That page follows
 * the original's, which is credits and nothing else, and two cards of
 * instructions above "who made this" read as neither. So they have a page of
 * their own, and About is left to the people.
 */
export default function GuidePage() {
  const { t } = useLocalization()

  return (
    <div className="min-h-svh flex flex-col overflow-x-hidden">
      <div className="flex-1 container mx-auto p-6 space-y-6">
        {/* Pinned so the sidebar stays reachable once the page scrolls. */}
        <div className="sticky top-0 z-20 -mx-6 bg-background px-6 py-2">
          <SidebarTrigger className="h-10 w-10 shrink-0" />
        </div>

        {/* Kept to one place, and to no banner: an offer to install that
            interrupts is the kind nobody reads. It draws its own card, so
            that a reader who installed the app already sees nothing here --
            not a title over an empty card. */}
        <PwaInstallNotice />

        {/* This app is meant to be read in a headset, and how it is opened
            there decides whether Google will sign anyone in at all. Kept here
            as well as beside the connect button, so it is somewhere permanent
            rather than only where it is needed. */}
        <Card>
          <CardHeader>
            <CardTitle>{t('guide-page:vr-usage-title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <VrProjectionNotice />
          </CardContent>
        </Card>
      </div>

      {/* Where a reader ends up when the guide did not answer them. Drawn as
          quietly as the About footer, because it is a way out rather than the
          point of the page. */}
      <div className="w-full border-t bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-2 flex flex-wrap justify-end items-center gap-y-1">
          <Button variant="ghost" size="sm" asChild>
            <Link href={CONTACT_PAGE_PATH} className="flex flex-row gap-2">
              <MessageSquareWarning className="h-4 w-4" />
              {t('about-section:report-issue')}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
