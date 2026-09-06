import { Effect } from 'effect'
// Shadows TypeScript's built-in `InstanceType<T>` utility on purpose: within
// this file the app's own instance type is the one that is meant.
import type { InstanceType } from '@/types/instances'
import {
  LaunchedInstanceService,
  type LaunchedInstanceInput,
} from './services/launched-instance-service'
import type { LaunchedInstanceRecord } from './services/db'
import {
  GoogleAuthDismissedError,
  GoogleAuthExpiredError,
  GoogleAuthService,
  GoogleAuthUnansweredError,
} from './services/google-auth-service'
import {
  DriveSyncService,
  type DriveSyncResult,
  type SyncProgress,
} from './services/drive-sync-service'
import { requestSettingsOverride } from './services/setting-sync'
import { AppLayer } from '@/lib/services/layers'
import { PreferencesService } from '@/lib/services/preferences'
import { FolderService } from '@/lib/services/folder-service'
import { WorldService } from '@/lib/services/world-service'
import {
  MemoService,
  type MemoConflictEntry,
} from '@/lib/services/memo-service'
import { CustomTagsService } from '@/lib/services/custom-tags-service'
import { AuthService } from '@/lib/services/auth-service'
import { BackupService, type RestoreMode } from '@/lib/services/backup-service'
import { MigrationService } from '@/lib/services/migration-service'
import { InitService } from '@/lib/services/init-service'
import { ExternalDataService } from '@/lib/services/external-data-service'
import { ShareService } from '@/lib/services/share-service'
import { TaskService } from '@/lib/services/task-service'
import { VRChatApiService } from '@/lib/services/vrchat-api'
import type { LaunchTarget } from '@/lib/launch-target'
import type {
  Result,
  BackupMetaData,
  CardSize,
  FilterItemSelectorStarredType,
  FolderData,
  FolderRemovalPreference,
  GroupInstancePermissionInfo,
  InstanceInfo,
  InstanceRegion,
  PatreonData,
  PatreonVRChatNames,
  Platform,
  PreviousMetadata,
  TaskStatus,
  UserGroup,
  WorldBlacklist,
  WorldCardFieldVisibility,
  WorldDetailFieldVisibility,
  WorldDetails,
  WorldDisplayData,
  TaskStatusChanged,
} from '@/lib/types'

function run<A>(
  effect: Effect.Effect<A, unknown, unknown>,
): Promise<Result<A, string>> {
  const provided = Effect.provide(effect, AppLayer) as Effect.Effect<
    A,
    unknown,
    never
  >
  return Effect.runPromise(
    provided.pipe(
      Effect.map((data): Result<A, string> => ({ status: 'ok', data })),
      Effect.catchAll((e: unknown) =>
        Effect.succeed({
          status: 'error' as const,
          error: e instanceof Error ? e.message : String(e),
        }),
      ),
    ),
  )
}

function runVoid(
  effect: Effect.Effect<void, unknown, unknown>,
): Promise<Result<null, string>> {
  const provided = Effect.provide(effect, AppLayer) as Effect.Effect<
    void,
    unknown,
    never
  >
  return Effect.runPromise(
    provided.pipe(
      Effect.map((): Result<null, string> => ({ status: 'ok', data: null })),
      Effect.catchAll((e: unknown) =>
        Effect.succeed({
          status: 'error' as const,
          error: e instanceof Error ? e.message : String(e),
        }),
      ),
    ),
  )
}

export const commands = {
  async fetchPatreonData(): Promise<Result<PatreonData, string>> {
    return run(
      Effect.gen(function* () {
        const svc = yield* ExternalDataService
        return yield* svc.fetchPatreonData()
      }),
    )
  },

  async fetchPatreonVrchatNames(): Promise<Result<PatreonVRChatNames, string>> {
    return run(
      Effect.gen(function* () {
        const svc = yield* ExternalDataService
        return yield* svc.fetchPatreonVrchatNames()
      }),
    )
  },

  async fetchBlacklist(): Promise<Result<WorldBlacklist, string>> {
    return run(
      Effect.gen(function* () {
        const svc = yield* ExternalDataService
        return yield* svc.fetchBlacklist()
      }),
    )
  },

  async getTaskStatus(id: string): Promise<Result<TaskStatus, string>> {
    return run(
      Effect.gen(function* () {
        const svc = yield* TaskService
        return yield* svc.getTaskStatus(id)
      }),
    )
  },

  async cancelTaskRequest(id: string): Promise<Result<TaskStatus, string>> {
    return run(
      Effect.gen(function* () {
        const svc = yield* TaskService
        return yield* svc.cancelTaskRequest(id)
      }),
    )
  },

  async getTaskError(id: string): Promise<Result<string | null, string>> {
    return run(
      Effect.gen(function* () {
        const svc = yield* TaskService
        return yield* svc.getTaskError(id)
      }),
    )
  },

  async addWorldToFolder(
    folderName: string,
    worldId: string,
  ): Promise<Result<null, string>> {
    return runVoid(
      Effect.gen(function* () {
        const svc = yield* WorldService
        yield* svc.addWorldToFolder(folderName, worldId)
      }),
    )
  },

  async removeWorldFromFolder(
    folderName: string,
    worldId: string,
  ): Promise<Result<null, string>> {
    return runVoid(
      Effect.gen(function* () {
        const svc = yield* WorldService
        yield* svc.removeWorldFromFolder(folderName, worldId)
      }),
    )
  },

  async hideWorld(worldId: string): Promise<Result<null, string>> {
    return runVoid(
      Effect.gen(function* () {
        const svc = yield* WorldService
        yield* svc.hideWorld(worldId)
      }),
    )
  },

  async unhideWorld(worldId: string): Promise<Result<null, string>> {
    return runVoid(
      Effect.gen(function* () {
        const svc = yield* WorldService
        yield* svc.unhideWorld(worldId)
      }),
    )
  },

  async getFolders(): Promise<Result<FolderData[], string>> {
    return run(
      Effect.gen(function* () {
        const svc = yield* FolderService
        return yield* svc.getFolders()
      }),
    )
  },

  async createFolder(name: string): Promise<Result<string, string>> {
    return run(
      Effect.gen(function* () {
        const svc = yield* FolderService
        return yield* svc.createFolder(name)
      }),
    )
  },

  async deleteFolder(name: string): Promise<Result<null, string>> {
    return runVoid(
      Effect.gen(function* () {
        const svc = yield* FolderService
        yield* svc.deleteFolder(name)
      }),
    )
  },

  async moveFolder(
    folderName: string,
    newIndex: number,
  ): Promise<Result<null, string>> {
    return runVoid(
      Effect.gen(function* () {
        const svc = yield* FolderService
        yield* svc.moveFolder(folderName, newIndex)
      }),
    )
  },

  async renameFolder(
    oldName: string,
    newName: string,
  ): Promise<Result<null, string>> {
    return runVoid(
      Effect.gen(function* () {
        const svc = yield* FolderService
        yield* svc.renameFolder(oldName, newName)
      }),
    )
  },

  async getWorlds(
    folderName: string,
  ): Promise<Result<WorldDisplayData[], string>> {
    return run(
      Effect.gen(function* () {
        const svc = yield* WorldService
        return yield* svc.getWorlds(folderName)
      }),
    )
  },

  async getAllWorlds(): Promise<Result<WorldDisplayData[], string>> {
    return run(
      Effect.gen(function* () {
        const svc = yield* WorldService
        return yield* svc.getAllWorlds()
      }),
    )
  },

  async getUnclassifiedWorlds(): Promise<Result<WorldDisplayData[], string>> {
    return run(
      Effect.gen(function* () {
        const svc = yield* WorldService
        return yield* svc.getUnclassifiedWorlds()
      }),
    )
  },

  async getHiddenWorlds(): Promise<Result<WorldDisplayData[], string>> {
    return run(
      Effect.gen(function* () {
        const svc = yield* WorldService
        return yield* svc.getHiddenWorlds()
      }),
    )
  },

  async getTagsByCount(): Promise<Result<string[], string>> {
    return run(
      Effect.gen(function* () {
        const svc = yield* CustomTagsService
        return yield* svc.getTagsByCount()
      }),
    )
  },

  async getAuthorsByCount(): Promise<Result<string[], string>> {
    return run(
      Effect.gen(function* () {
        const svc = yield* CustomTagsService
        return yield* svc.getAuthorsByCount()
      }),
    )
  },

  async deleteWorld(worldId: string): Promise<Result<null, string>> {
    return runVoid(
      Effect.gen(function* () {
        const svc = yield* WorldService
        yield* svc.deleteWorld(worldId)
      }),
    )
  },

  async getFoldersForWorld(worldId: string): Promise<Result<string[], string>> {
    return run(
      Effect.gen(function* () {
        const svc = yield* FolderService
        return yield* svc.getFoldersForWorld(worldId)
      }),
    )
  },

  async getCustomTags(worldId: string): Promise<Result<string[], string>> {
    return run(
      Effect.gen(function* () {
        const svc = yield* CustomTagsService
        return yield* svc.getCustomTags(worldId)
      }),
    )
  },

  async setCustomTags(
    worldId: string,
    tags: string[],
  ): Promise<Result<string[], string>> {
    return run(
      Effect.gen(function* () {
        const svc = yield* CustomTagsService
        return yield* svc.setCustomTags(worldId, tags)
      }),
    )
  },

  async shareFolder(folderName: string): Promise<Result<string, string>> {
    return run(
      Effect.gen(function* () {
        const svc = yield* ShareService
        return yield* svc.shareFolder(folderName)
      }),
    )
  },

  async updateFolderShare(
    folderName: string,
  ): Promise<Result<string | null, string>> {
    return run(
      Effect.gen(function* () {
        const svc = yield* ShareService
        return yield* svc.updateFolderShare(folderName)
      }),
    )
  },

  async downloadFolder(
    shareId: string,
  ): Promise<Result<[string, WorldDisplayData[]], string>> {
    return run(
      Effect.gen(function* () {
        const svc = yield* ShareService
        return yield* svc.downloadFolder(shareId)
      }),
    )
  },

  async getTheme(): Promise<Result<string, string>> {
    return run(
      Effect.gen(function* () {
        const svc = yield* PreferencesService
        return yield* svc.getTheme()
      }),
    )
  },

  async setTheme(theme: string): Promise<Result<null, string>> {
    return runVoid(
      Effect.gen(function* () {
        const svc = yield* PreferencesService
        yield* svc.setTheme(theme)
      }),
    )
  },

  async getLanguage(): Promise<Result<string, string>> {
    return run(
      Effect.gen(function* () {
        const svc = yield* PreferencesService
        return yield* svc.getLanguage()
      }),
    )
  },

  async setLanguage(language: string): Promise<Result<null, string>> {
    return runVoid(
      Effect.gen(function* () {
        const svc = yield* PreferencesService
        yield* svc.setLanguage(language)
      }),
    )
  },

  async getCardSize(): Promise<Result<CardSize, string>> {
    return run(
      Effect.gen(function* () {
        const svc = yield* PreferencesService
        return yield* svc.getCardSize()
      }),
    )
  },

  async setCardSize(cardSize: CardSize): Promise<Result<null, string>> {
    return runVoid(
      Effect.gen(function* () {
        const svc = yield* PreferencesService
        yield* svc.setCardSize(cardSize)
      }),
    )
  },

  async getRegion(): Promise<Result<InstanceRegion, string>> {
    return run(
      Effect.gen(function* () {
        const svc = yield* PreferencesService
        return yield* svc.getRegion()
      }),
    )
  },

  async setRegion(region: InstanceRegion): Promise<Result<null, string>> {
    return runVoid(
      Effect.gen(function* () {
        const svc = yield* PreferencesService
        yield* svc.setRegion(region)
      }),
    )
  },

  async getInstanceType(): Promise<Result<InstanceType, string>> {
    return run(
      Effect.gen(function* () {
        const svc = yield* PreferencesService
        return yield* svc.getInstanceType()
      }),
    )
  },

  async setInstanceType(
    instanceType: InstanceType,
  ): Promise<Result<null, string>> {
    return runVoid(
      Effect.gen(function* () {
        const svc = yield* PreferencesService
        yield* svc.setInstanceType(instanceType)
      }),
    )
  },

  async getStarredFilterItems(
    id: FilterItemSelectorStarredType,
  ): Promise<Result<string[], string>> {
    return run(
      Effect.gen(function* () {
        const svc = yield* PreferencesService
        return yield* svc.getStarredFilterItems(id)
      }),
    )
  },

  async setStarredFilterItems(
    id: FilterItemSelectorStarredType,
    values: string[],
  ): Promise<Result<null, string>> {
    return runVoid(
      Effect.gen(function* () {
        const svc = yield* PreferencesService
        yield* svc.setStarredFilterItems(id, values)
      }),
    )
  },

  async getFolderRemovalPreference(): Promise<
    Result<FolderRemovalPreference, string>
  > {
    return run(
      Effect.gen(function* () {
        const svc = yield* PreferencesService
        return yield* svc.getFolderRemovalPreference()
      }),
    )
  },

  async setFolderRemovalPreference(
    dontShowRemoveFromFolder: FolderRemovalPreference,
  ): Promise<Result<null, string>> {
    return runVoid(
      Effect.gen(function* () {
        const svc = yield* PreferencesService
        yield* svc.setFolderRemovalPreference(dontShowRemoveFromFolder)
      }),
    )
  },

  async getSortPreferences(): Promise<Result<[string, string], string>> {
    return run(
      Effect.gen(function* () {
        const svc = yield* PreferencesService
        return yield* svc.getSortPreferences()
      }),
    )
  },

  async setSortPreferences(
    sortField: string,
    sortDirection: string,
  ): Promise<Result<null, string>> {
    return runVoid(
      Effect.gen(function* () {
        const svc = yield* PreferencesService
        yield* svc.setSortPreferences(sortField, sortDirection)
      }),
    )
  },

  async getWorldCardFieldVisibility(): Promise<
    Result<WorldCardFieldVisibility, string>
  > {
    return run(
      Effect.gen(function* () {
        const svc = yield* PreferencesService
        return yield* svc.getWorldCardFieldVisibility()
      }),
    )
  },

  async setWorldCardFieldVisibility(
    visibility: WorldCardFieldVisibility,
  ): Promise<Result<null, string>> {
    return runVoid(
      Effect.gen(function* () {
        const svc = yield* PreferencesService
        yield* svc.setWorldCardFieldVisibility(visibility)
      }),
    )
  },

  async getWorldDetailFieldVisibility(): Promise<
    Result<WorldDetailFieldVisibility, string>
  > {
    return run(
      Effect.gen(function* () {
        const svc = yield* PreferencesService
        return yield* svc.getWorldDetailFieldVisibility()
      }),
    )
  },

  async setWorldDetailFieldVisibility(
    visibility: WorldDetailFieldVisibility,
  ): Promise<Result<null, string>> {
    return runVoid(
      Effect.gen(function* () {
        const svc = yield* PreferencesService
        yield* svc.setWorldDetailFieldVisibility(visibility)
      }),
    )
  },

  async tryLogin(): Promise<Result<null, string>> {
    return runVoid(
      Effect.gen(function* () {
        const svc = yield* VRChatApiService
        yield* svc.tryLogin()
      }),
    )
  },

  async loginWithCredentials(
    username: string,
    password: string,
  ): Promise<Result<null, string>> {
    return runVoid(
      Effect.gen(function* () {
        const svc = yield* VRChatApiService
        yield* svc.loginWithCredentials(username, password)
      }),
    )
  },

  async loginWith2fa(
    code: string,
    twoFactorType: string,
  ): Promise<Result<null, string>> {
    return runVoid(
      Effect.gen(function* () {
        const svc = yield* VRChatApiService
        yield* svc.loginWith2fa(code, twoFactorType)
      }),
    )
  },

  async logout(): Promise<Result<null, string>> {
    return runVoid(
      Effect.gen(function* () {
        const api = yield* VRChatApiService
        const auth = yield* AuthService
        yield* api.logout()
        yield* auth.clearAuth()
      }),
    )
  },

  async getFavoriteWorlds(): Promise<Result<null, string>> {
    return runVoid(
      Effect.gen(function* () {
        const api = yield* VRChatApiService
        const worlds = yield* WorldService
        const favorites = yield* api.getFavoriteWorlds()

        // Refreshing must not look like a re-add: a world already known
        // locally keeps the folders it was filed into and the date it first
        // appeared, and only its VRChat-owned fields are updated.
        const stored = yield* worlds.getAllWorlds()
        const storedByWorldId = new Map(
          stored.map((world) => [world.worldId, world]),
        )
        for (const favorite of favorites) {
          const existing = storedByWorldId.get(favorite.worldId)
          yield* worlds.putWorld(
            existing === undefined
              ? favorite
              : {
                  ...favorite,
                  dateAdded: existing.dateAdded,
                  folders: existing.folders,
                },
          )
        }
      }),
    )
  },

  async purgeAllVrchatFavorites(
    onProgress?: (done: number, total: number) => void,
  ): Promise<Result<{ deleted: number; failed: number }, string>> {
    return run(
      Effect.gen(function* () {
        const svc = yield* VRChatApiService
        return yield* svc.purgeAllFavoriteWorlds(onProgress)
      }),
    )
  },

  /**
   * Reads the signed-in account's favorites without touching the local
   * database, for the caller to show and let the user pick from.
   *
   * `getFavoriteWorlds` above stores what it reads, which is right when
   * refreshing your own list and wrong when the account signed in is somebody
   * else's.
   */
  async fetchFavoriteWorlds(
    onProgress?: (fetched: number) => void,
  ): Promise<Result<WorldDisplayData[], string>> {
    return run(
      Effect.gen(function* () {
        const svc = yield* VRChatApiService
        return yield* svc.getFavoriteWorlds(onProgress)
      }),
    )
  },

  async getCurrentUser(): Promise<
    Result<{ id: string; displayName: string }, string>
  > {
    return run(
      Effect.gen(function* () {
        const svc = yield* VRChatApiService
        return yield* svc.getCurrentUser()
      }),
    )
  },

  async putWorld(world: WorldDisplayData): Promise<Result<null, string>> {
    return runVoid(
      Effect.gen(function* () {
        const svc = yield* WorldService
        yield* svc.putWorld(world)
      }),
    )
  },

  async getWorld(
    worldId: string,
    dontSaveToLocal: boolean | null,
  ): Promise<Result<WorldDetails, string>> {
    return run(
      Effect.gen(function* () {
        const api = yield* VRChatApiService
        const worlds = yield* WorldService

        // Nothing but this ever fills the local world-details table, so asking
        // VRChat first is what makes a world openable at all; the cached copy
        // is the fallback for being offline, or for a world VRChat will no
        // longer serve because it stopped being public.
        return yield* api.getWorld(worldId).pipe(
          Effect.tap((world) =>
            dontSaveToLocal === true
              ? Effect.void
              : worlds.putWorldDetails(world),
          ),
          Effect.catchAll((remoteError) =>
            worlds
              .getWorld(worldId, dontSaveToLocal)
              .pipe(Effect.catchAll(() => Effect.fail(remoteError))),
          ),
        )
      }),
    )
  },

  async checkWorldInfo(worldId: string): Promise<Result<WorldDetails, string>> {
    return run(
      Effect.gen(function* () {
        const svc = yield* VRChatApiService
        return yield* svc.checkWorldInfo(worldId)
      }),
    )
  },

  async getRecentlyVisitedWorlds(): Promise<
    Result<WorldDisplayData[], string>
  > {
    return run(
      Effect.gen(function* () {
        const svc = yield* VRChatApiService
        return yield* svc.getRecentlyVisitedWorlds()
      }),
    )
  },

  async searchWorlds(
    sort: string,
    tags: string[],
    excludeTags: string[],
    search: string,
    page: number,
  ): Promise<Result<WorldDisplayData[], string>> {
    return run(
      Effect.gen(function* () {
        const svc = yield* VRChatApiService
        return yield* svc.searchWorlds(sort, tags, excludeTags, search, page)
      }),
    )
  },

  async createWorldInstance(
    worldId: string,
    instanceType: Exclude<InstanceType, 'group'>,
    region: InstanceRegion,
  ): Promise<Result<InstanceInfo, string>> {
    return run(
      Effect.gen(function* () {
        const svc = yield* VRChatApiService
        return yield* svc.createWorldInstance(worldId, instanceType, region)
      }),
    )
  },

  async getUserGroups(): Promise<Result<UserGroup[], string>> {
    return run(
      Effect.gen(function* () {
        const svc = yield* VRChatApiService
        return yield* svc.getUserGroups()
      }),
    )
  },

  async getPermissionForCreateGroupInstance(
    groupId: string,
  ): Promise<Result<GroupInstancePermissionInfo, string>> {
    return run(
      Effect.gen(function* () {
        const svc = yield* VRChatApiService
        return yield* svc.getPermissionForCreateGroupInstance(groupId)
      }),
    )
  },

  async createGroupInstance(
    worldId: string,
    groupId: string,
    instanceTypeStr: string,
    allowedRoles: string[] | null,
    regionStr: string,
    queueEnabled: boolean,
  ): Promise<Result<InstanceInfo, string>> {
    return run(
      Effect.gen(function* () {
        const svc = yield* VRChatApiService
        return yield* svc.createGroupInstance(
          worldId,
          groupId,
          instanceTypeStr,
          allowedRoles,
          regionStr,
          queueEnabled,
        )
      }),
    )
  },

  /**
   * `platforms` is what the world was built for, when the caller knows; it
   * decides whether an Android phone is handed the app or told there is no
   * Android build to open.
   */
  async openInstanceInClient(
    worldId: string,
    instanceId: string,
    platforms: Platform[] | null,
  ): Promise<Result<LaunchTarget, string>> {
    return run(
      Effect.gen(function* () {
        const svc = yield* VRChatApiService
        return yield* svc.openInstanceInClient(worldId, instanceId, platforms)
      }),
    )
  },

  /**
   * Remembers an instance so it can be entered again later.
   *
   * The only place a launch URL used to exist was the toast shown the moment
   * an instance was made, so closing it lost the instance for good -- and a
   * world that stops being public can only be entered through one.
   */
  async recordLaunchedInstance(
    input: LaunchedInstanceInput,
  ): Promise<Result<null, string>> {
    return run(
      Effect.gen(function* () {
        const svc = yield* LaunchedInstanceService
        yield* svc.recordLaunchedInstance(input)
        return null
      }),
    )
  },

  async getLaunchedInstances(
    worldId: string,
  ): Promise<Result<LaunchedInstanceRecord[], string>> {
    return run(
      Effect.gen(function* () {
        const svc = yield* LaunchedInstanceService
        return yield* svc.getLaunchedInstances(worldId)
      }),
    )
  },

  async forgetLaunchedInstance(id: string): Promise<Result<null, string>> {
    return run(
      Effect.gen(function* () {
        const svc = yield* LaunchedInstanceService
        yield* svc.forgetLaunchedInstance(id)
        return null
      }),
    )
  },

  async isGoogleDriveConnected(): Promise<Result<boolean, string>> {
    return run(
      Effect.gen(function* () {
        const svc = yield* GoogleAuthService
        return yield* svc.isConnected()
      }),
    )
  },

  /** Must be called from inside a click handler -- see `GoogleAuthService`. */
  async connectGoogleDrive(): Promise<Result<null, string>> {
    return run(
      Effect.gen(function* () {
        const svc = yield* GoogleAuthService
        yield* svc.connect()
        return null
      }),
    )
  },

  async disconnectGoogleDrive(): Promise<Result<null, string>> {
    return run(
      Effect.gen(function* () {
        const svc = yield* GoogleAuthService
        yield* svc.disconnect()
        return null
      }),
    )
  },

  /** Must be called from inside a click handler -- see `GoogleAuthService`. */
  async syncGoogleDriveNow(
    onProgress: SyncProgress = () => {},
  ): Promise<Result<DriveSyncResult, string>> {
    return run(
      Effect.gen(function* () {
        const auth = yield* GoogleAuthService
        const sync = yield* DriveSyncService

        onProgress('authorizing')
        const token = yield* auth.getAccessToken()

        return yield* sync
          .syncNow(token, onProgress)
          .pipe(
            Effect.map(
              (outcome): DriveSyncResult => ({ kind: 'synced', ...outcome }),
            ),
          )
      }).pipe(
        // Three ways of not getting a token that are worth telling apart on
        // screen: the hour ran out, the window was closed, and the window
        // never answered.
        Effect.catchAll((e) => {
          if (e instanceof GoogleAuthExpiredError) {
            return Effect.succeed<DriveSyncResult>({ kind: 'reauth-needed' })
          }
          if (e instanceof GoogleAuthDismissedError) {
            return Effect.succeed<DriveSyncResult>({ kind: 'dismissed' })
          }
          if (e instanceof GoogleAuthUnansweredError) {
            return Effect.succeed<DriveSyncResult>({ kind: 'unanswered' })
          }
          return Effect.fail(e)
        }),
      ),
    )
  },

  /**
   * Hands this device's settings to every other device, once.
   *
   * The demand is recorded and then an ordinary sync carries it: there is no
   * separate upload, and everything else in the snapshot -- worlds, folders,
   * memos -- is merged exactly as it always is. Nothing is deleted anywhere.
   *
   * Must be called from inside a click handler -- see `GoogleAuthService`.
   */
  async pushSettingsToAllDevices(
    onProgress: SyncProgress = () => {},
  ): Promise<Result<DriveSyncResult, string>> {
    // Recorded first and without an await: what follows needs the click that
    // called this to still count as a user gesture.
    requestSettingsOverride()
    return commands.syncGoogleDriveNow(onProgress)
  },

  /**
   * The same sync, started by the app rather than by a press.
   *
   * The only difference is where the token comes from: this runs on the one a
   * press already obtained, and reports `reauth-needed` when there is none.
   * It never opens Google's window -- see `getAccessTokenIfHeld`.
   */
  async syncGoogleDriveInBackground(): Promise<
    Result<DriveSyncResult, string>
  > {
    return run(
      Effect.gen(function* () {
        const auth = yield* GoogleAuthService
        const sync = yield* DriveSyncService

        const token = yield* auth.getAccessTokenIfHeld()

        return yield* sync
          .syncNow(token, () => {})
          .pipe(
            Effect.map(
              (outcome): DriveSyncResult => ({ kind: 'synced', ...outcome }),
            ),
          )
      }).pipe(
        Effect.catchAll((e) =>
          e instanceof GoogleAuthExpiredError
            ? Effect.succeed<DriveSyncResult>({ kind: 'reauth-needed' })
            : Effect.fail(e),
        ),
      ),
    )
  },

  /**
   * Whether another device has written to Drive since this one last did.
   *
   * `false` rather than an error when there is no token in hand: a poll that
   * cannot ask has nothing to report, and there is no press behind it to
   * explain the failure to. It must never obtain one of its own -- a window
   * opening sixty seconds after someone last touched the app is the bug this
   * whole path was rewritten for.
   */
  async googleDriveRemoteChanged(): Promise<Result<boolean, string>> {
    return run(
      Effect.gen(function* () {
        const auth = yield* GoogleAuthService
        const sync = yield* DriveSyncService

        const token = yield* auth.getAccessTokenIfHeld()
        return yield* sync.remoteChanged(token)
      }).pipe(
        Effect.catchAll((e) =>
          e instanceof GoogleAuthExpiredError
            ? Effect.succeed(false)
            : Effect.fail(e),
        ),
      ),
    )
  },

  async googleDriveLastSyncedAt(): Promise<Result<number | null, string>> {
    return run(
      Effect.gen(function* () {
        const svc = yield* DriveSyncService
        return yield* svc.lastSyncedAt()
      }),
    )
  },

  async openLogsDirectory(): Promise<Result<null, string>> {
    return { status: 'ok', data: null }
  },

  async openFolderDirectory(): Promise<Result<null, string>> {
    return { status: 'ok', data: null }
  },

  async requireInitialSetup(): Promise<boolean> {
    const result = await run(
      Effect.gen(function* () {
        const svc = yield* InitService
        return yield* svc.requireInitialSetup()
      }),
    )
    return result.status === 'ok' ? result.data : true
  },

  async checkFilesLoaded(): Promise<Result<boolean, string>> {
    return run(
      Effect.gen(function* () {
        const svc = yield* InitService
        return yield* svc.checkFilesLoaded()
      }),
    )
  },

  async passPaths(): Promise<Result<string, string>> {
    return { status: 'ok', data: '' }
  },

  async checkExistingData(): Promise<Result<[boolean, boolean], string>> {
    return run(
      Effect.gen(function* () {
        const svc = yield* InitService
        return yield* svc.checkExistingData()
      }),
    )
  },

  async getBackupMetadata(
    _backupPath: string,
  ): Promise<Result<BackupMetaData, string>> {
    return {
      status: 'error',
      error: 'Use getBackupMetadataFromFile for web version',
    }
  },

  async getBackupMetadataFromFile(
    file: File,
  ): Promise<Result<BackupMetaData, string>> {
    return run(
      Effect.gen(function* () {
        const svc = yield* BackupService
        return yield* svc.getBackupMetadataFromFile(file)
      }),
    )
  },

  async getMigrationMetadataFromFiles(
    worldsFile: File,
    foldersFile: File,
  ): Promise<Result<PreviousMetadata, string>> {
    return run(
      Effect.gen(function* () {
        const svc = yield* MigrationService
        return yield* svc.getMigrationMetadata(worldsFile, foldersFile)
      }),
    )
  },

  async createEmptyAuth(): Promise<Result<null, string>> {
    return runVoid(
      Effect.gen(function* () {
        const svc = yield* InitService
        yield* svc.createEmptyAuth()
      }),
    )
  },

  async createEmptyFiles(): Promise<Result<null, string>> {
    return runVoid(
      Effect.gen(function* () {
        const svc = yield* InitService
        yield* svc.createEmptyFiles()
      }),
    )
  },

  async createBackup(_backupPath?: string): Promise<Result<null, string>> {
    return runVoid(
      Effect.gen(function* () {
        const svc = yield* BackupService
        yield* svc.createBackup()
      }),
    )
  },

  async restoreFromBackup(
    _backupPathOrFile: string | File,
  ): Promise<Result<null, string>> {
    return {
      status: 'error',
      error: 'Use restoreFromBackupFile for web version',
    }
  },

  async restoreFromBackupFile(
    file: File,
    mode: RestoreMode = 'merge',
  ): Promise<Result<null, string>> {
    return runVoid(
      Effect.gen(function* () {
        const svc = yield* BackupService
        yield* svc.restoreFromBackup(file, mode)
      }),
    )
  },

  async migrateDataFromFiles(
    worldsFile: File,
    foldersFile: File,
  ): Promise<Result<null, string>> {
    return runVoid(
      Effect.gen(function* () {
        const svc = yield* MigrationService
        yield* svc.migrateData(worldsFile, foldersFile)
      }),
    )
  },

  async deleteData(): Promise<Result<null, string>> {
    return runVoid(
      Effect.gen(function* () {
        const svc = yield* InitService
        yield* svc.deleteData()
      }),
    )
  },

  async getMemo(worldId: string): Promise<Result<string, string>> {
    return run(
      Effect.gen(function* () {
        const svc = yield* MemoService
        return yield* svc.getMemo(worldId)
      }),
    )
  },

  async setMemoAndSave(
    worldId: string,
    memo: string,
  ): Promise<Result<null, string>> {
    return runVoid(
      Effect.gen(function* () {
        const svc = yield* MemoService
        yield* svc.setMemoAndSave(worldId, memo)
      }),
    )
  },

  async listMemoConflicts(): Promise<Result<MemoConflictEntry[], string>> {
    return run(
      Effect.gen(function* () {
        const svc = yield* MemoService
        return yield* svc.listMemoConflicts()
      }),
    )
  },

  async discardMemoBackup(worldId: string): Promise<Result<null, string>> {
    return runVoid(
      Effect.gen(function* () {
        const svc = yield* MemoService
        yield* svc.discardMemoBackup(worldId)
      }),
    )
  },

  async restoreMemoBackup(worldId: string): Promise<Result<null, string>> {
    return runVoid(
      Effect.gen(function* () {
        const svc = yield* MemoService
        yield* svc.restoreMemoBackup(worldId)
      }),
    )
  },

  async searchMemoText(searchText: string): Promise<Result<string[], string>> {
    return run(
      Effect.gen(function* () {
        const svc = yield* MemoService
        return yield* svc.searchMemoText(searchText)
      }),
    )
  },

  async sortWorldsDisplay(
    worlds: WorldDisplayData[],
    sortField: string,
    sortDirection: string,
  ): Promise<Result<WorldDisplayData[], string>> {
    return run(
      Effect.gen(function* () {
        const svc = yield* WorldService
        return yield* svc.sortWorldsDisplay(worlds, sortField, sortDirection)
      }),
    )
  },
}

// Web-compatible events using EventTarget
const eventTarget = new EventTarget()

export const events = {
  taskStatusChanged: {
    listen: (
      cb: (event: { payload: TaskStatusChanged }) => void,
    ): (() => void) => {
      const handler = (e: Event) => {
        cb({ payload: (e as CustomEvent).detail })
      }
      eventTarget.addEventListener('taskStatusChanged', handler)
      return () => {
        eventTarget.removeEventListener('taskStatusChanged', handler)
      }
    },
    once: (
      cb: (event: { payload: TaskStatusChanged }) => void,
    ): (() => void) => {
      const handler = (e: Event) => {
        cb({ payload: (e as CustomEvent).detail })
      }
      eventTarget.addEventListener('taskStatusChanged', handler, {
        once: true,
      })
      return () => {
        eventTarget.removeEventListener('taskStatusChanged', handler)
      }
    },
    emit: (payload: TaskStatusChanged): void => {
      eventTarget.dispatchEvent(
        new CustomEvent('taskStatusChanged', { detail: payload }),
      )
    },
  },
}

// Re-export all types for compatibility
export type {
  Result,
  BackupMetaData,
  CardSize,
  FilterItemSelectorStarredType,
  FolderData,
  FolderRemovalPreference,
  GroupInstanceCreateAllowedType,
  GroupInstanceCreatePermission,
  GroupInstancePermissionInfo,
  GroupMemberVisibility,
  GroupPermission,
  GroupRole,
  InstanceInfo,
  InstanceRegion,
  PatreonData,
  PatreonVRChatNames,
  Platform,
  PreviousMetadata,
  TaskStatus,
  TaskStatusChanged,
  UserGroup,
  WorldBlacklist,
  WorldCardFieldVisibility,
  WorldDetailFieldVisibility,
  WorldDetails,
  WorldDisplayData,
} from '@/lib/types'
