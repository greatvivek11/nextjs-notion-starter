'use client'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import React from 'react'

import * as config from '@/lib/config'
import { useDarkMode } from '@/lib/use-dark-mode'
import { cn } from '@/lib/utils'
import type { Block, ExtendedRecordMap } from 'notion-types'
import type * as types from '@/types'

import { Navbar } from './Navbar'
import { Page404 } from './Page404'
import { PageAside } from './PageAside'

import { getPageBlock } from '@/lib/notion-helpers'
import { NotionRenderer } from './NotionRenderer'

const ArticleAudioPlayer = dynamic(
  () => import('./ArticleAudioPlayer').then((m) => m.ArticleAudioPlayer),
  { ssr: false }
)

export const NotionPage: React.FC<
  types.PageProps & { pageModel: types.PageModel; footer: React.ReactNode }
> = (props) => {
  const { site, recordMap, error, pageId, pageModel: page, footer } = props

  const searchParams = useSearchParams()
  const lite = searchParams.get('lite')
  const isLiteMode = lite === 'true'
  const { isDarkMode } = useDarkMode()

  // Hide images that fail to load (e.g. expired signed URLs)
  React.useEffect(() => {
    const handleImageError = (e: Event) => {
      const img = e.target as HTMLImageElement
      if (img.tagName !== 'IMG') return

      const notionEl = img.closest('.notion')
      if (!notionEl) return

      img.style.visibility = 'hidden'
      console.warn('[Images] Notion image failed to load', { pageId })

      const coverWrapper = img.closest(
        '.notion-page-cover-wrapper, .notion-collection-card-cover, .notion-asset-wrapper-image'
      )
      if (coverWrapper instanceof HTMLElement) {
        coverWrapper.dataset.imageError = 'true'
      }
    }

    document.addEventListener('error', handleImageError, true)
    return () => document.removeEventListener('error', handleImageError, true)
  }, [pageId])

  if (error || !site || !recordMap) {
    return <Page404 site={site} pageId={pageId} error={error} />
  }

  const block = getPageBlock(recordMap, page.tagsPage ? undefined : pageId)
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
    <div className='site-shell min-h-screen flex flex-col selection:bg-primary/30'>
      {!isLiteMode && (
        <a href='#main-content' className='skip-link'>
          Skip to content
        </a>
      )}
      {!isLiteMode && config.navigationStyle === 'custom' && <Navbar />}

      <div
        id='main-content'
        tabIndex={-1}
        className={cn(
          'grow',
          !isLiteMode && config.navigationStyle === 'custom' && 'site-content'
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
          isBlogPost={page.isBlogPost}
          tagsPage={page.tagsPage}
        />
        {page.isBlogPost && !page.tagsPage && pageId && (
          <ArticleAudioPlayer pageId={pageId} />
        )}
      </div>

      {!isLiteMode && footer}
    </div>
  )
}
