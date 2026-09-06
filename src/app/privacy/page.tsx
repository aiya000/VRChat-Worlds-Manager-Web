'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { FC, ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useLocalization } from '@/hooks/use-localization'

const Section: FC<{ title: string; children: ReactNode }> = ({
  title,
  children,
}) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-lg">{title}</CardTitle>
    </CardHeader>
    <CardContent className="space-y-3 text-sm leading-relaxed">
      {children}
    </CardContent>
  </Card>
)

const Bullets: FC<{ items: string[] }> = ({ items }) => (
  <ul className="list-disc space-y-2 pl-5">
    {items.map((item) => (
      <li key={item}>{item}</li>
    ))}
  </ul>
)

export default function PrivacyPolicyPage() {
  const { t } = useLocalization()

  return (
    <div className="min-h-svh">
      <div className="container mx-auto max-w-3xl space-y-6 p-6">
        <div className="space-y-4">
          <Button variant="ghost" size="sm" asChild className="-ml-2 gap-2">
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              {t('privacy-policy:back')}
            </Link>
          </Button>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">
              {t('privacy-policy:title')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('privacy-policy:last-updated')}
            </p>
          </div>
          <p className="text-sm leading-relaxed">{t('privacy-policy:intro')}</p>
        </div>

        <Section title={t('privacy-policy:local-data-title')}>
          <p>{t('privacy-policy:local-data-body')}</p>
          <Bullets
            items={[
              t('privacy-policy:local-data-item-worlds'),
              t('privacy-policy:local-data-item-settings'),
              t('privacy-policy:local-data-item-credentials'),
            ]}
          />
        </Section>

        <Section title={t('privacy-policy:vrchat-title')}>
          <p>{t('privacy-policy:vrchat-body')}</p>
          <Bullets
            items={[
              t('privacy-policy:vrchat-item-relay'),
              t('privacy-policy:vrchat-item-no-store'),
              t('privacy-policy:vrchat-item-ip'),
            ]}
          />
        </Section>

        <Section title={t('privacy-policy:google-drive-title')}>
          <p>{t('privacy-policy:google-drive-body')}</p>
          <Bullets
            items={[
              t('privacy-policy:google-drive-item-scope'),
              t('privacy-policy:google-drive-item-location'),
              t('privacy-policy:google-drive-item-token'),
              t('privacy-policy:google-drive-item-never'),
            ]}
          />
        </Section>

        <Section title={t('privacy-policy:analytics-title')}>
          <p>{t('privacy-policy:analytics-body')}</p>
        </Section>

        <Section title={t('privacy-policy:third-party-title')}>
          <p>{t('privacy-policy:third-party-body')}</p>
        </Section>

        <Section title={t('privacy-policy:deletion-title')}>
          <Bullets
            items={[
              t('privacy-policy:deletion-item-local'),
              t('privacy-policy:deletion-item-drive'),
            ]}
          />
          <p>
            {t('privacy-policy:deletion-item-revoke')}{' '}
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              https://myaccount.google.com/permissions
            </a>
          </p>
        </Section>

        <Section title={t('privacy-policy:contact-title')}>
          <p>{t('privacy-policy:contact-body')}</p>
          <p>
            <a
              href="https://github.com/aiya000/VRChat-Worlds-Manager-Web/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              https://github.com/aiya000/VRChat-Worlds-Manager-Web/issues
            </a>
          </p>
        </Section>
      </div>
    </div>
  )
}
