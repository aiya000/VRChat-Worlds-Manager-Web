'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useLocalization } from '@/hooks/use-localization'
import { Button } from '@/components/ui/button'
import { UserProfile } from '@/app/listview/about/components/user-profile'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

const ABOUT = '/listview/about'

export default function CreditsSection() {
  const { t } = useLocalization()

  return (
    <div className="min-h-svh flex flex-col overflow-x-hidden">
      <div className="flex-1 container mx-auto p-6 space-y-6">
        {/* A subpage, so the way out is back to its parent rather than to the
            sidebar: the sidebar is one more tap from there. */}
        <div className="sticky top-0 z-20 -mx-6 bg-background px-6 py-2">
          <Button variant="ghost" size="sm" asChild className="-ml-2 gap-2">
            <Link href={ABOUT}>
              <ArrowLeft className="h-4 w-4" />
              {t('about-section:back')}
            </Link>
          </Button>
        </div>

        <h1 className="text-2xl font-semibold">
          {t('about-section:credits-title')}
        </h1>

        {/* Web Version Header with aiya000 */}
        <Card>
          <CardHeader>
            <CardTitle>{t('about-section:web-version-title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {t('about-section:web-version-description')}
            </p>
            <UserProfile
              name="aiya000"
              iconUrl="/icons/aiya000.jpg"
              xUsername="public_ai000ya"
              githubUsername="aiya000"
            />
          </CardContent>
        </Card>

        {/* Original (VRC Worlds Manager v2) Section */}
        <Card>
          <CardHeader>
            <CardTitle>{t('about-section:original-title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Development Team */}
            <div>
              <h3 className="text-lg font-semibold mb-4">
                {t('about-section:development-team')}
              </h3>
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-4">
                    {t('about-section:developers')}
                  </h4>
                  <div className="space-x-4 flex flex-row">
                    <UserProfile
                      name="Raifa"
                      iconUrl="https://data.raifaworks.com/icons/raifa.jpg"
                      xUsername="raifa_trtr"
                      githubUsername="Raifa21"
                    />
                    <UserProfile
                      name="siloneco"
                      iconUrl="https://data.raifaworks.com/icons/siloneco.jpg"
                      xUsername="siloneco_vrc"
                      githubUsername="siloneco"
                    />
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-4">
                    {t('about-section:media-design')}
                  </h4>
                  <div className="space-x-4 flex flex-row">
                    <UserProfile
                      name="じゃんくま"
                      iconUrl="https://data.raifaworks.com/icons/jan_kuma.jpg"
                      xUsername="Jan_kumaVRC"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Special Thanks */}
            <div>
              <h3 className="text-lg font-semibold mb-4">
                {t('about-section:special-thanks')}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="flex items-start gap-3">
                  <div>
                    <span className="text-base font-semibold">
                      {t('about-section:vrchat')}
                    </span>
                    <div className="text-sm text-muted-foreground">
                      {t('about-section:vrchat-description')}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div>
                    <span className="text-base font-semibold">
                      {t('about-section:api-community')}
                    </span>
                    <div className="text-sm text-muted-foreground">
                      {t('about-section:api-community-description')}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div>
                    <span className="text-base font-semibold">黒音キト</span>
                    <div className="text-sm text-muted-foreground">
                      {t('about-section:icons-credit')}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div>
                    <span className="text-base font-semibold">
                      {t('about-section:armoirelepus')}
                    </span>
                    <div className="text-sm text-muted-foreground">
                      {t('about-section:armoirelepus-description')}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div>
                    <span className="text-base font-semibold">
                      {t('about-section:beta-testers')}
                    </span>
                    <div className="text-sm text-muted-foreground">
                      {t('about-section:beta-testers-description')}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* The fork this app grew out of, said where the people it thanks are
          named rather than on the page in front of it. */}
      <div className="w-full border-t bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-3">
          <p className="text-xs text-muted-foreground">
            {t('about-section:fork-attribution:foretext')}
            <a
              href="https://github.com/Raifa21/VRC-Worlds-Manager-v2"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground/80 underline-offset-2 hover:underline hover:text-foreground"
            >
              {t('about-section:fork-attribution:link-text')}
            </a>
            {t('about-section:fork-attribution:posttext')}
          </p>
          <p className="text-xs text-muted-foreground">
            {t('about-section:fork-attribution:thanks')}
          </p>
        </div>
      </div>
    </div>
  )
}
