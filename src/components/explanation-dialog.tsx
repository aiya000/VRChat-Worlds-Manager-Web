'use client'

import type { FC, ReactNode } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { useLocalization } from '@/hooks/use-localization'

export interface ExplanationSection {
  title: string
  body: string
}

/**
 * A few titled paragraphs that say what a button does, before or instead of
 * pressing it.
 *
 * With `primary` it stands in front of an action and offers to go on; without
 * one it only closes. `dontShowAgain` adds the checkbox a first-run version
 * needs -- unchecked by default, so someone who skims past it sees it again
 * next time rather than never.
 */
export const ExplanationDialog: FC<{
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  sections: ExplanationSection[]
  primary?: { label: string; onClick: () => void }
  dontShowAgain?: { checked: boolean; onChange: (checked: boolean) => void }
  testId?: string
  children?: ReactNode
}> = ({
  open,
  onOpenChange,
  title,
  sections,
  primary,
  dontShowAgain,
  testId,
  children,
}) => {
  const { t } = useLocalization()

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid={testId}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-left text-sm text-muted-foreground">
              {sections.map((section) => (
                <section key={section.title}>
                  <div className="font-medium text-foreground">
                    {section.title}
                  </div>
                  <p>{section.body}</p>
                </section>
              ))}
              {children}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {dontShowAgain !== undefined && (
          <div className="flex items-center gap-2">
            <Checkbox
              id="explanation-dont-show-again"
              checked={dontShowAgain.checked}
              onCheckedChange={(checked) =>
                dontShowAgain.onChange(checked === true)
              }
            />
            <Label
              htmlFor="explanation-dont-show-again"
              className="text-sm font-normal"
            >
              {t('explanation:dont-show-again')}
            </Label>
          </div>
        )}
        <AlertDialogFooter>
          {primary === undefined ? (
            <AlertDialogCancel>{t('general:close')}</AlertDialogCancel>
          ) : (
            <>
              <AlertDialogCancel>{t('general:cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={primary.onClick}>
                {primary.label}
              </AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
