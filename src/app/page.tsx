'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Loader2 } from 'lucide-react'
import { commands } from '@/lib/commands'
import { useLocalization } from '@/hooks/use-localization'
import { releaseStartupGuard } from '@/lib/exit-guard'

/**
 * Where this screen decided the app begins, kept for as long as the page is
 * loaded. Deciding costs a request to VRChat, and this screen can be shown a
 * second time -- the exit guard steps back onto it -- with the answer already
 * known.
 */
let decided: string | null = null

export default function Home() {
  const router = useRouter()
  const { t } = useLocalization()

  // Replaced, never pushed. This screen decides where the app starts and has
  // nothing to show once it has decided, so leaving it in the history makes
  // the back gesture bounce: back lands here, this runs again, and the app is
  // pushed straight forward to where it came from. It is also the entry the
  // app is launched at (`start_url` is `/`), so anything left here is what
  // stands between the user and leaving.
  useEffect(() => {
    // Guarded while it decides, and the guard comes down before the replace:
    // a replace writes over the entry that is showing, and while the guard is
    // up that entry is the guard's own.
    const leaveFor = async (path: string) => {
      decided = path
      await releaseStartupGuard()
      router.replace(path)
    }

    const checkFirstTime = async () => {
      if (decided !== null) {
        await leaveFor(decided)
        return
      }

      const isFirstTime = await commands.requireInitialSetup()

      if (isFirstTime) {
        await leaveFor('/setup')
      } else {
        const checkFilesAndAuth = async () => {
          const result = await commands.checkFilesLoaded()

          if (result.status === 'error') {
            console.error(`Error loading files: ${result.error}`)
            await leaveFor(
              `${'/error/read_data_error'}?${encodeURIComponent(result.error)}`,
            )
            return
          }

          // Then check authentication
          const authResult = await commands.tryLogin()

          if (authResult.status === 'ok') {
            console.info('User is authenticated')
            await leaveFor('/listview/folders/special/all')
          } else {
            await leaveFor('/login')
          }
        }
        await checkFilesAndAuth()
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
