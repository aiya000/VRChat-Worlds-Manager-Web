'use client'

import { Download } from 'lucide-react'
import { useEffect, useState, useSyncExternalStore, type FC } from 'react'
import { Button } from '@/components/ui/button'
import { useLocalization } from '@/hooks/use-localization'
import {
  isRunningInstalled,
  needsManualInstallSteps,
  subscribeToInstalled,
  subscribeToNothing,
  type BeforeInstallPromptEvent,
} from '@/lib/pwa'

/**
 * How to keep this app on the home screen or the desktop.
 *
 * Deliberately not a banner over the page: an offer to install that interrupts
 * is the kind nobody reads (#69). It sits on the About page, where someone
 * looking into what this app is will pass it, and says nothing at all to a
 * reader who already installed it.
 *
 * Chrome offers to do the install itself, through the event it fires when it
 * is willing; nothing else does, so everyone else is told the steps.
 */
export const PwaInstallNotice: FC = () => {
  const { t } = useLocalization()

  // Read rather than copied into state: both live outside React, and a state
  // set from an effect is what `react-hooks/set-state-in-effect` is about.
  // Prerendering has no window, so it answers as an uninstalled browser and
  // the client corrects it on hydration.
  const installed = useSyncExternalStore(
    subscribeToInstalled,
    isRunningInstalled,
    () => false,
  )
  const manual = useSyncExternalStore(
    subscribeToNothing,
    () => needsManualInstallSteps(navigator.userAgent),
    () => false,
  )

  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const capture = (event: Event) => {
      // Chrome's own prompt would otherwise appear wherever it liked. Taking
      // the event keeps the offer on this page, behind a press.
      event.preventDefault()
      setPrompt(event as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', capture)
    return () => window.removeEventListener('beforeinstallprompt', capture)
  }, [])

  const install = async () => {
    if (prompt === null) {
      return
    }
    await prompt.prompt()
    // Whatever the answer, the event is spent: Chrome fires a fresh one if it
    // is still willing.
    setPrompt(null)
  }

  if (installed) {
    return null
  }

  return (
    <div className="flex flex-col gap-3" data-testid="pwa-install-notice">
      <div className="text-sm text-muted-foreground">
        {t('about-section:install-description')}
      </div>
      {prompt !== null ? (
        <Button
          variant="outline"
          className="w-fit gap-2"
          onClick={install}
          data-testid="pwa-install-button"
        >
          <Download className="h-4 w-4" aria-hidden />
          {t('about-section:install-action')}
        </Button>
      ) : (
        <div className="text-sm text-muted-foreground">
          {manual
            ? t('about-section:install-steps-ios')
            : t('about-section:install-steps-browser')}
        </div>
      )}
    </div>
  )
}
