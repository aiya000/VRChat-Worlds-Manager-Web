import React from 'react'
import Link from 'next/link'
import { useLocalization } from '@/hooks/use-localization'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface SetupLayoutProps {
  title: string
  currentPage: number
  children: React.ReactNode
  onBack: () => void
  onNext: () => void
  isFirstPage?: boolean
  isLastPage?: boolean
  isMigrationPage?: boolean
  isLoading?: boolean
  isValid?: boolean
}

export function SetupLayout({
  title,
  currentPage,
  children,
  onBack,
  onNext,
  isFirstPage = false,
  isLastPage = false,
  isMigrationPage = false,
  isValid = false,
  isLoading = false,
}: SetupLayoutProps) {
  const { t } = useLocalization()
  const totalPages = 6
  return (
    <div className="container max-w-2xl mx-auto p-4">
      <Progress
        value={((currentPage - 1) / (totalPages - 1)) * 100}
        className="mb-8"
      />
      {/* Fixed heights let a step's content spill over the footer once the
          viewport is narrow enough to wrap it. Let the card grow instead, and
          scroll the step's own content when it outgrows the screen. */}
      <Card className="flex min-h-[480px] max-h-[85svh] flex-col">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto">{children}</CardContent>
        <CardFooter className="flex flex-col gap-3">
          <div className="flex w-full justify-between">
            {/* Only show the Back button if not on the first page */}
            {!isFirstPage ? (
              <Button
                onClick={onBack}
                disabled={isFirstPage}
                variant={isFirstPage ? 'default' : 'outline'}
              >
                {t('general:back')}
              </Button>
            ) : (
              <div className="w-[100px]" />
            )}
            <Button
              onClick={onNext}
              disabled={isMigrationPage && isLoading}
              variant={
                isLastPage || (isMigrationPage && isValid) || isFirstPage
                  ? 'default'
                  : 'outline'
              }
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('general:migrating')}
                </>
              ) : isFirstPage ? (
                t('setup-layout:start')
              ) : isLastPage ? (
                t('setup-layout:finish')
              ) : isMigrationPage && !isValid ? (
                t('setup-layout:skip')
              ) : isMigrationPage && isValid ? (
                t('setup-page:migrate-button')
              ) : (
                t('general:next')
              )}
            </Button>
          </div>
          {/* On every step rather than only the first: someone deciding whether
              to hand this app their VRChat account should not have to go
              looking for what it does with what they type. */}
          <Link
            href="/privacy"
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            {t('privacy-policy:link-label')}
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}
