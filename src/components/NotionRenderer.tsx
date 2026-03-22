'use client'

import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import type { ExtendedRecordMap } from 'notion-types'
import { formatDate, normalizeTitle } from 'notion-utils'
import * as React from 'react'
import {
  Header,
  NotionRenderer as NotionRendererLib,
  Search,
  useNotionContext
} from 'react-notion-x'

import { appConfig } from '@/lib/config'
import { mapImageUrl } from '@/lib/map-image-url'
import { searchNotion } from '@/lib/search-notion'
import { cn } from '@/lib/utils'
import styles from './styles.module.css'

// -----------------------------------------------------------------------------
// dynamic imports for third-party components
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

const Mermaid = dynamic(
  () => import('./Mermaid').then((m) => m.Mermaid),
  { ssr: false }
)

const Code = ({ block, className }: any) => {
  const code = block.properties?.title?.[0]?.[0] || ''
  const language = block.properties?.language?.[0]?.[0] || 'javascript'
  
  if (language.toLowerCase() === 'mermaid') {
    return <Mermaid chart={code} />
  }

  return <ShikiCode code={code} language={language} className={className} />
}

const Collection = dynamic(
  () =>
    import('react-notion-x/build/third-party/collection').then(
      (m) => m.Collection
    ),
  { ssr: true }
)

const Equation = dynamic(
  () =>
    import('react-notion-x/build/third-party/equation').then((m) => m.Equation),
  { ssr: true }
)

const ReactPdfComponents = dynamic(
  () =>
    import('react-pdf').then((m) => {
      m.pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${m.pdfjs.version}/legacy/build/pdf.worker.min.mjs`
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

  let pageId = ''
  let pdfBlockId = ''

  if (recordMap?.block) {
    for (const [id, blockEntry] of Object.entries(recordMap.block)) {
      const val = (blockEntry as any)?.value || blockEntry
      if (val?.type === 'page' && !pageId) pageId = id
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

  const proxiedUrl =
    pageId && pdfBlockId
      ? `/api/notion-pdf?pageId=${pageId}&blockId=${pdfBlockId}`
      : file
  return <ReactPdfComponents file={proxiedUrl} />
}

const Modal = dynamic(
  () =>
    import('react-notion-x/build/third-party/modal').then((m) => {
      m.Modal.setAppElement('.notion-viewport')
      return m.Modal
    }),
  { ssr: true }
)

const TweetEmbed = dynamic(() => import('react-tweet-embed'), { ssr: false })
const Tweet = ({ id }: { id: string }) => <TweetEmbed tweetId={id} />

// -----------------------------------------------------------------------------
// Property value overrides
// -----------------------------------------------------------------------------

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
      return formatDate(publishDate, { month: 'long' })
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

import { useDarkMode } from '@/lib/use-dark-mode'
// import { Header, Search, useNotionContext } from 'react-notion-x' (now at top)
import { IoMoonSharp } from '@react-icons/all-files/io5/IoMoonSharp'
import { IoSunnyOutline } from '@react-icons/all-files/io5/IoSunnyOutline'

// -----------------------------------------------------------------------------
// NotionPageHeader (Internal to Renderer Subsystem)
// -----------------------------------------------------------------------------

const ToggleThemeButton = () => {
  const [hasMounted, setHasMounted] = React.useState(false)
  const { isDarkMode, toggleDarkMode } = useDarkMode()

  React.useEffect(() => {
    setHasMounted(true)
  }, [])

  const onToggleTheme = React.useCallback(() => {
    toggleDarkMode()
  }, [toggleDarkMode])

  return (
    <div
      className={cn('breadcrumb', 'button', !hasMounted && styles.hidden)}
      onClick={onToggleTheme}
    >
      {hasMounted && isDarkMode ? <IoMoonSharp /> : <IoSunnyOutline />}
    </div>
  )
}

const NotionPageHeader: React.FC<{
  block: any
}> = ({ block }) => {
  const { components, mapPageUrl } = useNotionContext()

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Catch Ctrl/Cmd + K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        const searchButton = document.querySelector(
          '.notion-search-button'
        ) as HTMLElement
        if (searchButton) {
          searchButton.click()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  if (appConfig.navigationStyle === 'default') {
    return <Header block={block} />
  }

  // When using 'custom' navigation style, the <Navbar> in NotionPage.tsx
  // handles all visual navigation. We render the <Search /> component invisibly
  // so that the search modal portal and native hotkeys (Cmd+K/P) are still injected into the DOM.
  // The custom Navbar's search button functions by programmatically clicking the hidden '.notion-search-button'.
  return (
    <div style={{ display: 'none' }}>
      <Search block={block} />
    </div>
  )
}

// -----------------------------------------------------------------------------
// The Adapter Component
// -----------------------------------------------------------------------------

export interface NotionRendererProps {
  recordMap: ExtendedRecordMap
  isDarkMode: boolean
  isLiteMode?: boolean
  rootPageId?: string
  rootDomain?: string
  pageTitle?: string

  // Custom slots
  pageHeader?: React.ReactNode
  pageAside?: React.ReactNode
  footer?: React.ReactNode

  // Config overrides
  showTableOfContents?: boolean
  minTableOfContentsItems?: number
}

export const NotionRenderer: React.FC<NotionRendererProps> = ({
  recordMap,
  isDarkMode,
  isLiteMode = false,
  rootPageId = appConfig.rootNotionPageId,
  rootDomain = appConfig.domain,
  pageTitle,
  pageHeader,
  pageAside,
  footer,
  showTableOfContents,
  minTableOfContentsItems = 3
}) => {
  const components = React.useMemo(
    () => ({
      nextImage: ({ priority, ...props }: any) => {
        const isCover =
          props.src?.includes('table=block') ||
          props.className?.includes('notion-page-cover')
        return (
          <Image
            {...props}
            priority={priority || isCover}
          />
        )
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

  return (
    <NotionRendererLib
      bodyClassName={cn(
        styles.notion,
        recordMap?.block &&
          Object.keys(recordMap.block)[0] === rootPageId &&
          'index-page',
        isLiteMode && 'notion-lite',
        isDarkMode && 'dark-mode'
      )}
      darkMode={isDarkMode}
      components={components}
      recordMap={recordMap}
      rootPageId={rootPageId}
      rootDomain={rootDomain}
      fullPage={!isLiteMode}
      previewImages={!!recordMap.preview_images}
      showCollectionViewDropdown={appConfig.showCollectionViewDropdown}
      showTableOfContents={showTableOfContents}
      minTableOfContentsItems={minTableOfContentsItems}
      defaultPageIcon={appConfig.defaultPageIcon}
      defaultPageCover={appConfig.defaultPageCover}
      defaultPageCoverPosition={appConfig.defaultPageCoverPosition}
      linkTableTitleProperties={true}
      mapImageUrl={mapImageUrl}
      searchNotion={appConfig.isSearchEnabled ? searchNotion : null}
      pageAside={pageAside}
      footer={footer}
      pageTitle={pageTitle}
    />
  )
}
