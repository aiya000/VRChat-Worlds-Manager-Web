'use client'

import { AlertTriangle } from 'lucide-react'
import { useEffect, useState, type FC } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useLocalization } from '@/hooks/use-localization'
import { commands } from '@/lib/commands'
import type { MemoConflictEntry } from '@/lib/services/memo-service'
import { subscribeToSyncActivity } from '@/lib/services/sync-activity'

/**
 * The memos two devices wrote differently, and what happened to each.
 *
 * #63 decided against a conflict-resolution screen -- comparing two versions
 * of anything through a VR laser pointer is not a thing to ask of someone, so
 * the merge decides on its own and never waits. What it cannot do is throw the
 * losing text away, and this is where that text stops being invisible.
 *
 * Nothing here is urgent: the memo on screen is already the one the merge
 * kept, and leaving the list alone forever is a valid outcome.
 */
export const MemoConflictsSection: FC = () => {
  const { t } = useLocalization()
  const [conflicts, setConflicts] = useState<MemoConflictEntry[]>([])
  const [busyWorldId, setBusyWorldId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const result = await commands.listMemoConflicts()
      if (!cancelled && result.status === 'ok') {
        setConflicts(result.data)
      }
    }

    void load()
    // A sync is the only thing that creates one of these, so the list is read
    // again whenever one finishes rather than on a timer.
    const unsubscribe = subscribeToSyncActivity((activity) => {
      if (!activity.running) {
        void load()
      }
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  const resolve = async (
    worldId: string,
    action: 'discard' | 'restore',
  ): Promise<void> => {
    setBusyWorldId(worldId)
    try {
      const result =
        action === 'discard'
          ? await commands.discardMemoBackup(worldId)
          : await commands.restoreMemoBackup(worldId)

      if (result.status === 'error') {
        toast(t('general:error-title'), { description: result.error })
        return
      }

      const listed = await commands.listMemoConflicts()
      if (listed.status === 'ok') {
        setConflicts(listed.data)
      }
    } finally {
      setBusyWorldId(null)
    }
  }

  if (conflicts.length === 0) {
    return null
  }

  return (
    <Card className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex flex-col space-y-1.5">
        <Label className="flex items-center gap-2 text-base font-medium">
          <AlertTriangle className="h-4 w-4" aria-hidden />
          {t('settings-page:memo-conflicts-title')}
        </Label>
        <div className="text-sm text-muted-foreground">
          {t('settings-page:memo-conflicts-description')}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {conflicts.map((conflict) => (
          <div
            key={conflict.worldId}
            className="flex flex-col gap-3 rounded-md border p-3"
          >
            <div className="text-sm font-medium break-all">
              {conflict.worldName}
            </div>

            <div className="flex flex-col gap-1">
              <div className="text-xs text-muted-foreground">
                {t('settings-page:memo-conflicts-current')}
              </div>
              {/* `whitespace-pre-wrap`: a memo is written with line breaks in
                  it, and collapsing them here would misrepresent what the two
                  versions actually say. */}
              <div className="rounded bg-muted p-2 text-sm whitespace-pre-wrap break-words">
                {conflict.currentText === ''
                  ? t('settings-page:memo-conflicts-empty')
                  : conflict.currentText}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <div className="text-xs text-muted-foreground">
                {t(
                  'settings-page:memo-conflicts-backed-up',
                  new Date(conflict.at).toLocaleString(),
                )}
              </div>
              <div className="rounded bg-muted p-2 text-sm whitespace-pre-wrap break-words">
                {conflict.backedUpText}
              </div>
            </div>

            {/* Tall and full width, side by side only where there is room:
                these are aimed at with a laser pointer as often as a mouse. */}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                className="h-11 flex-1"
                disabled={busyWorldId !== null}
                onClick={() => resolve(conflict.worldId, 'restore')}
              >
                {t('settings-page:memo-conflicts-restore')}
              </Button>
              <Button
                variant="outline"
                className="h-11 flex-1"
                disabled={busyWorldId !== null}
                onClick={() => resolve(conflict.worldId, 'discard')}
              >
                {t('settings-page:memo-conflicts-discard')}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
