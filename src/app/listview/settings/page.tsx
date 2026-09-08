'use client'

import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DeviceOnlySettingToggle } from '@/components/device-only-setting-toggle'
import { UiScaleStepper } from '@/components/ui-scale-stepper'
import { VR_UI_SCALE } from '@/lib/ui-scale'
import { GoogleDriveSection } from './components/google-drive-section'
import { MemoConflictsSection } from './components/memo-conflicts-section'
import { PushSettingsSection } from './components/push-settings-section'
import { WorldCardPreview } from '@/components/world-card'
import { WorldCardFieldToggles } from '@/components/world-card-field-toggles'
import { WorldDetailFieldToggles } from '@/components/world-detail-field-toggles'
import { WorldDetailPreview } from '@/components/world-detail-preview'

import { FolderRemovalPreference } from '@/lib/commands'
import {
  LogOut,
  Trash2,
  Upload,
  FolderOpen,
  Save,
  Users,
  ExternalLink,
} from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Card } from '../../../components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RestoreBackupDialog } from '@/app/listview/settings/components/popups/restore-backup-dialog'
import { MigrationPopup } from '@/app/listview/settings/components/popups/migration-popup'
import { DeleteDataConfirmationDialog } from '@/app/listview/settings/components/popups/delete-data-confirmation'
import { PurgeVrchatFavoritesDialog } from '@/app/listview/settings/components/popups/purge-vrchat-favorites-dialog'
import { ImportFavoritesFromAccountDialog } from '@/app/listview/settings/components/popups/import-favorites-from-account-dialog'
import { useSettingsPage } from './hook'
import { SidebarTrigger } from '@/components/ui/sidebar'

const TABS = ['preferences', 'sync', 'data-management', 'others'] as const
type Tab = (typeof TABS)[number]

function isTab(value: string | null): value is Tab {
  return TABS.some((tab) => tab === value)
}

export default function SettingsPage() {
  const [showImportFavoritesDialog, setShowImportFavoritesDialog] =
    useState(false)
  // `?tab=sync` is how the list's sync button lands someone on the connect
  // button, rather than on the first tab with the right one three taps away.
  const requestedTab = useSearchParams().get('tab')
  const initialTab: Tab = isTab(requestedTab) ? requestedTab : 'preferences'
  const {
    cardSize,
    language,
    folderRemovalPreference,
    skipSelfInviteOnCreate,
    handleSkipSelfInviteChange,
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
    uiScale,
    handleUiScaleChange,
    handleFieldVisibilityChange,
    handleDetailFieldVisibilityChange,
    handleFolderRemovalPreferenceChange,
    isDeviceOnly,
    handleDeviceOnlyChange,
    openHiddenFolder,
    t,
  } = useSettingsPage()

  return (
    <div className="container max-w-4xl mx-auto p-6 space-y-6">
      {/* Pinned so the sidebar stays reachable once the page scrolls. */}
      <div className="sticky top-0 z-20 -mx-6 flex items-center gap-2 bg-background px-6 py-2">
        <SidebarTrigger className="h-10 w-10 shrink-0" />
        <h1 className="text-2xl font-bold">{t('general:settings')}</h1>
      </div>
      <Tabs defaultValue={initialTab} className="w-full">
        <div className="sticky top-0 z-10 bg-background pt-2 pb-2">
          {/* Four equal columns of no-wrap labels ran out past the bar on a
              phone. Each tab takes an equal share and lets its words wrap
              instead: two lines are readable in a VR panel, a clipped word
              is not. */}
          <TabsList className="flex h-auto w-full">
            {(
              [
                ['preferences', 'settings-page:section-preferences'],
                ['sync', 'settings-page:section-sync'],
                ['data-management', 'settings-page:section-data-management'],
                ['others', 'settings-page:section-others'],
              ] as const
            ).map(([value, label]) => (
              <TabsTrigger
                key={value}
                value={value}
                className="min-w-0 flex-1 whitespace-normal py-2 text-center leading-tight"
              >
                {t(label)}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="preferences" className="space-y-4">
          <Card className="flex flex-col gap-3 p-4 rounded-lg border">
            <div className="flex w-full flex-row items-center justify-between gap-4">
              <div className="flex flex-col space-y-1.5">
                <Label className="text-base font-medium">
                  {t('general:theme-label')}
                </Label>
                <div className="text-sm text-muted-foreground">
                  {t('general:theme-description')}
                </div>
              </div>
              <Select
                value={useTheme().theme || 'system'}
                onValueChange={(value) => handleThemeChange(value)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Theme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">{t('general:light')}</SelectItem>
                  <SelectItem value="dark">{t('general:dark')}</SelectItem>
                  <SelectItem value="system">{t('general:system')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DeviceOnlySettingToggle
              settingKey="theme"
              label={t('settings-page:device-only-label')}
              description={t('settings-page:device-only-description')}
              checked={isDeviceOnly('theme')}
              onCheckedChange={(deviceOnly) =>
                handleDeviceOnlyChange('theme', deviceOnly)
              }
            />
          </Card>

          <Card className="flex flex-col gap-3 p-4 rounded-lg border">
            <div className="flex w-full flex-row items-center justify-between gap-4">
              <div className="flex flex-col space-y-1.5">
                <Label className="text-base font-medium">
                  {t('general:language-label')}
                </Label>
                <div className="text-sm text-muted-foreground">
                  {t('general:language-description')}
                </div>
              </div>
              <Select
                value={language || 'en-US'}
                onValueChange={(value) => handleLanguageChange(value)}
              >
                <SelectTrigger
                  data-testid="language-select"
                  className="w-[180px]"
                >
                  <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ja-JP">日本語</SelectItem>
                  <SelectItem value="en-US">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DeviceOnlySettingToggle
              settingKey="language"
              label={t('settings-page:device-only-label')}
              description={t('settings-page:device-only-description')}
              checked={isDeviceOnly('language')}
              onCheckedChange={(deviceOnly) =>
                handleDeviceOnlyChange('language', deviceOnly)
              }
            />
          </Card>

          <Card className="flex flex-col items-start justify-between space-y-3 p-4 rounded-lg border">
            <div className="flex flex-row justify-between w-full">
              <div className="flex flex-col space-y-1.5">
                <Label className="text-base font-medium">
                  {t('settings-page:world-card-size')}
                </Label>
                <div className="text-sm text-muted-foreground">
                  {t('settings-page:world-card-description')}
                </div>
              </div>
              <Select
                value={cardSize || 'Normal'}
                onValueChange={handleCardSizeChange}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Card Size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Compact">
                    {t('general:compact')}
                  </SelectItem>
                  <SelectItem value="Normal">{t('general:normal')}</SelectItem>
                  <SelectItem value="Expanded">
                    {t('general:expanded')}
                  </SelectItem>
                  <SelectItem value="Original">
                    {t('general:original')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <WorldCardPreview
              size={cardSize || 'Normal'}
              fieldVisibility={fieldVisibility}
              world={{
                worldId: '1',
                name: t('settings-page:preview-world'),
                thumbnailUrl: '/icons/1.png',
                authorName: t('general:author'),
                lastUpdated: '2025-02-28',
                visits: 1911,
                dateAdded: '2025-01-01',
                favorites: 616,
                platform: ['standalonewindows', 'android', 'ios'],
                folders: [],
                tags: [],
                capacity: 16,
              }}
            />
            <DeviceOnlySettingToggle
              settingKey="cardSize"
              label={t('settings-page:device-only-label')}
              description={t('settings-page:device-only-description')}
              checked={isDeviceOnly('cardSize')}
              onCheckedChange={(deviceOnly) =>
                handleDeviceOnlyChange('cardSize', deviceOnly)
              }
            />
          </Card>

          <Card className="flex flex-col gap-3 p-4 rounded-lg border">
            <div className="flex w-full flex-row items-center justify-between gap-4">
              <div className="flex flex-col space-y-1.5">
                <Label className="text-base font-medium">
                  {t('settings-page:ui-scale')}
                </Label>
                <div className="text-sm text-muted-foreground">
                  {t('settings-page:ui-scale-description')}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  data-testid="ui-scale-vr-preset"
                  onClick={() => handleUiScaleChange(VR_UI_SCALE)}
                >
                  {t('settings-page:ui-scale-vr-preset')}
                </Button>
                <UiScaleStepper
                  value={uiScale}
                  onChange={handleUiScaleChange}
                  testIdPrefix="ui-scale-stepper"
                />
              </div>
            </div>
            <DeviceOnlySettingToggle
              settingKey="uiScale"
              label={t('settings-page:device-only-label')}
              description={t('settings-page:device-only-description')}
              checked={isDeviceOnly('uiScale')}
              onCheckedChange={(deviceOnly) =>
                handleDeviceOnlyChange('uiScale', deviceOnly)
              }
            />
          </Card>

          <Card className="flex flex-col items-start justify-between space-y-3 p-4 rounded-lg border">
            <div className="flex flex-col space-y-1.5">
              <Label className="text-base font-medium">
                {t('settings-page:world-card-fields')}
              </Label>
              <div className="text-sm text-muted-foreground">
                {t('settings-page:world-card-fields-description')}
              </div>
            </div>
            <div className="w-full">
              <WorldCardFieldToggles
                value={fieldVisibility}
                onChange={handleFieldVisibilityChange}
              />
            </div>
            <DeviceOnlySettingToggle
              settingKey="worldCardFieldVisibility"
              label={t('settings-page:device-only-label')}
              description={t('settings-page:device-only-description')}
              checked={isDeviceOnly('worldCardFieldVisibility')}
              onCheckedChange={(deviceOnly) =>
                handleDeviceOnlyChange('worldCardFieldVisibility', deviceOnly)
              }
            />
          </Card>

          <Card className="flex flex-col items-start justify-between space-y-3 p-4 rounded-lg border">
            <div className="flex flex-col space-y-1.5">
              <Label className="text-base font-medium">
                {t('settings-page:world-detail-fields')}
              </Label>
              <div className="text-sm text-muted-foreground">
                {t('settings-page:world-detail-fields-description')}
              </div>
            </div>
            <div className="w-full">
              <WorldDetailFieldToggles
                value={detailFieldVisibility}
                onChange={handleDetailFieldVisibilityChange}
              />
            </div>
            <WorldDetailPreview fieldVisibility={detailFieldVisibility} />
            <DeviceOnlySettingToggle
              settingKey="worldDetailFieldVisibility"
              label={t('settings-page:device-only-label')}
              description={t('settings-page:device-only-description')}
              checked={isDeviceOnly('worldDetailFieldVisibility')}
              onCheckedChange={(deviceOnly) =>
                handleDeviceOnlyChange('worldDetailFieldVisibility', deviceOnly)
              }
            />
          </Card>
        </TabsContent>

        <TabsContent value="sync" className="space-y-4">
          <GoogleDriveSection />
          {/* Renders nothing when there is nothing set aside, which is almost
              always. */}
          <MemoConflictsSection />
          {/* Set apart from the cards above with extra room: this is the one
              action here that overrules other devices, and it should not read
              as an everyday neighbour of "sync now" (#119). */}
          <div className="pt-6">
            <PushSettingsSection />
          </div>
        </TabsContent>

        <TabsContent value="data-management" className="space-y-4">
          <Card className="flex flex-row items-center justify-between p-4 rounded-lg border">
            <div className="flex flex-col space-y-1.5">
              <Label className="text-base font-medium">
                {t('settings-page:hidden-folder')}
              </Label>
              <div className="text-sm text-muted-foreground">
                {t('settings-page:hidden-folder-description')}
              </div>
            </div>
            <Button
              variant="outline"
              onClick={openHiddenFolder}
              className="gap-2"
            >
              <FolderOpen className="h-4 w-4" />
              <span className="text-sm">{t('general:open-folder')}</span>
            </Button>
          </Card>

          <Card className="flex flex-row items-center justify-between p-4 rounded-lg border">
            <div className="flex flex-col space-y-1.5">
              <Label className="text-base font-medium">
                {t('settings-page:backup-title')}
              </Label>
              <div className="text-sm text-muted-foreground">
                {t('settings-page:backup-description')}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                onClick={handleBackup}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                <span className="text-sm">
                  {t('settings-page:create-backup')}
                </span>
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowRestoreDialog(true)}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                <span className="text-sm">
                  {t('settings-page:restore-backup')}
                </span>
              </Button>
            </div>
          </Card>
          <Card className="flex flex-row items-center justify-between p-4 rounded-lg border">
            <div className="flex flex-col space-y-1.5">
              <Label className="text-base font-medium">
                {t('settings-page:import-favorites-title')}
              </Label>
              <div className="text-sm text-muted-foreground">
                {t('settings-page:import-favorites-description')}
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowImportFavoritesDialog(true)}
              className="gap-2"
            >
              <Users className="h-4 w-4" />
              <span className="text-sm">
                {t('settings-page:import-favorites-button')}
              </span>
            </Button>
          </Card>

          <Card className="flex flex-row items-center justify-between p-4 rounded-lg border">
            <div className="flex flex-col space-y-1.5">
              <Label className="text-base font-medium">
                {t('settings-page:data-migration-title')}
              </Label>
              <div className="text-sm text-muted-foreground">
                {t('settings-page:data-migration-description')}
              </div>
              <a
                href="/migration-guide/v2"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm underline underline-offset-2"
              >
                {t('migration-guide:link-label')}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowMigrateDialog(true)}
              className="gap-2"
            >
              <span className="text-sm">{t('settings-page:migrate-data')}</span>
            </Button>
          </Card>

          <Card className="flex flex-row items-center justify-between p-4 rounded-lg border border-destructive bg-destructive/5">
            <div className="flex flex-col space-y-1.5">
              <Label className="text-base font-medium">
                {t('settings-page:data-deletion-title')}
              </Label>
              <div className="text-sm text-muted-foreground">
                {t('settings-page:data-deletion-description')}
              </div>
            </div>
            <Button
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              <span className="text-sm">
                {t('settings-page:delete-all-data')}
              </span>
            </Button>
          </Card>

          <Card className="flex flex-row items-center justify-between p-4 rounded-lg border border-destructive bg-destructive/5">
            <div className="flex flex-col space-y-1.5">
              <Label className="text-base font-medium">
                {t('settings-page:purge-favorites-title')}
              </Label>
              <div className="text-sm text-muted-foreground">
                {t('settings-page:purge-favorites-description')}
              </div>
            </div>
            <Button
              variant="destructive"
              onClick={() => setShowPurgeFavoritesDialog(true)}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              <span className="text-sm">
                {t('settings-page:purge-favorites-button')}
              </span>
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="others" className="space-y-4">
          {/* On by default. The invite is what puts the instance in the VRChat
              app's notifications, which on a phone is the only way in that does
              not depend on a link opening something (#115). */}
          <Card className="flex flex-col gap-3 p-4 rounded-lg border">
            <div className="flex w-full flex-row items-center justify-between gap-4">
              <div className="flex flex-col space-y-1.5">
                <Label className="text-base font-medium">
                  {t('settings-page:skip-self-invite-title')}
                </Label>
                <div className="text-sm text-muted-foreground">
                  {t('settings-page:skip-self-invite-description')}
                </div>
              </div>
              <Switch
                id="skip-self-invite"
                data-testid="skip-self-invite"
                checked={skipSelfInviteOnCreate}
                onCheckedChange={(checked) =>
                  handleSkipSelfInviteChange(checked === true)
                }
              />
            </div>
          </Card>

          <Card className="flex flex-col gap-3 p-4 rounded-lg border">
            <div className="flex w-full flex-row items-center justify-between gap-4">
              <div className="flex flex-col space-y-1.5">
                <Label className="text-base font-medium">
                  {t('settings-page:folder-removal-title')}
                </Label>
                <div className="text-sm text-muted-foreground">
                  {t('settings-page:folder-removal-description')}
                </div>
              </div>
              <Select
                value={folderRemovalPreference ?? 'ask'}
                onValueChange={(value) =>
                  handleFolderRemovalPreferenceChange(
                    value as FolderRemovalPreference,
                  )
                }
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Folder Removal Preference" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ask">
                    {t('settings-page:folder-removal-ask')}
                  </SelectItem>
                  <SelectItem value="neverRemove">
                    {t('settings-page:folder-removal-keep')}
                  </SelectItem>
                  <SelectItem value="alwaysRemove">
                    {t('settings-page:folder-removal-remove')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DeviceOnlySettingToggle
              settingKey="folderRemovalPreference"
              label={t('settings-page:device-only-label')}
              description={t('settings-page:device-only-description')}
              checked={isDeviceOnly('folderRemovalPreference')}
              onCheckedChange={(deviceOnly) =>
                handleDeviceOnlyChange('folderRemovalPreference', deviceOnly)
              }
            />
          </Card>

          <Card className="flex flex-row items-center justify-between p-4 rounded-lg border">
            <div className="flex flex-col space-y-1.5">
              <Label className="text-base font-medium">
                {t('settings-page:logout-title')}
              </Label>
              <div className="text-sm text-muted-foreground">
                {t('settings-page:logout-description')}
              </div>
            </div>
            <Button variant="outline" onClick={handleLogout} className="gap-2">
              <LogOut className="h-4 w-4" />
              <span className="text-sm">{t('settings-page:logout')}</span>
            </Button>
          </Card>
        </TabsContent>
      </Tabs>

      <RestoreBackupDialog
        open={showRestoreDialog}
        onOpenChange={setShowRestoreDialog}
        onConfirm={handleRestoreConfirm}
      />
      <MigrationPopup
        open={showMigrateDialog}
        onOpenChange={setShowMigrateDialog}
        onConfirm={handleMigrationConfirm}
      />
      <DeleteDataConfirmationDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        onConfirm={handleDeleteConfirm}
      />
      <PurgeVrchatFavoritesDialog
        open={showPurgeFavoritesDialog}
        onOpenChange={setShowPurgeFavoritesDialog}
        onRequestBackup={handleBackup}
      />
      <ImportFavoritesFromAccountDialog
        open={showImportFavoritesDialog}
        onOpenChange={setShowImportFavoritesDialog}
      />
    </div>
  )
}
