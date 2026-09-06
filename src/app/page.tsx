'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Loader2 } from 'lucide-react'
import { commands } from '@/lib/commands'
import { useLocalization } from '@/hooks/use-localization'

export default function Home() {
  const router = useRouter()
  const { t } = useLocalization()

  useEffect(() => {
    const checkFirstTime = async () => {
      const isFirstTime = await commands.requireInitialSetup()

      if (isFirstTime) {
        router.push('/setup')
      } else {
        const checkFilesAndAuth = async () => {
          const result = await commands.checkFilesLoaded()

          if (result.status === 'error') {
            console.error(`Error loading files: ${result.error}`)
            router.push(
              `${'/error/read_data_error'}?${encodeURIComponent(result.error)}`,
            )
            return
          }

          // Then check authentication
          const authResult = await commands.tryLogin()

          if (authResult.status === 'ok') {
            console.info('User is authenticated')
            router.push('/listview/folders/special/all')
          } else {
            router.push('/login')
          }
        }
        checkFilesAndAuth()
      }
    }
    checkFirstTime()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex min-h-svh w-full flex-col">
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
        {/* 512px for a 128px slot: the icon has fine linework that would go
            soft on a phone's display otherwise. */}
        <Image
          src="/icons/icon-512.png"
          alt="VRChat Worlds Manager Web"
          width={128}
          height={128}
          priority
          className="app-breathe h-32 w-32 select-none"
        />
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('general:loading')}
        </p>
      </div>
      {/* Google's brand verification fetches the app's home page and expects
          to find the privacy policy linked from it, so this link has to live
          in the statically exported HTML of `/` rather than only past the
          redirect above. Kept down here as an ordinary footer: under the
          spinner it read as something floating rather than something meant. */}
      <footer className="pb-6 text-center">
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
