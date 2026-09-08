'use client'

import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useLocalization } from '@/hooks/use-localization'
import { GOOGLE_AUTH_RETURN_PATH } from '@/lib/google-auth-flow'
import { completeGoogleAuthReturn } from '@/lib/services/google-auth-service'

/**
 * Where Google sends the browser back to, with the token after the `#`.
 *
 * Nothing is shown here for long: the fragment is read, the page that left
 * is looked up, and the browser goes there. What is left behind is a screen
 * for the case where there is nowhere to go -- a stale link, or the address
 * typed in by hand -- which says so and offers the way home.
 */
export default function GoogleAuthReturnPage() {
  const router = useRouter()
  const { t } = useLocalization()
  const [stranded, setStranded] = useState(false)

  useEffect(() => {
    const fragment = window.location.hash
    // Off the address bar and out of history straight away: the token has
    // been read, and a reload or a shared screenshot must not offer it again.
    window.history.replaceState(null, '', GOOGLE_AUTH_RETURN_PATH)

    completeGoogleAuthReturn(fragment).then((returnTo) => {
      if (returnTo === null) {
        setStranded(true)
        return
      }
      router.replace(returnTo)
    })
  }, [router])

  return (
    <div className="flex min-h-svh w-full flex-col items-center justify-center gap-4 px-6 text-center">
      {stranded ? (
        <>
          <p className="text-sm text-muted-foreground">
            {t('google-auth:nowhere-to-return')}
          </p>
          <Link href="/" className="text-sm underline underline-offset-2">
            {t('google-auth:go-home')}
          </Link>
        </>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t('google-auth:returning')}
        </p>
      )}
    </div>
  )
}
