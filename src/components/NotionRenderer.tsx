'use client'

import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import type { ExtendedRecordMap } from 'notion-types'
import * as React from 'react'
import { NotionRenderer as NotionRendererLib } from 'react-notion-x'

import { appConfig } from '@/lib/config'
import { mapImageUrl } from '@/lib/map-image-url'
import { searchNotion } from '@/lib/search-notion'
import { cn } from '@/lib/utils'
import styles from './styles.module.css'

import { Block, CodeBlock } from 'notion-types'
import { CustomLink } from './CustomLink'
import { CustomPdf } from './CustomPdf'
import { NotionPageHeader } from './NotionPageHeader'
import {
  propertyLastEditedTimeValue,
  propertyDateValue,
  propertyTextValue,
  propertySelectValue
} from './NotionProperties'

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

const Mermaid = dynamic(() => import('./Mermaid').then((m) => m.Mermaid), {
  ssr: false
})

const Code = ({
  block,
  className
}: {
  block: Block
  className?: string
}) => {
  const properties = (block as CodeBlock).properties
  const code = properties?.title?.[0]?.[0] || ''
  const language = properties?.language?.[0]?.[0] || 'javascript'

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
      nextImage: ({
        priority,
        alt,
        ...props
      }: {
        priority?: boolean
        src: string
        alt?: string
        className?: string
        [key: string]: unknown
      }) => {
        // Notion cover images use a specific query param or className.
        // We ensure they get 'priority' for LCP performance.
        const isCover =
          props.src?.includes('table=block') ||
          props.className?.includes('notion-page-cover')
        return (
          <Image
            {...props}
            alt={alt ?? ''}
            priority={priority || isCover}
          />
        )
      },
      nextLink: Link,
      Link: CustomLink,
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
