'use client'

import { UserRound } from 'lucide-react'
import { useEffect, useState, type FC } from 'react'
import { useLocalization } from '@/hooks/use-localization'
import { commands } from '@/lib/commands'

type Account =
  | { state: 'reading' }
  | { state: 'known'; displayName: string }
  | { state: 'unknown' }

/**
 * Which VRChat account this app is signed in as (#207).
 *
 * Someone with more than one account had no way to tell, and a favourites
 * import or a self-invite sent from the wrong one is a surprise found only
 * afterwards. The display name is what VRChat itself shows for the account,
 * so it is the name to answer with.
 *
 * Read once, when the card mounts: `GET /auth/user` is also the sign-in
 * endpoint at the Worker, and every read spends a request against the per-IP
 * hour. A failed read says so rather than saying nothing -- an empty line
 * here would be the very uncertainty this exists to remove.
 */
export const SignedInAccount: FC = () => {
  const { t } = useLocalization()
  const [account, setAccount] = useState<Account>({ state: 'reading' })

  useEffect(() => {
    let cancelled = false
    commands.getCurrentUser().then((result) => {
      if (cancelled) {
        return
      }
      setAccount(
        result.status === 'ok'
          ? { state: 'known', displayName: result.data.displayName }
          : { state: 'unknown' },
      )
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (account.state === 'reading') {
    return null
  }

  return (
    <div
      className="flex items-center gap-2 text-sm"
      data-testid="signed-in-account"
    >
      <UserRound className="h-4 w-4 shrink-0" aria-hidden />
      {account.state === 'known' ? (
        <span>
          {t('settings-page:signed-in-as')}{' '}
          <span className="font-medium text-foreground">
            {account.displayName}
          </span>
        </span>
      ) : (
        <span className="text-muted-foreground">
          {t('settings-page:signed-in-unknown')}
        </span>
      )}
    </div>
  )
}
