import { FolderOpen, Loader2 } from 'lucide-react'
import { useState, type FC } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLocalization } from '@/hooks/use-localization'
import { commands } from '@/lib/commands'
import { SaturnIcon } from '@/components/icons/saturn-icon'
import type { BackupMetaData } from '@/lib/types'

/**
 * Restoring from a backup file, offered during the first-run setup.
 *
 * Always a merge, never a replace: there is nothing on a device being set up
 * for the file to overwrite, and offering the destructive mode here would only
 * be a way to get it wrong. The replace mode stays in the settings screen,
 * where someone asking for it means it.
 */
export const BackupRestoreStep: FC = () => {
  const { t } = useLocalization()
  const [file, setFile] = useState<File | null>(null)
  const [meta, setMeta] = useState<BackupMetaData | null>(null)
  const [reading, setReading] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [restored, setRestored] = useState(false)

  const pickFile = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const picked = (e.target as HTMLInputElement).files?.[0]
      if (picked === undefined) {
        return
      }

      setFile(picked)
      setMeta(null)
      setRestored(false)
      setReading(true)
      try {
        const result = await commands.getBackupMetadataFromFile(picked)
        if (result.status === 'error') {
          toast(t('general:error-title'), { description: result.error })
          setFile(null)
          return
        }
        setMeta(result.data)
      } finally {
        setReading(false)
      }
    }
    input.click()
  }

  const restore = async () => {
    if (file === null) {
      return
    }
    setRestoring(true)
    try {
      const result = await commands.restoreFromBackupFile(file, 'merge')
      if (result.status === 'error') {
        toast(t('general:error-title'), { description: result.error })
        return
      }
      setRestored(true)
      toast(t('general:success-title'), {
        description: t('settings-page:merge-success-description'),
      })
    } finally {
      setRestoring(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {t('setup-page:restore-backup-description')}
      </p>

      <div className="space-y-2">
        <Label>{t('setup-page:restore-backup-file-label')}</Label>
        <div className="flex items-center space-x-2">
          <Input
            value={file?.name ?? ''}
            readOnly
            placeholder={t('setup-page:restore-backup-placeholder')}
            className={file === null ? 'text-muted-foreground' : ''}
          />
          <Button variant="outline" onClick={pickFile} disabled={restoring}>
            {t('general:select-button')}
          </Button>
        </div>
      </div>

      {reading && (
        <div className="flex items-center justify-center p-4">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          <span>{t('settings-page:loading-migration-data')}</span>
        </div>
      )}

      {meta !== null && (
        <div className="space-y-3 rounded-md bg-muted p-4">
          <div className="flex items-center gap-2">
            <SaturnIcon className="h-4 w-4" />
            <span className="text-sm font-medium">
              {t('settings-page:worlds-count')}:
            </span>
            <span className="text-sm">{meta.number_of_worlds}</span>
          </div>
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            <span className="text-sm font-medium">
              {t('settings-page:folders-count')}:
            </span>
            <span className="text-sm">{meta.number_of_folders}</span>
          </div>
        </div>
      )}

      <Button
        className="h-12 w-full text-base"
        disabled={file === null || reading || restoring || restored}
        onClick={restore}
      >
        {restoring && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
        {restored
          ? t('setup-page:restore-backup-done')
          : t('setup-page:restore-backup-button')}
      </Button>
    </div>
  )
}
