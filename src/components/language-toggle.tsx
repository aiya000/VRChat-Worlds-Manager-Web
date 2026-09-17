'use client'

import { useContext } from 'react'
import { LocalizationContext } from '@/components/localization-context'
import { commands } from '@/lib/commands'
import { cn } from '@/lib/utils'

/**
 * `JA`, not `JP`: these are language subtags (ISO 639-1), and `JP` is the
 * country. The locales themselves are `ja-JP` and `en-US`, language first.
 */
const LANGUAGES = [
  { code: 'en-US', label: 'EN' },
  { code: 'ja-JP', label: 'JA' },
] as const

/**
 * Switches the language where there is no settings screen to reach -- the
 * landing page, which is the first thing anyone sees and the one page a
 * visitor has no account and no wizard behind them on.
 *
 * The choice is written to the preferences the rest of the app reads, so it
 * holds once the visitor goes in, rather than being undone by the next screen.
 */
export function LanguageToggle() {
  const { language, setLanguage } = useContext(LocalizationContext)

  const choose = (code: string) => {
    setLanguage(code)
    commands.setLanguage(code).then((result) => {
      if (result.status === 'error') {
        console.error(`Failed to remember the language: ${result.error}`)
      }
    })
  }

  return (
    <div
      className="inline-flex items-center rounded-md border p-0.5"
      role="group"
      aria-label="Language"
    >
      {LANGUAGES.map(({ code, label }) => (
        <button
          key={code}
          type="button"
          lang={code}
          aria-pressed={language === code}
          onClick={() => choose(code)}
          className={cn(
            'rounded px-3 py-1 text-xs font-medium transition-colors',
            language === code
              ? 'bg-foreground text-background'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
