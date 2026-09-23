'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import type { FC, ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LanguageToggle } from '@/components/language-toggle'
import { ContactLinks } from '@/components/contact-links'
import { useBackHref } from '@/components/legal-page'
import { VrProjectionNotice } from '@/components/vr-projection-notice'
import { useLocalization } from '@/hooks/use-localization'

const APP_URL = 'https://vrcww.com'

const Section: FC<{ title: string; children: ReactNode }> = ({
  title,
  children,
}) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-lg">{title}</CardTitle>
    </CardHeader>
    <CardContent className="space-y-3 text-base leading-relaxed">
      {children}
    </CardContent>
  </Card>
)

/**
 * The first-time guide for someone who has not opened the app yet (#162).
 *
 * The PDF handed out on BOOTH carries only the outline and a link here, so
 * this is the page that has to stay true: install steps and button names
 * change with the browsers, and a PDF already downloaded cannot be corrected.
 *
 * Readable without signing in or finishing the setup, and outside the app's
 * sidebar, because its reader is on the way in. `/listview/guide` is the
 * in-app counterpart, which knows the device it runs on and links here for
 * the steps of every other one.
 *
 * Every step is shown to every reader rather than only the one matching the
 * browser: the guide is also read on a PC by someone about to set up a phone.
 */
export default function PublicGuidePage() {
  const { t } = useLocalization()
  const backHref = useBackHref()

  return (
    <div className="min-h-svh">
      <div className="container mx-auto max-w-3xl space-y-6 p-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild className="-ml-2 gap-2">
            <Link href={backHref}>
              <ArrowLeft className="h-4 w-4" />
              {t('public-guide:back')}
            </Link>
          </Button>
          <LanguageToggle />
        </div>

        <div className="space-y-4">
          <h1 className="text-2xl font-semibold">{t('public-guide:title')}</h1>
          <p className="text-base leading-relaxed">{t('public-guide:intro')}</p>
        </div>

        {/* Stated before any step that mentions signing in. A credential
            prompt on a domain that is not VRChat's is what Chrome's phishing
            model reacted to on `/login`, and a reader deserves to know the
            same thing that page now says first. */}
        <div
          className="rounded-md border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/50"
          data-testid="public-guide-unofficial"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" />
            <div className="space-y-1">
              <p className="font-medium text-amber-800 dark:text-amber-300">
                {t('public-guide:unofficial-title')}
              </p>
              <p className="text-sm leading-relaxed text-amber-700 dark:text-amber-400">
                {t('public-guide:unofficial-body')}
              </p>
            </div>
          </div>
        </div>

        <Section title={`1. ${t('public-guide:open-title')}`}>
          <p>{t('public-guide:open-body')}</p>
          <p className="text-2xl font-semibold break-all">
            <a href={APP_URL} className="underline underline-offset-4">
              {APP_URL.replace('https://', '')}
            </a>
          </p>
          <Button asChild size="lg">
            <Link href="/start">{t('home:open-app')}</Link>
          </Button>
        </Section>

        <Section title={`2. ${t('public-guide:install-title')}`}>
          <p>{t('public-guide:install-body')}</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>{t('public-guide:install-android')}</li>
            <li>{t('public-guide:install-ios')}</li>
            <li>{t('public-guide:install-desktop')}</li>
          </ul>
        </Section>

        <Section title={`3. ${t('public-guide:login-title')}`}>
          <p>{t('public-guide:login-body')}</p>
          <p>
            {t('public-guide:login-migration')}{' '}
            <Link
              href="/migration-guide/v2"
              className="underline underline-offset-2"
            >
              {t('migration-guide:link-label')}
            </Link>
          </p>
        </Section>

        <Section title={t('public-guide:credentials-title')}>
          <p>{t('public-guide:credentials-body')}</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>{t('public-guide:credentials-item-relay')}</li>
            <li>{t('public-guide:credentials-item-no-store')}</li>
          </ul>
          <p>
            {t('public-guide:credentials-privacy')}{' '}
            <Link
              href="/privacy?back=%2Fguide"
              className="underline underline-offset-2"
            >
              {t('privacy-policy:link-label')}
            </Link>
          </p>
        </Section>

        <Section title={t('guide-page:vr-usage-title')}>
          <VrProjectionNotice />
        </Section>

        <Section title={t('public-guide:data-title')}>
          <p>{t('public-guide:data-body')}</p>
        </Section>

        <Section title={t('public-guide:help-title')}>
          <p>{t('public-guide:help-body')}</p>
          <p className="flex flex-wrap items-center gap-2">
            <ContactLinks />
          </p>
        </Section>
      </div>

      <footer className="flex justify-center gap-4 pb-6 text-center">
        <Link
          href="/terms?back=%2Fguide"
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          {t('terms:link-label')}
        </Link>
        <Link
          href="/privacy?back=%2Fguide"
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          {t('privacy-policy:link-label')}
        </Link>
      </footer>
    </div>
  )
}
