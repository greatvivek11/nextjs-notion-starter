'use client'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import React from 'react'

import * as config from '@/lib/config'
import { useDarkMode } from '@/lib/use-dark-mode'
import { cn } from '@/lib/utils'
import type { Block, ExtendedRecordMap } from 'notion-types'
import type * as types from '@/types'

import { Footer } from './Footer'
import { Navbar } from './Navbar'
import { Page404 } from './Page404'
import { PageAside } from './PageAside'
import { PageHead } from './PageHead'

import { resolvePageModel } from '@/lib/page-model'
import { NotionRenderer } from './NotionRenderer'

const ArticleAudioPlayer = dynamic(
  () => import('./ArticleAudioPlayer').then((m) => m.ArticleAudioPlayer),
  { ssr: false }
)

export const NotionPage: React.FC<types.PageProps> = (props) => {
  const { site, recordMap, error, pageId, tagsPage, propertyToFilterName } =
    props

  const searchParams = useSearchParams()
  const lite = searchParams.get('lite')
  const isLiteMode = lite === 'true'
  const { isDarkMode } = useDarkMode()

  const page = React.useMemo(
    () =>
      resolvePageModel({
        site,
        recordMap,
        error,
        pageId,
        tagsPage,
        propertyToFilterName
      }),
    [site, recordMap, error, pageId, tagsPage, propertyToFilterName]
  )

  // Hide images that fail to load (e.g. expired signed URLs)
  React.useEffect(() => {
    const handleImageError = (e: Event) => {
      const img = e.target as HTMLImageElement
      if (img.tagName !== 'IMG') return

      const notionEl = img.closest('.notion')
      if (!notionEl) return

      img.style.display = 'none'

      const coverWrapper = img.closest(
        '.notion-page-cover-wrapper, .notion-collection-card-cover'
      )
      if (coverWrapper instanceof HTMLElement) {
        coverWrapper.style.display = 'none'
      }
    }

    document.addEventListener('error', handleImageError, true)
    return () => document.removeEventListener('error', handleImageError, true)
  }, [])

  if (error || !site || !recordMap) {
    return <Page404 site={site} pageId={pageId} error={error} />
  }

  const block = recordMap.block[Object.keys(recordMap.block)[0]]?.value as Block
  if (!block) {
    return <Page404 site={site} pageId={pageId} error={error} />
  }

  if (!config.isServer && process.env.NODE_ENV === 'development') {
    interface WindowWithNotion extends Window {
      pageId?: string
      recordMap?: ExtendedRecordMap
      block?: Block
    }
    const g = window as unknown as WindowWithNotion
    g.pageId = pageId
    g.recordMap = recordMap
    g.block = block
  }

  const pageAside = (
    <PageAside
      block={block}
      recordMap={recordMap}
      isBlogPost={page.isBlogPost}
    />
  )

  return (
    <div className='min-h-screen flex flex-col selection:bg-primary/30'>
      <PageHead
        pageId={pageId}
        site={site}
        title={page.title}
        description={page.description}
        image={page.image}
        url={page.canonicalUrl}
      />

      {!isLiteMode && <Navbar />}

      <main
        className={cn(
          'grow transition-all duration-500',
          !isLiteMode && 'pt-16'
        )}
      >
        <NotionRenderer
          recordMap={recordMap}
          isDarkMode={isDarkMode}
          isLiteMode={isLiteMode}
          pageTitle={page.tagsPage ? page.title : undefined}
          pageAside={pageAside}
          footer={null} // Footer is handled by the shell now
          showTableOfContents={page.showTableOfContents}
          minTableOfContentsItems={page.minTableOfContentsItems}
        />
        {page.isBlogPost && !page.tagsPage && pageId && <ArticleAudioPlayer pageId={pageId} />}
      </main>

      {!isLiteMode && <Footer />}
    </div>
  )
}
