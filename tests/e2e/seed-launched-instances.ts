import { expect, type Page } from '@playwright/test'

export const WORLD_ID = 'wrld_e2e_launched'

/**
 * Puts a world and two instances of it straight into the database, so the popup
 * has something to show without an instance having to be made against VRChat.
 *
 * `worldDetails` is seeded alongside because opening the popup asks VRChat
 * first and falls back to that table, which is what happens here with no
 * session to ask with.
 */
export async function seedWorldWithInstances(
  page: Page,
  options: { platform?: string[] } = {},
) {
  await expect(page.locator('[data-sidebar="trigger"]')).toBeVisible()

  const platform = options.platform ?? ['standalonewindows']

  await page.evaluate(
    async ({ worldId, platform }) => {
      const openWithStores = async (): Promise<IDBDatabase> => {
        for (let attempt = 0; attempt < 100; attempt++) {
          const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open('VRChatWorldsManager')
            request.onsuccess = () => resolve(request.result)
            request.onerror = () => reject(request.error)
          })
          if (
            db.objectStoreNames.contains('worlds') &&
            db.objectStoreNames.contains('worldDetails') &&
            db.objectStoreNames.contains('launchedInstances')
          ) {
            return db
          }
          db.close()
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
        throw new Error('the stores never appeared')
      }

      const db = await openWithStores()
      const meta = { updatedAt: Date.now(), deletedAt: null, origin: 'test' }

      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(
          ['worlds', 'worldDetails', 'launchedInstances'],
          'readwrite',
        )
        transaction.objectStore('worlds').put({
          ...meta,
          worldId,
          name: 'Launched World',
          thumbnailUrl: '/icons/1.png',
          authorName: 'someone',
          favorites: 1,
          lastUpdated: '2025-02-01',
          visits: 2,
          dateAdded: '2025-02-01T00:00:00.000Z',
          platform,
          tags: [],
          capacity: 16,
          folderRefs: [],
        })
        transaction.objectStore('worldDetails').put({
          worldId,
          name: 'Launched World',
          thumbnailUrl: '/icons/1.png',
          authorName: 'someone',
          authorId: 'usr_test',
          favorites: 1,
          lastUpdated: '2025-02-01',
          visits: 2,
          platform,
          description: 'seeded',
          tags: [],
          capacity: 16,
          recommendedCapacity: null,
          publicationDate: null,
        })

        const instances = transaction.objectStore('launchedInstances')
        instances.put({
          ...meta,
          id: `${worldId}:11111`,
          worldId,
          instanceId: '11111',
          shortName: null,
          instanceType: 'public',
          region: 'jp',
          launchedAt: 1000,
        })
        instances.put({
          ...meta,
          id: `${worldId}:22222`,
          worldId,
          instanceId: '22222',
          shortName: null,
          instanceType: 'friends',
          region: 'use',
          launchedAt: 2000,
        })

        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
      })
      db.close()
    },
    { worldId: WORLD_ID, platform },
  )
}
