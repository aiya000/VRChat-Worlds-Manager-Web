import { Layer } from 'effect'
import { PreferencesServiceLive } from './preferences'
import { FolderServiceLive } from './folder-service'
import { WorldServiceLive } from './world-service'
import { MemoServiceLive } from './memo-service'
import { CustomTagsServiceLive } from './custom-tags-service'
import { AuthServiceLive } from './auth-service'
import { BackupServiceLive } from './backup-service'
import { MigrationServiceLive } from './migration-service'
import { InitServiceLive } from './init-service'
import { ExternalDataServiceLive } from './external-data-service'
import { ShareServiceLive } from './share-service'
import { TaskServiceLive } from './task-service'
import { VRChatApiServiceLive } from './vrchat-api'
import { QuotaServiceLive } from './quota-manager'
import { LaunchedInstanceServiceLive } from './launched-instance-service'
import { GoogleAuthServiceLive } from './google-auth-service'
import { DriveSyncServiceLive } from './drive-sync-service'

export const AppLayer = Layer.mergeAll(
  PreferencesServiceLive,
  FolderServiceLive,
  WorldServiceLive,
  MemoServiceLive,
  CustomTagsServiceLive,
  AuthServiceLive,
  BackupServiceLive,
  MigrationServiceLive,
  InitServiceLive,
  ExternalDataServiceLive,
  ShareServiceLive,
  TaskServiceLive,
  VRChatApiServiceLive,
  QuotaServiceLive,
  LaunchedInstanceServiceLive,
  GoogleAuthServiceLive,
  DriveSyncServiceLive,
)
