'use client'

import { Card, CardContent } from '@/components/ui/card'
import { useLocalization } from '@/hooks/use-localization'
import { Button } from '@/components/ui/button'
import {
  CONTACT_DISCORD_URL,
  CONTACT_ISSUES_URL,
} from '@/components/contact-links'
import { SiDiscord, SiGithub } from '@icons-pack/react-simple-icons'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import type { FC, ReactNode } from 'react'
import Link from 'next/link'

const ABOUT = '/listview/about'

/**
 * The whole row is the target, as on the About page: a VR controller aims a
 * laser and a phone has a thumb, so the words alone are too small to hit.
 */
const ContactRow: FC<{
  href: string
  icon: ReactNode
  title: string
  description: string
}> = ({ href, icon, title, description }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="flex items-center gap-4 px-4 py-4 transition-colors hover:bg-accent/50"
  >
    <span className="shrink-0 text-muted-foreground">{icon}</span>
    <span className="min-w-0 flex-1">
      <span className="block text-sm font-medium">{title}</span>
      <span className="block text-xs text-muted-foreground">{description}</span>
    </span>
    <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
  </a>
)

/**
 * The one place both ways of reaching the author are named, so that every
 * screen offering to take a report can point at the same page rather than
 * picking one of them.
 *
 * They are shown as alternatives, with the word between them, because a
 * reader who has no GitHub account should not read the first row as the way
 * and the second as a lesser one.
 */
export default function ContactPage() {
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

        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">
            {t('about-section:report-issue')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('contact-page:description')}
          </p>
        </div>

        <div className="space-y-3">
          <Card>
            <CardContent className="p-0">
              <ContactRow
                href={CONTACT_ISSUES_URL}
                icon={<SiGithub className="h-5 w-5" />}
                title={t('general:github-issues')}
                description={t('contact-page:issues-description')}
              />
            </CardContent>
          </Card>

          <p className="text-center text-sm text-muted-foreground">
            {t('contact-page:or')}
          </p>

          <Card>
            <CardContent className="p-0">
              <ContactRow
                href={CONTACT_DISCORD_URL}
                icon={<SiDiscord className="h-5 w-5" />}
                title={t('general:discord')}
                description={t('contact-page:discord-description')}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
