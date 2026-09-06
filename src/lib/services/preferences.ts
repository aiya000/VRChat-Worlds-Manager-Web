import { Context, Effect, Layer } from 'effect'
import { markSettingUpdated } from './setting-sync'
import type {
  CardSize,
  FilterItemSelectorStarredType,
  FolderRemovalPreference,
  InstanceRegion,
  WorldCardFieldVisibility,
  WorldDetailFieldVisibility,
} from '@/lib/types'
import type { InstanceType } from '@/types/instances'

const defaultWorldCardFieldVisibility: WorldCardFieldVisibility = {
  name: true,
  authorName: true,
  visits: true,
  lastUpdated: true,
  favorites: true,
}

const defaultWorldDetailFieldVisibility: WorldDetailFieldVisibility = {
  visits: true,
  favorites: true,
  capacity: true,
  published: true,
  lastUpdated: true,
}

export class PreferencesService extends Context.Tag('PreferencesService')<
  PreferencesService,
  {
    readonly getTheme: () => Effect.Effect<string>
    readonly setTheme: (theme: string) => Effect.Effect<void>
    readonly getLanguage: () => Effect.Effect<string>
    readonly setLanguage: (language: string) => Effect.Effect<void>
    readonly getCardSize: () => Effect.Effect<CardSize>
    readonly setCardSize: (cardSize: CardSize) => Effect.Effect<void>
    readonly getRegion: () => Effect.Effect<InstanceRegion>
    readonly setRegion: (region: InstanceRegion) => Effect.Effect<void>
    readonly getInstanceType: () => Effect.Effect<InstanceType>
    readonly setInstanceType: (
      instanceType: InstanceType,
    ) => Effect.Effect<void>
    readonly getStarredFilterItems: (
      id: FilterItemSelectorStarredType,
    ) => Effect.Effect<string[]>
    readonly setStarredFilterItems: (
      id: FilterItemSelectorStarredType,
      values: string[],
    ) => Effect.Effect<void>
    readonly getFolderRemovalPreference: () => Effect.Effect<FolderRemovalPreference>
    readonly setFolderRemovalPreference: (
      pref: FolderRemovalPreference,
    ) => Effect.Effect<void>
    readonly getSortPreferences: () => Effect.Effect<[string, string]>
    readonly setSortPreferences: (
      sortField: string,
      sortDirection: string,
    ) => Effect.Effect<void>
    readonly getWorldCardFieldVisibility: () => Effect.Effect<WorldCardFieldVisibility>
    readonly setWorldCardFieldVisibility: (
      visibility: WorldCardFieldVisibility,
    ) => Effect.Effect<void>
    readonly getWorldDetailFieldVisibility: () => Effect.Effect<WorldDetailFieldVisibility>
    readonly setWorldDetailFieldVisibility: (
      visibility: WorldDetailFieldVisibility,
    ) => Effect.Effect<void>
  }
>() {}

function getItem<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') {
    return fallback
  }
  const raw = localStorage.getItem(key)
  if (raw === null) {
    return fallback
  }
  try {
    return JSON.parse(raw) as T
  } catch {
    return raw as unknown as T
  }
}

function setItem(key: string, value: unknown): void {
  if (typeof window === 'undefined') {
    return
  }
  localStorage.setItem(key, JSON.stringify(value))
  // Every preference write goes through here, which is the only place a
  // timestamp can be recorded without callers having to remember to. A setting
  // with no timestamp reads as unknown-age and loses every merge.
  markSettingUpdated(key)
}

export const PreferencesServiceLive = Layer.succeed(PreferencesService, {
  getTheme: () => Effect.succeed(getItem<string>('theme', 'system')),
  setTheme: (theme) => Effect.sync(() => setItem('theme', theme)),
  getLanguage: () => Effect.succeed(getItem<string>('language', 'ja-JP')),
  setLanguage: (language) => Effect.sync(() => setItem('language', language)),
  getCardSize: () => Effect.succeed(getItem<CardSize>('cardSize', 'Normal')),
  setCardSize: (cardSize) => Effect.sync(() => setItem('cardSize', cardSize)),
  getRegion: () => Effect.succeed(getItem<InstanceRegion>('region', 'us')),
  setRegion: (region) => Effect.sync(() => setItem('region', region)),
  getInstanceType: () =>
    Effect.succeed(getItem<InstanceType>('instanceType', 'public')),
  setInstanceType: (instanceType) =>
    Effect.sync(() => setItem('instanceType', instanceType)),
  getStarredFilterItems: (id) =>
    Effect.succeed(getItem<string[]>(`starredFilterItems_${id}`, [])),
  setStarredFilterItems: (id, values) =>
    Effect.sync(() => setItem(`starredFilterItems_${id}`, values)),
  getFolderRemovalPreference: () =>
    Effect.succeed(
      getItem<FolderRemovalPreference>('folderRemovalPreference', 'ask'),
    ),
  setFolderRemovalPreference: (pref) =>
    Effect.sync(() => setItem('folderRemovalPreference', pref)),
  getSortPreferences: () =>
    Effect.succeed(
      getItem<[string, string]>('sortPreferences', ['dateAdded', 'desc']),
    ),
  setSortPreferences: (sortField, sortDirection) =>
    Effect.sync(() => setItem('sortPreferences', [sortField, sortDirection])),
  getWorldCardFieldVisibility: () =>
    Effect.succeed(
      getItem<WorldCardFieldVisibility>(
        'worldCardFieldVisibility',
        defaultWorldCardFieldVisibility,
      ),
    ),
  setWorldCardFieldVisibility: (visibility) =>
    Effect.sync(() => setItem('worldCardFieldVisibility', visibility)),
  getWorldDetailFieldVisibility: () =>
    Effect.succeed(
      getItem<WorldDetailFieldVisibility>(
        'worldDetailFieldVisibility',
        defaultWorldDetailFieldVisibility,
      ),
    ),
  setWorldDetailFieldVisibility: (visibility) =>
    Effect.sync(() => setItem('worldDetailFieldVisibility', visibility)),
})
