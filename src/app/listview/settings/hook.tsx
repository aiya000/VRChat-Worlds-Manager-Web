import { useLocalization } from '@/hooks/use-localization'
import type { RestoreMode } from '@/lib/services/backup-service'
import {
  CardSize,
  commands,
  FolderRemovalPreference,
  WorldCardFieldVisibility,
  WorldDetailFieldVisibility,
} from '@/lib/commands'
import { useContext, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { LocalizationContext } from '../../../components/localization-context'
import { useFolders } from '../hook/use-folders'
import { useTheme } from 'next-themes'
import {
  readSettingSyncOverrides,
  setSettingSyncOverride,
} from '@/lib/services/setting-sync'
import {
  isDeviceOnlySetting,
  type SettingSyncOverrides,
  type SyncableSettingKey,
} from '@/lib/sync/settings'

const normalizeThemeValue = (theme: string): 'light' | 'dark' | 'system' => {
  const unwrappedTheme =
    theme.startsWith('"') && theme.endsWith('"') ? theme.slice(1, -1) : theme

  if (
    unwrappedTheme === 'light' ||
    unwrappedTheme === 'dark' ||
    unwrappedTheme === 'system'
  ) {
    return unwrappedTheme
  }

  return 'system'
}

export const useSettingsPage = () => {
  const [cardSize, setCardSize] = useState<CardSize>('Normal')
  const [language, setLanguage] = useState<string>('en-US')
  const [folderRemovalPreference, setFolderRemovalPreference] =
    useState<FolderRemovalPreference | null>(null)
  const [fieldVisibility, setFieldVisibility] =
    useState<WorldCardFieldVisibility>({
      name: true,
      authorName: true,
      visits: true,
      lastUpdated: true,
      favorites: true,
    })
  const [detailFieldVisibility, setDetailFieldVisibility] =
    useState<WorldDetailFieldVisibility>({
      visits: true,
      favorites: true,
      capacity: true,
      published: true,
      lastUpdated: true,
    })

  const [syncOverrides, setSyncOverrides] = useState<SettingSyncOverrides>({})
  // Bumped when something outside the settings screen changes what is
  // stored -- taking in a backup -- so the screen reads the preferences
  // again instead of going on showing the ones the file replaced.
  const [preferencesRevision, setPreferencesRevision] = useState(0)

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showMigrateDialog, setShowMigrateDialog] = useState(false)
  const [showRestoreDialog, setShowRestoreDialog] = useState(false)
  const [showPurgeFavoritesDialog, setShowPurgeFavoritesDialog] =
    useState(false)

  const router = useRouter()

  const { setLanguage: changeLanguage } = useContext(LocalizationContext)

  const { refresh: onDataChange } = useFolders()

  const { setTheme } = useTheme()

  const { t } = useLocalization()

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const themeResult = await commands.getTheme()
        const languageResult = await commands.getLanguage()
        const cardSizeResult = await commands.getCardSize()
        const folderRemovalPreferenceResult =
          await commands.getFolderRemovalPreference()
        const fieldVisibilityResult =
          await commands.getWorldCardFieldVisibility()
        const detailFieldVisibilityResult =
          await commands.getWorldDetailFieldVisibility()
        const theme =
          themeResult.status === 'ok'
            ? normalizeThemeValue(themeResult.data)
            : 'system'
        const language =
          languageResult.status === 'ok' ? languageResult.data : 'en-US'
        const cardSize =
          cardSizeResult.status === 'ok' ? cardSizeResult.data : 'Normal'

        const folderRemovalPreference =
          folderRemovalPreferenceResult.status === 'ok'
            ? folderRemovalPreferenceResult.data
            : 'ask'
        const fieldVisibility =
          fieldVisibilityResult.status === 'ok'
            ? fieldVisibilityResult.data
            : {
                name: true,
                authorName: true,
                visits: true,
                lastUpdated: true,
                favorites: true,
              }
        const detailFieldVisibility =
          detailFieldVisibilityResult.status === 'ok'
            ? detailFieldVisibilityResult.data
            : {
                visits: true,
                favorites: true,
                capacity: true,
                published: true,
                lastUpdated: true,
              }
        setTheme(theme)
        setLanguage(language)
        changeLanguage(language)
        setCardSize(cardSize)
        setSyncOverrides(readSettingSyncOverrides())
        setFolderRemovalPreference(folderRemovalPreference)
        setFieldVisibility(fieldVisibility)
        setDetailFieldVisibility(detailFieldVisibility)
        // put a toast if commands fail
        if (
          themeResult.status === 'error' ||
          languageResult.status === 'error' ||
          cardSizeResult.status === 'error' ||
          folderRemovalPreferenceResult.status === 'error' ||
          fieldVisibilityResult.status === 'error' ||
          detailFieldVisibilityResult.status === 'error'
        ) {
          toast(t('general:error-title'), {
            description:
              t('settings-page:error-load-preferences') +
              ': ' +
              (themeResult.status === 'error' ? themeResult.error : '') +
              (languageResult.status === 'error' ? languageResult.error : '') +
              (cardSizeResult.status === 'error' ? cardSizeResult.error : '') +
              (folderRemovalPreferenceResult.status === 'error'
                ? folderRemovalPreferenceResult.error
                : '') +
              (fieldVisibilityResult.status === 'error'
                ? fieldVisibilityResult.error
                : '') +
              (detailFieldVisibilityResult.status === 'error'
                ? detailFieldVisibilityResult.error
                : ''),
          })
        }
      } catch (e) {
        console.error(`Failed to load preferences: ${e}`)
        toast(t('general:error-title'), {
          description: t('settings-page:error-load-preferences'),
        })
      }
    }

    loadPreferences()
  }, [setTheme, preferencesRevision]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleBackup = async () => {
    try {
      console.info('Creating backup...')
      const result = await commands.createBackup()

      if (result.status === 'error') {
        console.error(`Backup creation failed: ${result.error}`)
        toast(t('general:error-title'), {
          description: t('settings-page:error-create-backup'),
        })
        return
      }

      console.info('Backup created successfully')
      toast(t('settings-page:backup-success-title'), {
        description: t('settings-page:backup-success-description'),
      })
    } catch (e) {
      console.error(`Backup error: ${e}`)
      toast(t('general:error-title'), {
        description: t('settings-page:error-create-backup'),
      })
    }
  }

  const handleRestoreConfirm = async (file: File, mode: RestoreMode) => {
    try {
      console.info(`Restoring from backup: ${file.name} (${mode})`)
      const result = await commands.restoreFromBackupFile(file, mode)

      if (result.status === 'error') {
        console.error(`Restore failed: ${result.error}`)
        toast(t('general:error-title'), {
          description: t('settings-page:error-restore-backup'),
        })
        return
      }

      console.info('Restore completed successfully')
      toast(t('settings-page:restore-success-title'), {
        description:
          mode === 'merge'
            ? t('settings-page:merge-success-description')
            : t('settings-page:restore-success-description'),
      })
      setPreferencesRevision((revision) => revision + 1)
      onDataChange()
    } catch (e) {
      console.error(`Restore error: ${e}`)
      toast(t('general:error-title'), {
        description: t('settings-page:error-restore-backup'),
      })
    }
  }

  const handleMigrationConfirm = async (
    worldsFile: File,
    foldersFile: File,
  ) => {
    try {
      console.info(
        `Migrating data from ${worldsFile.name} and ${foldersFile.name}`,
      )
      const result = await commands.migrateDataFromFiles(
        worldsFile,
        foldersFile,
      )

      if (result.status === 'error') {
        console.error(`Migration failed: ${result.error}`)
        toast(t('general:error-title'), {
          description: t('settings-page:error-migrate-data'),
        })
        return
      }

      console.info('Migration completed successfully')
      toast(t('settings-page:migration-success-title'), {
        description: t('settings-page:migration-success-description'),
      })
      onDataChange()
    } catch (e) {
      console.error(`Migration error: ${e}`)
      toast(t('general:error-title'), {
        description: t('settings-page:error-migrate-data'),
      })
    }
  }

  const handleDeleteConfirm = async () => {
    try {
      console.info('Deleting all data...')
      const result = await commands.deleteData()
      if (result.status === 'error') {
        console.error(`Data deletion failed: ${result.error}`)
        toast(t('general:error-title'), {
          description: t('settings-page:error-delete-data'),
        })
        return
      }
      console.info('Data deleted successfully')
      toast(t('settings-page:delete-success-title'), {
        description: t('settings-page:delete-success-description'),
      })

      setShowDeleteConfirm(false)
      onDataChange()
    } catch (e) {
      console.error(`Data deletion error: ${e}`)
      toast(t('general:error-title'), {
        description: t('settings-page:error-delete-data'),
      })
    }
  }

  const handleLogout = async () => {
    try {
      console.info('Logging out...')
      const result = await commands.logout()

      if (result.status === 'error') {
        console.error(`Logout failed: ${result.error}`)
        toast(t('general:error-title'), {
          description: t('settings-page:error-logout'),
        })
        return
      }

      console.info('Logged out successfully')
      router.push('/login')
    } catch (e) {
      console.error(`Logout error: ${e}`)
      toast(t('general:error-title'), {
        description: t('settings-page:error-logout'),
      })
    }
  }

  const handleThemeChange = async (value: string) => {
    try {
      const normalizedTheme = normalizeThemeValue(value)
      console.info(`Setting theme to: ${normalizedTheme}`)
      const result = await commands.setTheme(normalizedTheme)

      if (result.status === 'ok') {
        setTheme(normalizedTheme)
        console.info(`Theme set to: ${normalizedTheme}`)
      } else {
        console.error(`Failed to set theme: ${result.error}`)
        toast(t('general:error-title'), {
          description:
            t('settings-page:error-save-preferences') + ': ' + result.error,
        })
      }
    } catch (e) {
      console.error(`Failed to save theme: ${e}`)
      toast(t('general:error-title'), {
        description: t('settings-page:error-save-preferences'),
      })
    }
  }

  const handleLanguageChange = async (value: string) => {
    try {
      console.info(`Setting language to: ${value}`)
      const result = await commands.setLanguage(value)
      if (result.status === 'ok') {
        changeLanguage(value)
        setLanguage(value)
        console.info(`Language set to: ${value}`)
      } else {
        console.error(`Failed to set language: ${result.error}`)
        toast(t('general:error-title'), {
          description:
            t('settings-page:error-save-preferences') + ': ' + result.error,
        })
      }
    } catch (e) {
      console.error(`Failed to save language: ${e}`)
      toast(t('general:error-title'), {
        description: t('settings-page:error-save-preferences'),
      })
    }
  }

  const handleCardSizeChange = async (value: CardSize) => {
    try {
      console.info(`Setting card size to: ${value}`)
      const result = await commands.setCardSize(value)
      if (result.status === 'ok') {
        setCardSize(value)
        console.info(`Card size set to: ${value}`)
      } else {
        console.error(`Failed to set card size: ${result.error}`)
        toast(t('general:error-title'), {
          description:
            t('settings-page:error-save-preferences') + ': ' + result.error,
        })
        return
      }
    } catch (e) {
      console.error(`Failed to save card size: ${e}`)
      toast(t('general:error-title'), {
        description: t('settings-page:error-save-preferences'),
      })
    }
  }

  const handleFieldVisibilityChange = async (
    value: WorldCardFieldVisibility,
  ) => {
    try {
      console.info(
        `Setting world card field visibility to: ${JSON.stringify(value)}`,
      )
      const result = await commands.setWorldCardFieldVisibility(value)
      if (result.status === 'ok') {
        setFieldVisibility(value)
        console.info('World card field visibility saved')
      } else {
        console.error(`Failed to set field visibility: ${result.error}`)
        toast(t('general:error-title'), {
          description:
            t('settings-page:error-save-preferences') + ': ' + result.error,
        })
      }
    } catch (e) {
      console.error(`Failed to save field visibility: ${e}`)
      toast(t('general:error-title'), {
        description: t('settings-page:error-save-preferences'),
      })
    }
  }

  const handleDetailFieldVisibilityChange = async (
    value: WorldDetailFieldVisibility,
  ) => {
    try {
      console.info(
        `Setting world detail field visibility to: ${JSON.stringify(value)}`,
      )
      const result = await commands.setWorldDetailFieldVisibility(value)
      if (result.status === 'ok') {
        setDetailFieldVisibility(value)
        console.info('World detail field visibility saved')
      } else {
        console.error(`Failed to set detail field visibility: ${result.error}`)
        toast(t('general:error-title'), {
          description:
            t('settings-page:error-save-preferences') + ': ' + result.error,
        })
      }
    } catch (e) {
      console.error(`Failed to save detail field visibility: ${e}`)
      toast(t('general:error-title'), {
        description: t('settings-page:error-save-preferences'),
      })
    }
  }

  const handleFolderRemovalPreferenceChange = async (
    value: FolderRemovalPreference,
  ) => {
    try {
      console.info(`Setting folder removal preference to: ${value}`)
      const result = await commands.setFolderRemovalPreference(value)
      if (result.status === 'ok') {
        console.info(`Folder removal preference set to: ${value}`)
        setFolderRemovalPreference(value)
      } else {
        console.error(
          `Failed to set folder removal preference: ${result.error}`,
        )
        toast(t('general:error-title'), {
          description:
            t('settings-page:error-save-preferences') + ': ' + result.error,
        })
      }
    } catch (e) {
      console.error(`Failed to save folder removal preference: ${e}`)
      toast(t('general:error-title'), {
        description: t('settings-page:error-save-preferences'),
      })
    }
  }

  const isDeviceOnly = (key: SyncableSettingKey): boolean =>
    isDeviceOnlySetting(key, syncOverrides)

  const handleDeviceOnlyChange = (
    key: SyncableSettingKey,
    deviceOnly: boolean,
  ) => {
    setSettingSyncOverride(key, deviceOnly)
    setSyncOverrides(readSettingSyncOverrides())
  }

  const openHiddenFolder = () => {
    router.push('/listview/folders/hidden')
  }

  return {
    cardSize,
    language,
    folderRemovalPreference,
    fieldVisibility,
    detailFieldVisibility,
    showDeleteConfirm,
    setShowDeleteConfirm,
    showMigrateDialog,
    setShowMigrateDialog,
    showRestoreDialog,
    setShowRestoreDialog,
    showPurgeFavoritesDialog,
    setShowPurgeFavoritesDialog,
    handleBackup,
    handleRestoreConfirm,
    handleMigrationConfirm,
    handleDeleteConfirm,
    handleLogout,
    handleThemeChange,
    handleLanguageChange,
    handleCardSizeChange,
    handleFieldVisibilityChange,
    handleDetailFieldVisibilityChange,
    handleFolderRemovalPreferenceChange,
    isDeviceOnly,
    handleDeviceOnlyChange,
    openHiddenFolder,
    t,
  }
}
