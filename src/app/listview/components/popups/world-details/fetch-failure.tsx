import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useLocalization } from '@/hooks/use-localization'
import type { WorldFetchFailure, WorldFetchFailureKind } from '@/lib/commands'

const MESSAGE_KEY: Record<WorldFetchFailureKind, string> = {
  'not-found': 'world-detail:world-not-found',
  'not-public': 'world-detail:world-not-public',
  network: 'world-detail:world-fetch-network',
  other: 'world-detail:world-fetch-failed',
}

export function worldFetchFailureMessageKey(
  kind: WorldFetchFailureKind,
): string {
  return MESSAGE_KEY[kind]
}

/** The raw error, folded away: it is for a bug report, not for reading. */
export function RawErrorDetails({ failure }: { failure: WorldFetchFailure }) {
  const { t } = useLocalization()
  return (
    <details
      className="text-xs text-muted-foreground"
      data-testid="world-fetch-raw-error"
    >
      <summary className="cursor-pointer">
        {t('world-detail:technical-details')}
      </summary>
      <pre className="mt-1 whitespace-pre-wrap break-all">
        {failure.message}
      </pre>
    </details>
  )
}

/** What the popup shows when there is no saved copy of the world to fall back on. */
export function WorldFetchFailureNotice({
  failure,
}: {
  failure: WorldFetchFailure
}) {
  const { t } = useLocalization()
  return (
    <div className="flex flex-col gap-3" data-testid="world-fetch-failure">
      <Alert variant="destructive" className="flex">
        <span className="flex items-center h-full mr-2">
          <AlertCircle className="h-5 w-5" />
        </span>
        <AlertDescription>{t(MESSAGE_KEY[failure.kind])}</AlertDescription>
      </Alert>
      <RawErrorDetails failure={failure} />
    </div>
  )
}
