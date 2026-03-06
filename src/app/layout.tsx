import { Metadata } from 'next'
import Script from 'next/script'
// global styles shared across the entire site
// used for rendering equations (optional)
import 'katex/dist/katex.min.css'
// used for code syntax highlighting (optional)
import 'prismjs/themes/prism-coy.css'
// core styles shared by all of react-notion-x (required)
import '@/styles/global.css'
import 'react-notion-x/src/styles.css'
// this might be better for dark mode
// import 'prismjs/themes/prism-okaidia.css'
// global style overrides for notion
import '@/styles/notion.css'
// global style overrides for prism theme (optional)
import '@/styles/prism-theme.css'

export const metadata: Metadata = {
  metadataBase: new URL(`https://${process.env.DOMAIN}`),
  alternates: {
    canonical: '/',
    languages: {
      'en-US': '/en-US'
    },
    media: {
      'image/png': '/favicon.png'
    },
    types: {
      'application/rss+xml': '/feed.xml',
      'application/atom+xml': '/feed.xml',
      'application/feed+json': '/feed.json',
      'application/json': '/feed.json',
      'text/calendar': '/feed.ics',
      'text/html': '/sitemap.xml',
      'text/plain': '/robots.txt',
      'text/xml': '/sitemap.xml',
      'image/svg+xml': '/favicon.svg',
      'image/webp': '/favicon.webp',
      'image/x-icon': '/favicon.ico',
      'image/vnd.microsoft.icon': '/favicon.ico',
      'image/avif': '/favicon.avif',
      'image/apng': '/favicon.png',
      'image/gif': '/favicon.gif',
      'image/jpeg': '/favicon.jpg',
      'image/png': '/favicon.png'
    }
  },
  title: process.env.TITLE,
  description: process.env.DESCRIPTION,
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png'
  },
  applicationName: 'Next.js Notion Starter Kit',
  creator: process.env.AUTHOR,
  manifest: '/manifest.json',
  generator: 'Next.js',
  openGraph: {
    title: process.env.TITLE,
    description: process.env.DESCRIPTION,
    url: `https://${process.env.DOMAIN}`,
    siteName: 'Next.js Notion Starter Kit',
    images: ['/favicon-192x192.png'],
    locale: 'en-US',
    type: 'website'
  },
  authors: [{ name: process.env.AUTHOR, url: `https://${process.env.DOMAIN}` }]
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
      <body>{children}</body>
    </html>
  )
}
