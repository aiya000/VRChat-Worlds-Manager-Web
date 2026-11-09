import { useEffect, useRef, useState } from 'react'
import { useLocalization } from '@/hooks/use-localization'
import { AlertCircle, Save, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { commands } from '@/lib/commands'

interface PurgeVrchatFavoritesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onRequestBackup: () => void
}

type Step = 'warn' | 'confirm' | 'progress' | 'done'

export function PurgeVrchatFavoritesDialog({
  open,
  onOpenChange,
  onRequestBackup,
}: PurgeVrchatFavoritesDialogProps) {
  const { t } = useLocalization()
  const [step, setStep] = useState<Step>('warn')
  const [holdProgress, setHoldProgress] = useState(0)
  const [isHolding, setIsHolding] = useState(false)
  const [deleteProgress, setDeleteProgress] = useState({ done: 0, total: 0 })
  const [result, setResult] = useState<{
    deleted: number
    failed: number
  } | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const holdDuration = 3000
  const stepInterval = 50

  // Stopping `isHolding` is enough to stop the interval: the effect below
  // clears it on the way out.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (!open) {
      setStep('warn')
      setHoldProgress(0)
      setIsHolding(false)
      setDeleteProgress({ done: 0, total: 0 })
      setResult(null)
      setErrorMessage(null)
    }
  }

  const runPurge = async () => {
    setStep('progress')
    setErrorMessage(null)
    try {
      const res = await commands.purgeAllVrchatFavorites((done, total) => {
        setDeleteProgress({ done, total })
      })
      if (res.status === 'error') {
        setErrorMessage(res.error)
        setStep('confirm')
        return
      }
      setResult(res.data)
      setStep('done')
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e))
      setStep('confirm')
    }
  }

  useEffect(() => {
    if (isHolding) {
      intervalRef.current = setInterval(() => {
        setHoldProgress((prev) => {
          const next = prev + (stepInterval / holdDuration) * 100
          if (next >= 100) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current)
            }
            setIsHolding(false)
            runPurge()
            return 100
          }
          return next
        })
      }, stepInterval)
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isHolding])

  const handleHoldStart = () => setIsHolding(true)
  const handleHoldEnd = () => {
    setIsHolding(false)
    // A completed hold keeps its full bar.
    setHoldProgress((current) => (current < 100 ? 0 : current))
  }

  const handleContinueWithoutBackup = () => setStep('confirm')

  const handleBackupThenContinue = () => {
    onOpenChange(false)
    onRequestBackup()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {step === 'warn' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center text-destructive">
                <AlertCircle className="h-5 w-5 mr-2" />
                {t('purge-favorites:warning-title')}
              </DialogTitle>
              <DialogDescription className="text-destructive/90 font-medium">
                {t('purge-favorites:warning-description')}
              </DialogDescription>
            </DialogHeader>

            <div className="bg-destructive/10 border border-destructive/20 rounded-md p-4 my-4">
              <p className="text-sm font-semibold text-destructive">
                {t('purge-favorites:deletion-irreversible')}
              </p>
              <p className="text-sm text-destructive/90 mt-2">
                {t('purge-favorites:backup-recommendation')}
              </p>
            </div>

            <DialogFooter className="flex flex-col gap-2">
              <Button
                variant="default"
                className="w-full"
                onClick={handleBackupThenContinue}
              >
                <Save className="h-4 w-4" />
                {t('purge-favorites:backup-button')}
              </Button>
              <Button
                variant="destructive"
                className="w-full"
                onClick={handleContinueWithoutBackup}
              >
                {t('purge-favorites:continue-without-backup-button')}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => onOpenChange(false)}
              >
                {t('general:cancel')}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'confirm' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center text-destructive">
                <AlertCircle className="h-5 w-5 mr-2" />
                {t('purge-favorites:warning-title')}
              </DialogTitle>
              <DialogDescription className="text-destructive/90 font-medium">
                {t('purge-favorites:confirm-description')}
              </DialogDescription>
            </DialogHeader>

            {errorMessage && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
                <p className="text-sm text-destructive">{errorMessage}</p>
              </div>
            )}

            <DialogFooter className="flex flex-col sm:flex-row sm:justify-between gap-4">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="sm:w-auto w-full"
              >
                {t('general:cancel')}
              </Button>

              <div className="relative sm:w-auto w-full">
                <Button
                  variant="destructive"
                  disabled={holdProgress === 100}
                  className={`relative overflow-hidden flex items-center justify-center ${
                    holdProgress > 0 && holdProgress < 100
                      ? 'w-[140px]'
                      : 'w-full'
                  }`}
                  onMouseDown={handleHoldStart}
                  onMouseUp={handleHoldEnd}
                  onMouseLeave={handleHoldEnd}
                  onTouchStart={handleHoldStart}
                  onTouchEnd={handleHoldEnd}
                  onTouchCancel={handleHoldEnd}
                >
                  <span className="flex items-center gap-2">
                    {holdProgress > 0 && holdProgress < 100 && (
                      <svg
                        className="h-5 w-5"
                        viewBox="0 0 100 100"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <circle
                          cx="50"
                          cy="50"
                          r="45"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="8"
                          strokeOpacity="0.2"
                        />
                        <circle
                          cx="50"
                          cy="50"
                          r="45"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="8"
                          strokeDasharray={`${
                            2 * Math.PI * 45 * (holdProgress / 100)
                          } ${2 * Math.PI * 45}`}
                          transform="rotate(-90 50 50)"
                        />
                      </svg>
                    )}
                    <span>{t('purge-favorites:hold-to-delete')}</span>
                  </span>
                </Button>
              </div>
            </DialogFooter>
          </>
        )}

        {step === 'progress' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <Trash2 className="h-5 w-5 mr-2" />
                {t('purge-favorites:deleting')}
              </DialogTitle>
              <DialogDescription>
                {t(
                  'purge-favorites:deleting-progress',
                  deleteProgress.done,
                  deleteProgress.total,
                )}
              </DialogDescription>
            </DialogHeader>
            <Progress
              value={
                deleteProgress.total > 0
                  ? (deleteProgress.done / deleteProgress.total) * 100
                  : 0
              }
            />
          </>
        )}

        {step === 'done' && result && (
          <>
            <DialogHeader>
              <DialogTitle>{t('purge-favorites:success-title')}</DialogTitle>
              <DialogDescription>
                {result.failed > 0
                  ? t(
                      'purge-favorites:partial-failure-description',
                      result.deleted,
                      result.failed,
                    )
                  : t('purge-favorites:success-description', result.deleted)}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button className="w-full" onClick={() => onOpenChange(false)}>
                {t('general:confirm')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
