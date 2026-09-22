'use client'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { LanguageToggle } from '@/components/language-toggle'
import { useLocalization } from '@/hooks/use-localization'

/**
 * The home page Google's brand verification is given, and nothing else.
 *
 * It used to be the screen that decided where the app starts, which replaced
 * itself the moment it loaded. The name and the purpose were put into its
 * static HTML for the review (#107) and the review still refused the
 * branding three times: the check is a person opening the URL in a browser,
 * and a person never saw any of it -- the redirect had already taken them to
 * the setup wizard or the sign-in form. Google's own requirements say as
 * much, that the home page "must be static and cannot redirect" and "cannot
 * require user login to view application information".
 *
 * So nothing here navigates on its own. The app is entered by pressing a
 * button, and `start_url` in the manifest points straight at `/start` so an
 * installed app never stops here.
 *
 * What the review looks for, all of it in the exported HTML before any script
 * runs: the app's own name, what the app is for, why it asks for the Google
 * account it asks for, and a link to the privacy policy.
 */
export default function Home() {
  const { t } = useLocalization()

  return (
    <div className="flex min-h-svh w-full flex-col">
      {/* The only language control a first-time visitor can reach: everything
          else that switches it is behind the setup wizard or the settings
          screen. */}
      <div className="mx-auto flex w-full max-w-2xl justify-end px-6 pt-4">
        <LanguageToggle />
      </div>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center gap-10 px-6 pb-16 pt-8">
        <div className="flex flex-col items-center gap-6 text-center">
          {/* 384px for a 128px slot, in WebP: three times over keeps the
              linework crisp on a phone, and the format is what stops that
              costing 200KB. It used to be the 512px PNG `manifest.json`
              installs, whose `priority` preload Cloudflare promotes to Early
              Hints -- so it arrived ahead of the render-blocking CSS, and a
              first visit with a cold cache painted at 2.4s because of it. */}
          <Image
            src="/icons/icon-384.webp"
            alt=""
            width={128}
            height={128}
            priority
            className="h-32 w-32 select-none"
          />
          {/* Not translated: it is what the consent screen shows, character
              for character, and the review compares the two. */}
          <h1 className="text-2xl font-semibold">VRChat Worlds Manager Web</h1>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            {t('home:tagline')}
          </p>
          <Button asChild size="lg">
            <Link href="/start">{t('home:open-app')}</Link>
          </Button>
        </div>

        <section className="w-full space-y-3">
          <h2 className="text-lg font-semibold">{t('home:features-title')}</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
            <li>{t('home:features-item-folders')}</li>
            <li>{t('home:features-item-anywhere')}</li>
            <li>{t('home:features-item-instances')}</li>
          </ul>
        </section>

        <section className="w-full space-y-3">
          <h2 className="text-lg font-semibold">{t('home:google-title')}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t('home:google-body')}
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t('home:google-scope')}
          </p>
        </section>
      </main>
      <footer className="flex justify-center gap-4 pb-6 text-center">
        <Link
          href="/terms"
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          {t('terms:link-label')}
        </Link>
        <Link
          href="/privacy"
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          {t('privacy-policy:link-label')}
        </Link>
      </footer>
    </div>
  )
}
