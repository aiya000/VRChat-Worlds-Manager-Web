import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useLocalization } from '@/hooks/use-localization'

/**
 * Says, once, that the worlds in the list were put there rather than added by
 * the reader.
 *
 * A dialog rather than a banner: it is the one thing on the screen worth
 * reading before anything is pressed, and it is shown exactly once -- a notice
 * that can be scrolled past would be missed by the people it is for.
 */
export function PresetWorldsNotice({
  open,
  onDismiss,
}: {
  open: boolean
  onDismiss: () => void
}) {
  const { t } = useLocalization()

  return (
    <AlertDialog open={open}>
      <AlertDialogContent data-testid="preset-worlds-notice">
        <AlertDialogHeader>
          <AlertDialogTitle>{t('preset-worlds:notice-title')}</AlertDialogTitle>
          <AlertDialogDescription className="whitespace-pre-line">
            {t('preset-worlds:notice-body')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onDismiss}>
            {t('general:close')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
