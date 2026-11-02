'use client'

import dynamic from 'next/dynamic'
import Image, { type ImageProps } from 'next/image'
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
import { ShikiCode } from './ShikiCode'
import {
  propertyLastEditedTimeValue,
  propertyDateValue,
  propertyTextValue,
  propertySelectValue
} from './NotionProperties'

// -----------------------------------------------------------------------------
// dynamic imports for third-party components
// -----------------------------------------------------------------------------

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
  isBlogPost?: boolean
  tagsPage?: boolean
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

function NotionImage({
  priority,
  alt,
  onLoad,
  onError,
  ...props
}: Omit<ImageProps, 'src'> & { src: string }) {
  const [settledSrc, setSettledSrc] = React.useState<string>()
  const imageRef = React.useCallback(
    (image: HTMLImageElement | null) => {
      if (image?.complete) {
        setSettledSrc(props.src)
        if (image.naturalWidth === 0) {
          console.warn('[Notion Image] Failed to load image', props.src)
        }
      }
    },
    [props.src]
  )
  const isCover = props.className?.split(/\s+/).includes('notion-page-cover')
  const isPriority = priority || isCover
  const fetchPriority = isPriority ? 'high' : props.fetchPriority
  const imageEvents = {
    ref: imageRef,
    'data-notion-image-loading': settledSrc !== props.src,
    onLoad: (event: React.SyntheticEvent<HTMLImageElement>) => {
      setSettledSrc(props.src)
      onLoad?.(event)
    },
    onError: (event: React.SyntheticEvent<HTMLImageElement>) => {
      setSettledSrc(props.src)
      console.warn('[Notion Image] Failed to load image', props.src)
      onError?.(event)
    }
  }

  // Preserve native sizing when Notion has no preview dimensions.
  if (!props.width || !props.height) {
    return (
      <img
        {...imageEvents}
        src={props.src}
        alt={alt ?? ''}
        className={props.className}
        style={props.style}
        width={props.width}
        height={props.height}
        loading={isPriority ? 'eager' : props.loading ?? 'lazy'}
        fetchPriority={fetchPriority}
        decoding='async'
      />
    )
  }

  return (
    <Image
      {...props}
      {...imageEvents}
      alt={alt ?? ''}
      priority={isPriority}
      fetchPriority={fetchPriority}
    />
  )
}

export const NotionRenderer: React.FC<NotionRendererProps> = ({
  recordMap,
  isDarkMode,
  isLiteMode = false,
  isBlogPost = false,
  tagsPage = false,
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
      Image: NotionImage,
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
          Object.keys(recordMap.block)[0]?.replace(/-/g, '') ===
            rootPageId.replace(/-/g, '') &&
          'index-page',
        isLiteMode && 'notion-lite',
        isBlogPost && !tagsPage && 'article-page',
        tagsPage && 'tags-page',
        isDarkMode && 'dark-mode'
      )}
      darkMode={isDarkMode}
      components={components}
      recordMap={recordMap}
      rootPageId={rootPageId}
      rootDomain={rootDomain}
      fullPage={!isLiteMode}
      previewImages={!!recordMap.preview_images}
      forceCustomImages={true}
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
