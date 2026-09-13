'use client'

import { useSearchParams } from 'next/navigation'
import { useLocalization } from '@/hooks/use-localization'
import { Button } from '@/components/ui/button'
import { SiDiscord, SiGithub } from '@icons-pack/react-simple-icons'
import { Globe } from 'lucide-react'
import { useState, useContext } from 'react'
import { LocalizationContext } from '@/components/localization-context'
import {
  CONTACT_DISCORD_URL,
  CONTACT_ISSUES_URL,
} from '@/components/contact-links'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function ErrorContent() {
  const { t } = useLocalization()
  const { setLanguage } = useContext(LocalizationContext)
  const searchParams = useSearchParams()
  const [language, setLanguageState] = useState('en-US')

  // Get the first key from the query string as the error message
  const errorMessage = (() => {
    // Get all keys from the search params
    const keys = Array.from(searchParams.keys())

    // If there are any keys, use the first one
    if (keys.length > 0) {
      return keys[0].replace(/\+/g, ' ') // Replace '+' with spaces
    }

    // Fallback to unknown error
    return t('error-page:unknown-error')
  })()

  return (
    <div className="flex flex-col items-center justify-center h-screen p-6 relative">
      {/* Language Selector */}
      <div className="absolute top-4 right-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Globe className="h-4 w-4" />
              <span>{language === 'en-US' ? 'English' : '日本語'}</span>
              <span className="sr-only">Change Language</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                setLanguage('en-US')
                setLanguageState('en-US')
              }}
            >
              English
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setLanguage('ja-JP')
                setLanguageState('ja-JP')
              }}
            >
              日本語
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="text-center max-w-md">
        <h1 className="text-3xl font-bold mb-4">{t('error-page:title')}</h1>
        <p className="text-lg mb-6">
          {t('error-page:read-data-error-message')}
        </p>
        <p className="text-red-500 mb-8 p-4 bg-red-100 dark:bg-red-900/20 rounded-md">
          Error: {errorMessage}
        </p>

        <div className="flex flex-col gap-4 items-center">
          {/* Both ways out, not only the one that needs a GitHub account: the
              people who reach this screen are the ones least able to work
              round it on their own. */}
          <Button variant="secondary" className="gap-2 w-full" asChild>
            <a
              href={CONTACT_ISSUES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center"
            >
              <SiGithub className="h-4 w-4" />
              <span>{t('error-page:contact-support')}</span>
            </a>
          </Button>

          <Button variant="secondary" className="gap-2 w-full" asChild>
            <a
              href={CONTACT_DISCORD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center"
            >
              <SiDiscord className="h-4 w-4" />
              <span>{t('general:discord')}</span>
            </a>
          </Button>

          <Button
            onClick={() => window.location.reload()}
            className="gap-2 w-full"
          >
            {t('error-page:try-again')}
          </Button>
        </div>
      </div>
    </div>
  )
}
