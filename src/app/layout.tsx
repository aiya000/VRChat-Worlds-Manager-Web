import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'

import '@/app/globals.css'
import { LocalizationContextProvider } from '@/components/localization-context'
import { DeepLinkProvider } from '@/components/deep-link-provider'
import { PatreonProvider } from '@/contexts/patreon-context'
import { SwRegister } from '@/components/sw-register'
import { StaleBundleNotice } from '@/components/stale-bundle-notice'
import { UiScaleEffect } from '@/components/ui-scale-effect'
import { BackendLimitNotice } from '@/components/backend-limit-notice'
import { ExitGuard } from '@/components/exit-guard'

const _geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const _geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

const siteName = 'VRChat Worlds Manager Web'
const title = 'VRChat Worlds Manager Web｜VRChat のお気に入りワールドを整理する'
const description =
  'VRChat のお気に入りワールドをフォルダで整理して、どの端末からでも開けるようにする Web アプリです。ブラウザだけで動き、VR のオーバーレイやスマホからも使えます。'

export const metadata: Metadata = {
  // Static export cannot resolve a relative OG image on its own, and the card
  // is fetched by a crawler that has no page to resolve it against.
  metadataBase: new URL('https://vrchat-worlds-manager-web.pages.dev'),
  title,
  description,
  openGraph: {
    type: 'website',
    siteName,
    title,
    description,
    url: '/',
    locale: 'ja_JP',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: siteName,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: ['/og-image.png'],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />
        {/* iOS paints transparency black and does not crop, so this one is
            opaque and full-bleed rather than the transparent icon. */}
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body>
        <DeepLinkProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <LocalizationContextProvider>
              <PatreonProvider>
                <main>{children}</main>
              </PatreonProvider>
              <StaleBundleNotice />
              <UiScaleEffect />
              <BackendLimitNotice />
              <ExitGuard />
            </LocalizationContextProvider>
          </ThemeProvider>
          <Toaster richColors />
          <SwRegister />
        </DeepLinkProvider>
      </body>
    </html>
  )
}
