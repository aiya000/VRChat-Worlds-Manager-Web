import { Cloud, FolderOpen, HardDriveDownload, Sparkles } from 'lucide-react'
import type { FC, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { useLocalization } from '@/hooks/use-localization'

/**
 * Where the data on this device is going to come from.
 *
 * All four are offered together rather than one path plus a way out, because
 * the old screen's only option was also the one needing the most explanation
 * -- see #72. Someone who has never used the desktop app should be able to
 * recognise their own situation in this list without reading about worlds.json.
 */
export type RestoreSource = 'v2' | 'drive' | 'backup' | 'fresh'

const CHOICES: {
  source: RestoreSource
  icon: ReactNode
  titleKey: string
  descriptionKey: string
}[] = [
  // First because it is the commonest answer, and because the three below it
  // each ask "do you have X?" -- someone who has none of them should not have
  // to read all three to find that out.
  {
    source: 'fresh',
    icon: <Sparkles className="h-6 w-6" />,
    titleKey: 'setup-page:restore-source-fresh-title',
    descriptionKey: 'setup-page:restore-source-fresh-description',
  },
  {
    source: 'v2',
    icon: <HardDriveDownload className="h-6 w-6" />,
    titleKey: 'setup-page:restore-source-v2-title',
    descriptionKey: 'setup-page:restore-source-v2-description',
  },
  {
    source: 'drive',
    icon: <Cloud className="h-6 w-6" />,
    titleKey: 'setup-page:restore-source-drive-title',
    descriptionKey: 'setup-page:restore-source-drive-description',
  },
  {
    source: 'backup',
    icon: <FolderOpen className="h-6 w-6" />,
    titleKey: 'setup-page:restore-source-backup-title',
    descriptionKey: 'setup-page:restore-source-backup-description',
  },
]

export const RestoreSourceChoice: FC<{
  onChoose: (source: RestoreSource) => void
}> = ({ onChoose }) => {
  const { t } = useLocalization()

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {t('setup-page:restore-source-description')}
      </p>
      {CHOICES.map(({ source, icon, titleKey, descriptionKey }) => (
        <Button
          key={source}
          variant="outline"
          // Tall and full width on purpose: a VR controller aims a laser, and
          // these are the first real choice anyone makes in this app.
          className="h-auto w-full justify-start gap-4 whitespace-normal px-4 py-4 text-left"
          onClick={() => onChoose(source)}
        >
          <span className="mt-0.5 shrink-0 self-start text-muted-foreground">
            {icon}
          </span>
          <span className="flex flex-col gap-1">
            <span className="text-base font-medium">{t(titleKey)}</span>
            <span className="text-sm font-normal text-muted-foreground">
              {t(descriptionKey)}
            </span>
          </span>
        </Button>
      ))}
    </div>
  )
}
