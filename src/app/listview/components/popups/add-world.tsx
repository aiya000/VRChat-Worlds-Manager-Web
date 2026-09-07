import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlertCircle, Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { commands, WorldDetails } from '@/lib/commands'
import {
  instanceTypeIn,
  parseWorldReference,
  regionIn,
  type WorldReference,
} from '@/lib/world-input'
import { instanceTypeLabelKey } from '@/lib/sync/launched-instances'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { WorldCardPreview } from '@/components/world-card'
import { useLocalization } from '@/hooks/use-localization'
import { formatDate } from '@/lib/utils'
import { useWorlds } from '../../hook/use-worlds'
import { FolderType, isUserFolder } from '@/types/folders'
import { toast } from 'sonner'

interface AddWorldPopupProps {
  currentFolder: FolderType
  onClose: () => void
}

export function AddWorldPopup({ onClose, currentFolder }: AddWorldPopupProps) {
  const { t, language } = useLocalization()
  const [worldInput, setWorldInput] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [previewWorld, setPreviewWorld] = useState<WorldDetails | null>(null)
  const [isDuplicate, setIsDuplicate] = useState<boolean>(false)
  const [existingWorlds, setExistingWorlds] = useState<string[]>([])
  // Set when VRChat answered with nothing for a world that was named clearly
  // enough to be added anyway -- see `handleConfirm`.
  const [unavailable, setUnavailable] = useState<WorldReference | null>(null)
  const [manualName, setManualName] = useState<string>('')
  // What the last check resolved to, kept so the instance in it survives the
  // trip to the confirm button.
  const [reference, setReference] = useState<WorldReference | null>(null)

  const { addWorld, getAllWorlds, refresh } = useWorlds(currentFolder)

  /**
   * Saves a world VRChat would not describe, under the name the reader gave it.
   *
   * The usual path asks VRChat for the world first and fails when it answers
   * with nothing, which is exactly what happens for a world that is not
   * public. Here the record is written from what is known: the id, and a name.
   */
  const addUnavailableWorld = async (ref: WorldReference, name: string) => {
    const stored = await commands.rememberWorld({
      worldId: ref.worldId,
      name,
      thumbnailUrl: '',
      authorName: '',
      favorites: 0,
      lastUpdated: '',
      visits: 0,
      dateAdded: new Date().toISOString(),
      platform: [],
      folders: [],
      tags: [],
      capacity: 0,
    })
    if (stored.status === 'error') {
      toast(t('general:error-title'), {
        description: t('listview-page:error-add-world'),
      })
      return
    }

    if (isUserFolder(currentFolder)) {
      await commands.addWorldToFolder(currentFolder, ref.worldId)
    }
    await refresh()
    toast(t('listview-page:world-added-title'), {
      description: t('listview-page:world-added-description'),
    })
  }

  useEffect(() => {
    async function fetchWorlds() {
      setIsLoading(true)
      try {
        const worlds = await getAllWorlds()
        setExistingWorlds(worlds.map((world) => world.worldId))
      } catch (_e) {
      } finally {
        setIsLoading(false)
      }
    }
    fetchWorlds()
  }, [getAllWorlds])

  const handleCheckWorldId = async (input: string) => {
    setIsLoading(true)
    setError(null)
    setPreviewWorld(null)
    setUnavailable(null)
    setManualName('')
    setIsDuplicate(false)

    const reference = parseWorldReference(input)

    if (reference === null) {
      setError(t('add-world-dialog:invalid-input'))
      setIsLoading(false)
      return
    }

    if (existingWorlds.includes(reference.worldId)) {
      setIsDuplicate(true)
    }

    try {
      const worldDetails = await commands.checkWorldInfo(reference.worldId)
      if (worldDetails.status === 'ok') {
        setPreviewWorld(worldDetails.data)
        setReference(reference)
      } else {
        // A world VRChat will not describe is still a world someone can be in,
        // and the launch URL needs no more than the ids. So rather than
        // refusing, ask for a name and add it with what is known.
        setUnavailable(reference)
      }
    } catch (err) {
      setError(`Failed to fetch world details: ${err}`)
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Keeps the instance with the world, so it can be entered from the world
   * detail afterwards. Nothing is asked of VRChat: the row is the two ids.
   */
  const rememberInstance = async (ref: WorldReference) => {
    if (ref.instanceId === null) {
      return
    }
    const result = await commands.recordLaunchedInstance({
      worldId: ref.worldId,
      instanceId: ref.instanceId,
      shortName: null,
      instanceType: instanceTypeIn(ref.instanceId),
      region: regionIn(ref.instanceId),
    })
    if (result.status === 'error') {
      console.error(`Failed to remember instance: ${result.error}`)
    }
  }

  const handleConfirm = async () => {
    if (previewWorld !== null && reference !== null) {
      await addWorld(previewWorld.worldId)
      await rememberInstance(reference)
      handleCancel()
      return
    }

    if (unavailable !== null) {
      await addUnavailableWorld(unavailable, manualName.trim())
      await rememberInstance(unavailable)
      handleCancel()
    }
  }

  /** The instance's kind in the app's own words, falling back to VRChat's. */
  const labelForInstance = (instanceId: string): string => {
    const instanceType = instanceTypeIn(instanceId)
    const key = instanceTypeLabelKey(instanceType)
    return key === null ? instanceType : t(key)
  }

  const handleCancel = () => {
    setWorldInput('')
    setError(null)
    setPreviewWorld(null)
    setUnavailable(null)
    setManualName('')
    setReference(null)
    setIsDuplicate(false)
    onClose()
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          handleCancel()
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('add-world-dialog:add')}</DialogTitle>
          <DialogDescription>
            {t('add-world-dialog:description')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Input
              id="world-id"
              value={worldInput}
              onChange={(e) => setWorldInput(e.target.value)}
              placeholder={t('add-world-dialog:placeholder')}
              className="col-span-3"
              autoFocus
            />
            <Button
              variant="outline"
              className="col-span-1"
              onClick={() => handleCheckWorldId(worldInput)}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t('add-world-dialog:check')
              )}
            </Button>
          </div>

          {/* Error message */}
          {error && (
            <Alert variant="destructive" className="col-span-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* A world VRChat would not describe: named by hand, added anyway */}
          {unavailable !== null && (
            <Card className="col-span-4" data-testid="world-unavailable">
              <CardHeader>
                <CardTitle className="text-base">
                  {t('add-world-dialog:unavailable-title')}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="text-sm text-muted-foreground">
                  {t('add-world-dialog:unavailable-description')}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="manual-world-name">
                    {t('add-world-dialog:name-label')}
                  </Label>
                  <Input
                    id="manual-world-name"
                    data-testid="manual-world-name"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder={t('add-world-dialog:name-placeholder')}
                    autoFocus
                  />
                </div>
                {unavailable.instanceId !== null && (
                  <div
                    className="flex flex-col gap-1 text-sm text-muted-foreground"
                    data-testid="instance-found"
                  >
                    <div>{t('add-world-dialog:instance-found')}</div>
                    <div>
                      {t('add-world-dialog:instance-type')}:{' '}
                      {labelForInstance(unavailable.instanceId)}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* World preview card */}
          {previewWorld && (
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>{t('add-world-dialog:preview')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between">
                  <WorldCardPreview
                    size="Normal"
                    world={{
                      worldId: previewWorld.worldId,
                      name: previewWorld.name,
                      thumbnailUrl: previewWorld.thumbnailUrl,
                      authorName: previewWorld.authorName,
                      favorites: previewWorld.favorites,
                      lastUpdated: previewWorld.lastUpdated,
                      visits: previewWorld.visits,
                      dateAdded: '',
                      platform: previewWorld.platform,
                      folders: [],
                      tags: previewWorld.tags || [],
                      capacity: previewWorld.capacity,
                    }}
                  />
                  <div className="flex flex-col gap-4">
                    <div>
                      <div className="text-sm font-semibold mb-2">
                        {t('world-detail:details')}
                      </div>
                      <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                        <div className="text-gray-500">
                          {' '}
                          {t('add-world-dialog:author')}{' '}
                        </div>
                        <div className="truncate w-[100px]">
                          {previewWorld.authorName}
                        </div>

                        <div className="text-gray-500">
                          {t('world-detail:visits')}
                        </div>
                        <div>{previewWorld.visits}</div>

                        <div className="text-gray-500">
                          {t('world-detail:capacity')}
                        </div>
                        <div>
                          {previewWorld.recommendedCapacity
                            ? `${previewWorld.recommendedCapacity} (${t('world-detail:max')} ${previewWorld.capacity})`
                            : previewWorld.capacity}
                        </div>

                        {previewWorld.publicationDate && (
                          <>
                            <div className="text-gray-500">
                              {t('world-detail:published')}
                            </div>
                            <div>
                              {formatDate(
                                previewWorld.publicationDate,
                                language,
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Duplicate warning */}
          {isDuplicate && (
            <Alert className="col-span-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="pt-1">
                {t('add-world-dialog:duplicate-warning')}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex justify-between">
          <Button variant="outline" onClick={handleCancel}>
            {t('general:cancel')}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={
              isLoading ||
              !worldInput ||
              error !== null ||
              isDuplicate ||
              (previewWorld === null &&
                (unavailable === null || manualName.trim() === ''))
            }
          >
            {t('add-world-dialog:add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
