'use client'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import type { PageBlock } from 'notion-types'
import {
  formatDate,
  getBlockTitle,
  getPageProperty,
  normalizeTitle
} from 'notion-utils'
import React from 'react'
import { NotionRenderer, useNotionContext } from 'react-notion-x'

import * as config from '@/lib/config'
import { mapImageUrl } from '@/lib/map-image-url'
import { getCanonicalPageUrl, mapPageUrl } from '@/lib/map-page-url'
import { searchNotion } from '@/lib/search-notion'
import type * as types from '@/lib/types'
import { useDarkMode } from '@/lib/use-dark-mode'
import { cn } from '@/lib/utils'

import { showCollectionViewDropdown } from '@/lib/config'
import { Footer } from './Footer'
import { NotionPageHeader } from './NotionPageHeader'
import { Page404 } from './Page404'
import { PageAside } from './PageAside'
import { PageHead } from './PageHead'
import styles from './styles.module.css'

// -----------------------------------------------------------------------------
// dynamic imports for optional components
// -----------------------------------------------------------------------------

const ShikiCode = dynamic(
  () => import('./ShikiCode').then((m) => m.ShikiCode),
  {
    ssr: false,
    loading: () => (
      <pre className='shiki-loading'>
        <code>{''}</code>
      </pre>
    )
  }
)

const Code = ({ block, className }: any) => {
  const code = block.properties?.title?.[0]?.[0] || ''
  const language = block.properties?.language?.[0]?.[0] || 'javascript'

  return <ShikiCode code={code} language={language} className={className} />
}

const Collection = dynamic(
  () =>
    import('react-notion-x/build/third-party/collection').then(
      (m) => m.Collection
    ),
  {
    ssr: true
  }
)
const Equation = dynamic(
  () =>
    import('react-notion-x/build/third-party/equation').then((m) => m.Equation),
  {
    ssr: true
  }
)
// We render react-pdf's Document/Page directly instead of using react-notion-x's
// Pdf wrapper, because the library doesn't expose renderTextLayer/renderAnnotationLayer
// options, causing duplicate plaintext rendering alongside each page canvas.
const ReactPdfComponents = dynamic(
  () =>
    import('react-pdf').then((m) => {
      m.pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${m.pdfjs.version}/legacy/build/pdf.worker.min.mjs`
      // Return a simple component that uses Document + Page
      const PdfViewer = ({ file }: { file: string }) => {
        const [numPages, setNumPages] = React.useState(0)
        return (
          <m.Document
            file={file}
            onLoadSuccess={({ numPages: n }) => setNumPages(n)}
          >
            {Array.from({ length: numPages }, (_, i) => (
              <m.Page
                key={`page_${i + 1}`}
                pageNumber={i + 1}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            ))}
          </m.Document>
        )
      }
      return PdfViewer
    }),
  { ssr: false }
)

const CustomPdf = ({ file }: any) => {
  const [mounted, setMounted] = React.useState(false)
  const { recordMap } = useNotionContext()

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  // Find the page ID and PDF block ID from the recordMap
  let pageId = ''
  let pdfBlockId = ''

  if (recordMap?.block) {
    for (const [id, blockEntry] of Object.entries(recordMap.block)) {
      const val = (blockEntry as any)?.value || blockEntry
      if (val?.type === 'page' && !pageId) {
        pageId = id
      }
      if (val?.type === 'pdf') {
        const source = val?.properties?.source?.[0]?.[0]
        if (
          source === file ||
          source?.includes(file) ||
          file?.includes(source)
        ) {
          pdfBlockId = id
        } else if (!pdfBlockId) {
          pdfBlockId = id
        }
      }
    }
  }

  let proxiedUrl = file
  if (pageId && pdfBlockId) {
    proxiedUrl = `/api/notion-pdf?pageId=${pageId}&blockId=${pdfBlockId}`
  }

  return <ReactPdfComponents file={proxiedUrl} />
}

const Modal = dynamic(
  () =>
    import('react-notion-x/build/third-party/modal').then((m) => {
      m.Modal.setAppElement('.notion-viewport')
      return m.Modal
    }),
  {
    ssr: true
  }
)

const TweetEmbed = dynamic(() => import('react-tweet-embed'), {
  ssr: false
})

const Tweet = ({ id }: { id: string }) => {
  return <TweetEmbed tweetId={id} />
}

function propertyLastEditedTimeValue(
  { block, pageHeader },
  defaultFn: () => React.ReactNode
): React.ReactNode {
  if (pageHeader && block?.last_edited_time) {
    return `Last updated ${formatDate(block?.last_edited_time, {
      month: 'long'
    })}`
  }

  return defaultFn()
}

const propertyDateValue = (
  { data, schema, pageHeader },
  defaultFn: () => React.ReactNode
) => {
  if (pageHeader && schema?.name?.toLowerCase() === 'published') {
    const publishDate = data?.[0]?.[1]?.[0]?.[1]?.start_date

    if (publishDate) {
      return `${formatDate(publishDate, {
        month: 'long'
      })}`
    }
  }

  return defaultFn()
}

function propertyTextValue(
  { schema, pageHeader },
  defaultFn: () => React.ReactNode
): React.ReactNode {
  if (pageHeader && schema?.name?.toLowerCase() === 'author') {
    return <b>{defaultFn()}</b>
  }

  return defaultFn()
}

function propertySelectValue(
  { schema, value, key, pageHeader },
  defaultFn: () => React.ReactNode
): React.ReactNode {
  value = normalizeTitle(value)

  if (pageHeader && schema.type === 'multi_select' && value) {
    return (
      <Link href={`/tags/${value}`} key={key}>
        {defaultFn()}
      </Link>
    )
  }

  return defaultFn()
}

export const NotionPage: React.FC<types.PageProps> = ({
  site,
  recordMap,
  error,
  pageId,
  tagsPage,
  propertyToFilterName
}) => {
  const searchParams = useSearchParams()
  const lite = searchParams.get('lite')

  const components = React.useMemo(
    () => ({
      nextImage: ({ priority, ...props }: any) => {
        // Prioritize cover images for better LCP
        const isCover =
          props.src?.includes('table=block') ||
          props.className?.includes('notion-page-cover')
        return <Image {...props} priority={priority || isCover} />
      },
      nextLink: Link,
      Code,
      Pdf: CustomPdf,
      Collection,
      Equation,
      Modal,
      Tweet,
      Header: NotionPageHeader,
      propertyLastEditedTimeValue,
      propertyTextValue,
      propertyDateValue,
      propertySelectValue
    }),
    []
  )

  // lite mode is for oembed
  const isLiteMode = lite === 'true'

  const { isDarkMode } = useDarkMode()

  // Hide images that fail to load (e.g. expired signed URLs)
  React.useEffect(() => {
    const handleImageError = (e: Event) => {
      const img = e.target as HTMLImageElement
      if (img.tagName !== 'IMG') return

      // Only handle images inside Notion containers
      const notionEl = img.closest('.notion')
      if (!notionEl) return

      img.style.display = 'none'

      // Collapse the cover container if it's a cover/card image
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

  const siteMapPageUrl = React.useMemo(() => {
    const params: any = {}
    if (lite) params.lite = lite

    const searchParams = new URLSearchParams(params)
    return mapPageUrl(site, recordMap, searchParams)
  }, [site, recordMap, lite])

  const keys = Object.keys(recordMap?.block || {})
  const blockEntry = recordMap?.block?.[keys[0]]
  const block =
    (blockEntry as any)?.value?.value ||
    (blockEntry as any)?.value ||
    blockEntry

  const isBlogPost =
    block?.type === 'page' && block?.parent_table === 'collection'

  const showTableOfContents = !!isBlogPost
  const isCollectionViewVisible = showCollectionViewDropdown
  const minTableOfContentsItems = 3

  const pageAside = React.useMemo(
    () => (
      <PageAside block={block} recordMap={recordMap} isBlogPost={isBlogPost} />
    ),
    [block, recordMap, isBlogPost]
  )

  const footer = React.useMemo(() => <Footer />, [])

  if (error || !site || !block) {
    return <Page404 site={site} pageId={pageId} error={error} />
  }

  const name = getBlockTitle(block, recordMap) || site.name
  const title =
    tagsPage && propertyToFilterName ? `${propertyToFilterName} ${name}` : name

  // console.log('notion page', {
  //   isDev: config.isDev,
  //   title,
  //   pageId,
  //   rootNotionPageId: site.rootNotionPageId,
  //   recordMap
  // })

  if (!config.isServer) {
    // add important objects to the window global for easy debugging
    const g = window as any
    g.pageId = pageId
    g.recordMap = recordMap
    g.block = block
  }

  const canonicalPageUrl =
    !config.isDev && getCanonicalPageUrl(site, recordMap)(pageId)

  const socialImage =
    mapImageUrl(
      getPageProperty<string>('Social Image', block, recordMap) ||
        (block as PageBlock).format?.page_cover ||
        config.defaultPageCover,
      block
    ) ?? undefined

  const socialDescription =
    getPageProperty<string>('Description', block, recordMap) ||
    config.description

  return (
    <>
      <PageHead
        pageId={pageId}
        site={site}
        title={title}
        description={socialDescription}
        image={socialImage}
        url={canonicalPageUrl}
      />

      {/* {isLiteMode && <BodyClassName className='notion-lite' />}
      {isDarkMode && <BodyClassName className='dark-mode' />} */}

      <NotionRenderer
        bodyClassName={cn(
          styles.notion,
          pageId === site.rootNotionPageId && 'index-page',
          tagsPage && 'tags-page',
          isLiteMode && 'notion-lite',
          isDarkMode && 'dark-mode'
        )}
        darkMode={isDarkMode}
        components={components}
        recordMap={recordMap}
        rootPageId={site.rootNotionPageId}
        rootDomain={site.domain}
        fullPage={!isLiteMode}
        previewImages={!!recordMap.preview_images}
        showCollectionViewDropdown={isCollectionViewVisible}
        showTableOfContents={showTableOfContents}
        minTableOfContentsItems={minTableOfContentsItems}
        defaultPageIcon={config.defaultPageIcon}
        defaultPageCover={config.defaultPageCover}
        defaultPageCoverPosition={config.defaultPageCoverPosition}
        linkTableTitleProperties={true}
        mapPageUrl={siteMapPageUrl}
        mapImageUrl={mapImageUrl}
        searchNotion={config.isSearchEnabled ? searchNotion : null}
        pageAside={pageAside}
        footer={footer}
        pageTitle={tagsPage && propertyToFilterName ? title : undefined}
      />
    </>
  )
}
