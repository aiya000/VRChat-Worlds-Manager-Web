'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { FC, ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

/**
 * The shape shared by the privacy policy and the terms of use: a way back, a
 * title with the date it was last changed, a short introduction, and then
 * one card per section. Two documents that look alike read as one set.
 */
export const LegalPage: FC<{
  title: string
  lastUpdated: string
  backLabel: string
  intro: string
  children: ReactNode
}> = ({ title, lastUpdated, backLabel, intro, children }) => (
  <div className="min-h-svh">
    <div className="container mx-auto max-w-3xl space-y-6 p-6">
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild className="-ml-2 gap-2">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>
        </Button>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">{lastUpdated}</p>
        </div>
        <p className="text-sm leading-relaxed">{intro}</p>
      </div>
      {children}
    </div>
  </div>
)

export const LegalSection: FC<{ title: string; children: ReactNode }> = ({
  title,
  children,
}) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-lg">{title}</CardTitle>
    </CardHeader>
    <CardContent className="space-y-3 text-sm leading-relaxed">
      {children}
    </CardContent>
  </Card>
)

export const LegalBullets: FC<{ items: string[] }> = ({ items }) => (
  <ul className="list-disc space-y-2 pl-5">
    {items.map((item) => (
      <li key={item}>{item}</li>
    ))}
  </ul>
)

export const LegalLink: FC<{ href: string; children?: ReactNode }> = ({
  href,
  children,
}) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="underline underline-offset-2"
  >
    {children ?? href}
  </a>
)
