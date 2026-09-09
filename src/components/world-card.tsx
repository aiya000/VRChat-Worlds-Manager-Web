import { Heart } from 'lucide-react'
import {
  CardSize,
  WorldCardFieldVisibility,
  WorldDisplayData,
} from '@/lib/commands'
import { useLocalization } from '@/hooks/use-localization'
import { formatDateTime } from '@/lib/utils'
import { usePatreonContext } from '@/contexts/patreon-context'
import { PlatformIndicator } from './platform-indicator'
import { KeptForInstanceMark } from './kept-for-instance-mark'

const defaultFieldVisibility: WorldCardFieldVisibility = {
  name: true,
  authorName: true,
  visits: true,
  lastUpdated: true,
  favorites: true,
}

interface WorldCardPreviewProps {
  size: CardSize
  world: WorldDisplayData
  fieldVisibility?: WorldCardFieldVisibility
  /**
   * Whether to draw the mark for a world kept only because an instance was
   * made in it (#173). Decided by the caller: on the list it follows the row,
   * on the search page a setting, and the previews never show it.
   */
  keptForInstanceMark?: boolean
}

export function WorldCardPreview(props: WorldCardPreviewProps) {
  const {
    size,
    world,
    fieldVisibility = defaultFieldVisibility,
    keptForInstanceMark = false,
  } = props
  const { t, language } = useLocalization()
  const { supporters } = usePatreonContext()
  const isSupporter = supporters.has(world.authorName)
  const sizeClasses: Record<CardSize, string> = {
    Compact: 'w-48 h-32',
    Normal: 'w-52 h-48',
    Expanded: 'w-64 h-64',
    Original: 'w-64 h-44',
  }

  return (
    <div
      className={`border rounded-lg shadow hover:shadow-md transition-all duration-300 ${sizeClasses[size]}`}
    >
      {/* The thumbnail is the box the two badges are placed in, so they land
          on its corners at every card size rather than at a fixed distance
          from the card's own edge. */}
      <div className="relative w-full h-2/3">
        <div className="absolute top-2 right-2 z-1 bg-black/50 rounded-full p-1">
          <PlatformIndicator platform={world.platform} />
        </div>
        {keptForInstanceMark && (
          <div className="absolute bottom-2 left-2 z-1">
            <KeptForInstanceMark size={size} />
          </div>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={world.thumbnailUrl}
          alt={world.name}
          className="w-full h-full object-cover rounded-t-lg"
          draggable="false"
          loading="lazy"
        />
      </div>

      {/* Various size renderings... */}

      {size === 'Compact' && (
        <div className="p-2">
          {fieldVisibility.name && (
            <h3 className="font-medium truncate">{world.name}</h3>
          )}
        </div>
      )}

      {size === 'Normal' && (
        <div className="p-2 space-y-1">
          {fieldVisibility.name && (
            <div className="flex items-center justify-between">
              <h3 className="font-medium truncate">{world.name}</h3>
            </div>
          )}
          {(fieldVisibility.authorName || fieldVisibility.favorites) && (
            <div className="flex items-center justify-between">
              {fieldVisibility.authorName && (
                <span
                  className={`text-sm truncate ${isSupporter ? 'text-pink-500 dark:text-pink-400' : 'text-muted-foreground'}`}
                >
                  {world.authorName}
                </span>
              )}
              {fieldVisibility.favorites && (
                <div className="flex items-center gap-1">
                  <Heart className="w-3.5 h-3.5" />
                  <span className="text-sm truncate">{world.favorites}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {size === 'Expanded' && (
        <div className="p-2 space-y-1">
          {fieldVisibility.name && (
            <div className="flex items-center justify-between">
              <h3 className="font-medium truncate">{world.name}</h3>
            </div>
          )}
          {(fieldVisibility.authorName || fieldVisibility.visits) && (
            <div className="flex items-center text-sm justify-between">
              {fieldVisibility.authorName && (
                <span
                  className={`truncate ${isSupporter ? 'text-pink-500 dark:text-pink-400' : 'text-muted-foreground'}`}
                >
                  {world.authorName}
                </span>
              )}
              {fieldVisibility.visits && (
                <span className="truncate text-muted-foreground">
                  {t('world-card:visits', world.visits)}
                </span>
              )}
            </div>
          )}
          {(fieldVisibility.lastUpdated || fieldVisibility.favorites) && (
            <div className="flex justify-between whitespace-nowrap">
              {fieldVisibility.lastUpdated && (
                <span className="text-sm text-muted-foreground truncate">
                  {t(
                    'world-card:updated',
                    formatDateTime(world.lastUpdated, language),
                  )}
                </span>
              )}
              {fieldVisibility.favorites && (
                <div className="flex items-center gap-1">
                  <Heart className="w-3.5 h-3.5" />
                  <span className="text-sm truncate">{world.favorites}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {size === 'Original' && (
        <div className="p-2">
          {fieldVisibility.name && (
            <h3 className="font-medium truncate">{world.name}</h3>
          )}
          {fieldVisibility.authorName && (
            <p
              className={`text-sm truncate ${isSupporter ? 'text-pink-500 dark:text-pink-400' : 'text-muted-foreground'}`}
            >
              {t('world-card:by-author', world.authorName)}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
