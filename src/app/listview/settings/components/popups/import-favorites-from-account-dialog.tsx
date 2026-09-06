'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocalization } from '@/hooks/use-localization'
import { Loader2, Users } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { commands } from '@/lib/commands'
import type { WorldDisplayData } from '@/lib/types'
import { INVALID_TWO_FACTOR_CODE_ERROR } from '@/lib/services/vrchat-api'
import {
  fetchStepPercentage,
  importProgressPercentage,
  type FetchStep,
} from './import-favorites-progress'

interface ImportFavoritesFromAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Step =
  | 'warn'
  | 'credentials'
  | '2fa'
  | 'fetching'
  | 'select'
  | 'importing'
  | 'done'

export function ImportFavoritesFromAccountDialog({
  open,
  onOpenChange,
}: ImportFavoritesFromAccountDialogProps) {
  const { t } = useLocalization()
  const router = useRouter()

  const [step, setStep] = useState<Step>('warn')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [twoFactorCodeType, setTwoFactorCodeType] = useState('totp')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [sourceDisplayName, setSourceDisplayName] = useState('')
  const [fetchStep, setFetchStep] = useState<FetchStep>('reading-account')
  const [fetchedCount, setFetchedCount] = useState(0)
  const [fetchedWorlds, setFetchedWorlds] = useState<WorldDisplayData[]>([])
  const [selectedWorldIds, setSelectedWorldIds] = useState<Set<string>>(
    new Set(),
  )
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 })
  const [importedCount, setImportedCount] = useState(0)

  const reset = () => {
    setStep('warn')
    setUsername('')
    setPassword('')
    setTwoFactorCode('')
    setLoading(false)
    setErrorMessage(null)
    setSourceDisplayName('')
    setFetchStep('reading-account')
    setFetchedCount(0)
    setFetchedWorlds([])
    setSelectedWorldIds(new Set())
    setImportProgress({ done: 0, total: 0 })
    setImportedCount(0)
  }

  const handleDialogClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      reset()
    }
    onOpenChange(nextOpen)
  }

  const fetchFavorites = async () => {
    setStep('fetching')
    setFetchStep('reading-account')
    setFetchedCount(0)
    setErrorMessage(null)
    try {
      const userResult = await commands.getCurrentUser()
      if (userResult.status === 'error') {
        setErrorMessage(userResult.error)
        setStep('credentials')
        return
      }
      setSourceDisplayName(userResult.data.displayName)

      setFetchStep('fetching-favorites')
      // `/worlds/favorites` hands back the worlds themselves, one request per
      // page of 100. Listing the favorite IDs and fetching each world instead
      // costs one request per favorite, and an account with a few hundred of
      // them runs into the Worker's hourly per-IP limit long before the list
      // is complete -- which looked, from this screen, like a hang.
      const worldsResult = await commands.fetchFavoriteWorlds(setFetchedCount)
      if (worldsResult.status === 'error') {
        setErrorMessage(worldsResult.error)
        setStep('credentials')
        return
      }

      setFetchedWorlds(worldsResult.data)
      setSelectedWorldIds(new Set(worldsResult.data.map((w) => w.worldId)))
      setStep('select')
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e))
      setStep('credentials')
    }
  }

  const handleLogin = async () => {
    setLoading(true)
    setErrorMessage(null)
    try {
      await commands.logout()
      const result = await commands.loginWithCredentials(username, password)

      if (result.status === 'error') {
        if (result.error === '2fa-required') {
          setTwoFactorCodeType('totp')
          setStep('2fa')
        } else if (result.error === 'email-2fa-required') {
          setTwoFactorCodeType('emailOtp')
          setStep('2fa')
        } else {
          setErrorMessage(
            result.error || t('login-page:error-invalid-credentials'),
          )
        }
        return
      }

      await fetchFavorites()
    } finally {
      setLoading(false)
    }
  }

  const handle2fa = async () => {
    setLoading(true)
    setErrorMessage(null)
    try {
      const result = await commands.loginWith2fa(
        twoFactorCode,
        twoFactorCodeType,
      )
      if (result.status === 'error') {
        console.error(`[ImportFavorites] 2FA failed: ${result.error}`)
        // A rejected code is the ordinary case here, and the raw API text is
        // not something to put in front of the person typing it.
        setErrorMessage(
          result.error === INVALID_TWO_FACTOR_CODE_ERROR
            ? t('login-page:error-invalid-2fa')
            : result.error || t('login-page:error-invalid-2fa'),
        )
        return
      }
      await fetchFavorites()
    } finally {
      setLoading(false)
    }
  }

  const toggleWorldSelection = (worldId: string) => {
    setSelectedWorldIds((prev) => {
      const next = new Set(prev)
      if (next.has(worldId)) {
        next.delete(worldId)
      } else {
        next.add(worldId)
      }
      return next
    })
  }

  const handleImport = async () => {
    setStep('importing')
    const targets = fetchedWorlds.filter((w) => selectedWorldIds.has(w.worldId))
    setImportProgress({ done: 0, total: targets.length })

    // A world that is already here was filed into folders by hand; importing
    // the same world from another account must not empty them.
    const storedResult = await commands.getAllWorlds()
    const storedByWorldId = new Map(
      (storedResult.status === 'ok' ? storedResult.data : []).map((world) => [
        world.worldId,
        world,
      ]),
    )

    let imported = 0
    for (const world of targets) {
      const existing = storedByWorldId.get(world.worldId)
      const result = await commands.putWorld(
        existing === undefined
          ? world
          : {
              ...world,
              dateAdded: existing.dateAdded,
              folders: existing.folders,
            },
      )
      if (result.status === 'ok') {
        imported += 1
      }
      setImportProgress((prev) => ({ ...prev, done: prev.done + 1 }))
    }

    setImportedCount(imported)
    await commands.logout()
    setStep('done')
  }

  const handleGoToLogin = () => {
    handleDialogClose(false)
    router.push('/login')
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="sm:max-w-md">
        {step === 'warn' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <Users className="h-5 w-5 mr-2" />
                {t('import-favorites:warning-title')}
              </DialogTitle>
              <DialogDescription>
                {t('import-favorites:warning-description')}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => handleDialogClose(false)}
              >
                {t('general:cancel')}
              </Button>
              <Button onClick={() => setStep('credentials')}>
                {t('import-favorites:continue-button')}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'credentials' && (
          <>
            <DialogHeader>
              <DialogTitle>{t('import-favorites:login-title')}</DialogTitle>
              <DialogDescription>
                {t('import-favorites:login-description')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                type="text"
                placeholder={t('login-page:username-placeholder')}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <Input
                type="password"
                placeholder={t('login-page:password-placeholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleLogin()
                  }
                }}
              />
              {errorMessage && (
                <p className="text-sm text-destructive">{errorMessage}</p>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => handleDialogClose(false)}
              >
                {t('general:cancel')}
              </Button>
              <Button
                onClick={handleLogin}
                disabled={!username || !password || loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  t('login-page:login-button')
                )}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === '2fa' && (
          <>
            <DialogHeader>
              <DialogTitle>{t('login-page:2fa-title')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                type="text"
                placeholder={t('login-page:2fa-placeholder')}
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handle2fa()
                  }
                }}
              />
              {errorMessage && (
                <p className="text-sm text-destructive">{errorMessage}</p>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => handleDialogClose(false)}
              >
                {t('general:cancel')}
              </Button>
              <Button onClick={handle2fa} disabled={!twoFactorCode || loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  t('login-page:2fa-button')
                )}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'fetching' && (
          <>
            <DialogHeader>
              <DialogTitle>{t('import-favorites:fetching-title')}</DialogTitle>
              <DialogDescription>
                {t('import-favorites:fetching-description')}
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-center py-6">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
            {/* A percentage and a running count rather than a spinner alone:
                a fetch that has stopped and a fetch that is slow look
                identical otherwise. */}
            <div className="space-y-1 text-sm text-muted-foreground">
              <div>
                {`${fetchStepPercentage(fetchStep)}% — ${t(
                  `import-favorites:step-${fetchStep}`,
                )}`}
              </div>
              {fetchStep === 'fetching-favorites' && (
                <div className="text-xs">
                  {t('import-favorites:fetched-count', fetchedCount)}
                </div>
              )}
              <div className="text-xs">
                {t('import-favorites:do-not-close')}
              </div>
            </div>
          </>
        )}

        {step === 'select' && (
          <>
            <DialogHeader>
              <DialogTitle>
                {t('import-favorites:select-title', sourceDisplayName)}
              </DialogTitle>
              <DialogDescription>
                {t('import-favorites:select-description', fetchedWorlds.length)}
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[300px] overflow-y-auto space-y-2">
              {fetchedWorlds.map((world) => (
                <div key={world.worldId} className="flex items-center gap-2">
                  <Checkbox
                    id={`import-world-${world.worldId}`}
                    checked={selectedWorldIds.has(world.worldId)}
                    onCheckedChange={() => toggleWorldSelection(world.worldId)}
                  />
                  <Label
                    htmlFor={`import-world-${world.worldId}`}
                    className="truncate"
                  >
                    {world.name}
                  </Label>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => handleDialogClose(false)}
              >
                {t('general:cancel')}
              </Button>
              <Button
                onClick={handleImport}
                disabled={selectedWorldIds.size === 0}
              >
                {t('import-favorites:import-button', selectedWorldIds.size)}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'importing' && (
          <>
            <DialogHeader>
              <DialogTitle>{t('import-favorites:importing-title')}</DialogTitle>
              <DialogDescription>
                {`${importProgressPercentage(
                  importProgress.done,
                  importProgress.total,
                )}% — ${t(
                  'import-favorites:importing-progress',
                  importProgress.done,
                  importProgress.total,
                )}`}
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-center py-6">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
            <div className="text-xs text-muted-foreground">
              {t('import-favorites:do-not-close')}
            </div>
          </>
        )}

        {step === 'done' && (
          <>
            <DialogHeader>
              <DialogTitle>{t('import-favorites:done-title')}</DialogTitle>
              <DialogDescription>
                {t('import-favorites:done-description', importedCount)}
              </DialogDescription>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {t('import-favorites:relogin-notice')}
            </p>
            <DialogFooter>
              <Button className="w-full" onClick={handleGoToLogin}>
                {t('import-favorites:go-to-login-button')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
