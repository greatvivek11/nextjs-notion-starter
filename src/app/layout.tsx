import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import localFont from 'next/font/local'
// global styles shared across the entire site
// used for rendering equations (optional)
import 'katex/dist/katex.min.css'
// used for code syntax highlighting (optional)
// core styles shared by all of react-notion-x (required)
import '@/styles/global.css'
import 'react-notion-x/src/styles.css'
// this might be better for dark mode
// import 'prismjs/themes/prism-okaidia.css'
// global style overrides for notion
import '@/styles/notion.css'
import '@/styles/notion-homepage.css'
import '@/styles/notion-mobile.css'
// global style overrides for prism theme (optional)

import { appConfig } from '@/lib/config'

const inter = localFont({
  src: [
    {
      path: '../../public/fonts/Inter-Regular.ttf',
      weight: '400',
      style: 'normal'
    },
    {
      path: '../../public/fonts/Inter-SemiBold.ttf',
      weight: '600',
      style: 'normal'
    }
  ],
  display: 'swap',
  variable: '--font-sans'
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f9fafb' },
    { media: '(prefers-color-scheme: dark)', color: '#11151d' }
  ]
}

export const metadata: Metadata = {
  metadataBase: new URL(appConfig.host),
  alternates: {
    canonical: '/'
  },
  title: appConfig.name,
  description: appConfig.description,
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png'
  },
  applicationName: appConfig.name,
  creator: appConfig.author,
  manifest: '/manifest.json',
  generator: 'Next.js',
  openGraph: {
    title: appConfig.name,
    description: appConfig.description,
    url: appConfig.host,
    siteName: appConfig.name,
    images: ['/favicon-192x192.png'],
    locale: 'en-US',
    type: 'website'
  },
  authors: [{ name: appConfig.author, url: appConfig.host }]
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang='en' suppressHydrationWarning>
      <head>
        <Script src='/theme.js' strategy='beforeInteractive' />
      </head>
      <body className={inter.variable}>{children}</body>
    </html>
  )
}
