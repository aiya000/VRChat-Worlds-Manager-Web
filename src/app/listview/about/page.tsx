'use client'

import { Card, CardContent } from '@/components/ui/card'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { useLocalization } from '@/hooks/use-localization'
import { Button } from '@/components/ui/button'
import { SiGithub, SiDiscord } from '@icons-pack/react-simple-icons'
import { ChevronRight, FileText, Heart, ScrollText, Shield } from 'lucide-react'
import type { FC } from 'react'
import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'

const ABOUT = '/listview/about'

/**
 * `/terms` and `/privacy` are reached from the launch screen, the setup and
 * login footers, and from here, and "back" means a different place from each.
 * The link says where; a bare `/terms` still goes back to `/`, which is what
 * everything leading up to signing in wants -- and it is the URL registered
 * with Google's consent screen, so it has to keep working untouched.
 */
const backToHere = (path: string) => `${path}?back=${encodeURIComponent(ABOUT)}`

/**
 * One whole page behind one row. A VR controller aims a laser and a phone has
 * a thumb, so the target is the row rather than the words in it.
 */
const AboutRow: FC<{
  href: string
  icon: LucideIcon
  title: string
}> = ({ href, icon: Icon, title }) => (
  <Link
    href={href}
    className="flex items-center gap-4 px-4 py-4 transition-colors hover:bg-accent/50"
  >
    <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
    <span className="min-w-0 flex-1 text-sm font-medium">{title}</span>
    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
  </Link>
)

export default function AboutSection() {
  const { t } = useLocalization()
  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? 'unknown'

  return (
    <div className="min-h-svh flex flex-col overflow-x-hidden">
      <div className="flex-1 container mx-auto p-6 space-y-6">
        {/* Pinned so the sidebar stays reachable once the page scrolls. */}
        <div className="sticky top-0 z-20 -mx-6 bg-background px-6 py-2">
          <SidebarTrigger className="h-10 w-10 shrink-0" />
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{t('about-section:title')}</h1>
          <p className="text-sm text-muted-foreground">
            VRChat Worlds Manager Web {appVersion}
          </p>
        </div>

        <Card>
          <CardContent className="divide-y p-0">
            <AboutRow
              href={backToHere('/terms')}
              icon={FileText}
              title={t('terms:link-label')}
            />
            <AboutRow
              href={backToHere('/privacy')}
              icon={Shield}
              title={t('privacy-policy:link-label')}
            />
            <AboutRow
              href={`${ABOUT}/credits`}
              icon={Heart}
              title={t('about-section:credits-title')}
            />
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <div className="w-full border-t bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-2 flex flex-wrap justify-end items-center gap-y-1">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <Button variant="ghost" size="sm" asChild>
              <a
                href="https://github.com/aiya000/VRChat-Worlds-Manager-Web/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-row gap-2"
              >
                <ScrollText className="h-4 w-4" />
                {t('about-section:changelog')}
              </a>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a
                href="https://github.com/aiya000/VRChat-Worlds-Manager-Web"
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-row gap-2"
              >
                <SiGithub className="h-4 w-4" />
                {t('about-section:source-code')}
              </a>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a
                href="https://discord.gg/g5nq5GuGPJ"
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-row gap-2"
              >
                <SiDiscord className="h-4 w-4" />
                {t('about-section:report-issue')}
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
