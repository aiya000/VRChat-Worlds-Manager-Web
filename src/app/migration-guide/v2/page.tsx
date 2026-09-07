'use client'

import Image from 'next/image'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import type { FC, ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useLocalization } from '@/hooks/use-localization'

const Step: FC<{ number: number; title: string; children: ReactNode }> = ({
  number,
  title,
  children,
}) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-lg">
        {number}. {title}
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-4 text-base leading-relaxed">
      {children}
    </CardContent>
  </Card>
)

/**
 * The screenshots are of the desktop app, in Japanese, and are shown as they
 * are in every language: the point is to recognise the screen, not to read it.
 * The sizes are only the aspect ratio -- the image takes the column's width.
 */
const Screenshot: FC<{ src: string; alt: string }> = ({ src, alt }) => (
  <Image
    src={src}
    alt={alt}
    width={1200}
    height={750}
    className="h-auto w-full rounded-md border"
  />
)

export default function MigrationGuideV2Page() {
  const { t } = useLocalization()

  return (
    <div className="min-h-svh">
      <div className="container mx-auto max-w-3xl space-y-6 p-6">
        <div className="space-y-4">
          <Button variant="ghost" size="sm" asChild className="-ml-2 gap-2">
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              {t('migration-guide:back')}
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">
            {t('migration-guide:title')}
          </h1>
          <p className="text-base leading-relaxed">
            {t('migration-guide:intro')}
          </p>
        </div>

        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/50">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" />
            <div className="space-y-1">
              <p className="font-medium text-amber-800 dark:text-amber-300">
                {t('migration-guide:caution-title')}
              </p>
              <p className="text-sm leading-relaxed text-amber-700 dark:text-amber-400">
                {t('migration-guide:caution-body')}
              </p>
            </div>
          </div>
        </div>

        <Step number={1} title={t('migration-guide:step1-title')}>
          <p>{t('migration-guide:step1-body')}</p>
          <Screenshot
            src="/migration-guide/v2/1-create-backup.png"
            alt={t('migration-guide:step1-alt')}
          />
        </Step>

        <Step number={2} title={t('migration-guide:step2-title')}>
          <p>{t('migration-guide:step2-body')}</p>
          <Screenshot
            src="/migration-guide/v2/2-downloads-folder.png"
            alt={t('migration-guide:step2-alt')}
          />
        </Step>

        <Step number={3} title={t('migration-guide:step3-title')}>
          <p>{t('migration-guide:step3-body')}</p>
          <Screenshot
            src="/migration-guide/v2/3-folder-contents.png"
            alt={t('migration-guide:step3-alt')}
          />
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <code>worlds.json</code> → {t('general:worlds-data')}
            </li>
            <li>
              <code>folders.json</code> → {t('general:folders-data')}
            </li>
          </ul>
          <p className="text-sm text-muted-foreground">
            {t('migration-guide:step3-info')}
          </p>
        </Step>

        <Step number={4} title={t('migration-guide:step4-title')}>
          <p>{t('migration-guide:step4-body')}</p>
          <p>{t('migration-guide:step4-setup')}</p>
        </Step>
      </div>
    </div>
  )
}
