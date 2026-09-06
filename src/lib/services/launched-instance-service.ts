import { Context, Effect, Layer } from 'effect'
import {
  beyondTheLimit,
  launchedInstanceId,
  newestFirst,
} from '@/lib/sync/launched-instances'
import { db, isActive, type LaunchedInstanceRecord } from './db'
import { tombstoned, touched } from './sync-meta'

export interface LaunchedInstanceInput {
  worldId: string
  instanceId: string
  shortName: string | null
  instanceType: string
  region: string
}

export class LaunchedInstanceService extends Context.Tag(
  'LaunchedInstanceService',
)<
  LaunchedInstanceService,
  {
    readonly recordLaunchedInstance: (
      input: LaunchedInstanceInput,
    ) => Effect.Effect<void, Error>
    readonly getLaunchedInstances: (
      worldId: string,
    ) => Effect.Effect<LaunchedInstanceRecord[], Error>
    readonly forgetLaunchedInstance: (id: string) => Effect.Effect<void, Error>
  }
>() {}

async function activeFor(worldId: string): Promise<LaunchedInstanceRecord[]> {
  const rows = await db.launchedInstances
    .where('worldId')
    .equals(worldId)
    .toArray()
  return newestFirst(rows.filter(isActive))
}

export const LaunchedInstanceServiceLive = Layer.succeed(
  LaunchedInstanceService,
  {
    recordLaunchedInstance: (input) =>
      Effect.tryPromise({
        try: async () => {
          const id = launchedInstanceId(input.worldId, input.instanceId)
          const existing = await db.launchedInstances.get(id)

          await db.launchedInstances.put({
            ...(await touched()),
            id,
            worldId: input.worldId,
            instanceId: input.instanceId,
            shortName: input.shortName,
            instanceType: input.instanceType,
            region: input.region,
            // Recording the same instance again keeps the moment it was made:
            // the list is ordered by when an instance came into being, not by
            // when it was last opened.
            launchedAt: existing?.launchedAt ?? Date.now(),
          })

          // Pruning writes a tombstone rather than removing the row, or the
          // other device would hand it straight back on the next merge.
          for (const stale of beyondTheLimit(await activeFor(input.worldId))) {
            await db.launchedInstances.update(stale.id, await tombstoned())
          }
        },
        catch: (e) => new Error(`Failed to record instance: ${e}`),
      }),

    getLaunchedInstances: (worldId) =>
      Effect.tryPromise({
        try: () => activeFor(worldId),
        catch: (e) => new Error(`Failed to get instances: ${e}`),
      }),

    forgetLaunchedInstance: (id) =>
      Effect.tryPromise({
        try: async () => {
          await db.launchedInstances.update(id, await tombstoned())
        },
        catch: (e) => new Error(`Failed to forget instance: ${e}`),
      }),
  },
)
