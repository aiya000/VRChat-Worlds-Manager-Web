import { expect, type Page } from '@playwright/test'

/**
 * Puts one world into the list straight through IndexedDB, and nothing into
 * `worldDetails`: opening the popup then has to ask VRChat, and what the fake
 * VRChat answers is the whole point of the specs that use this.
 */
export async function seedWorld(
  page: Page,
  world: { worldId: string; name: string; platform?: string[] },
) {
  await expect(page.locator('[data-sidebar="trigger"]')).toBeVisible()

  await page.evaluate(async ({ worldId, name, platform }) => {
    const openWithStores = async (): Promise<IDBDatabase> => {
      for (let attempt = 0; attempt < 100; attempt++) {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('VRChatWorldsManager')
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })
        if (db.objectStoreNames.contains('worlds')) {
          return db
        }
        db.close()
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      throw new Error('the worlds store never appeared')
    }

    const db = await openWithStores()
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(['worlds'], 'readwrite')
      transaction.objectStore('worlds').put({
        updatedAt: Date.now(),
        deletedAt: null,
        origin: 'test',
        worldId,
        name,
        thumbnailUrl: '/icons/1.png',
        authorName: 'someone',
        favorites: 1,
        lastUpdated: '2025-02-01',
        visits: 2,
        dateAdded: '2025-02-01T00:00:00.000Z',
        platform: platform ?? ['standalonewindows'],
        tags: [],
        capacity: 16,
        folderRefs: [],
      })
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    db.close()
  }, world)
}
