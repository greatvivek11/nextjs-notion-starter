import { ParsedUrlQuery } from 'querystring'
import { ExtendedRecordMap, PageMap } from 'notion-types'

export * from 'notion-types'

/**
 * Site-wide application configuration.
 */
export interface AppConfig {
  // Required
  rootNotionPageId: string
  domain: string
  name: string
  site: Site

  // Page URL Mappings
  pageUrlOverrides: Record<string, string>
  pageUrlAdditions: Record<string, string>

  // Optional
  rootNotionSpaceId: string | null
  description: string
  language: string
  author: string

  // Social
  twitter: string | null
  github: string | null
  youtube: string | null
  linkedin: string | null
  newsletter: string | null

  // Notion Defaults
  defaultPageIcon: string
  defaultPageCover: string
  defaultPageCoverPosition: number

  // Feature Flags
  isDev: boolean
  isServer: boolean
  isPreviewImageSupportEnabled: boolean
  includeNotionIdInUrls: boolean
  showCollectionViewDropdown: boolean
  isSearchEnabled: boolean

  // Navigation
  navigationStyle: 'default' | 'custom'
  navigationLinks: Array<NavigationLink | null>

  // API/Hosting
  host: string
  apiHost: string
  apiBaseUrl: string
}

/**
 * Result of resolving a route to a Notion page.
 */
export interface ResolvedPage extends PageProps {
  pageId: string
  recordMap: ExtendedRecordMap
  site: Site
  tagsPage?: boolean
  propertyToFilterName?: string
  error?: PageError
}

/**
 * Minimal site identity.
 */
export interface Site {
  name: string
  domain: string
  rootNotionPageId: string
  rootNotionSpaceId: string | null
  description?: string
  image?: string

  // settings (legacy/optional)
  html?: string
  fontFamily?: string
  darkMode?: boolean
  previewImages?: boolean
}

/**
 * UI-facing page model, decoupled from Notion specifics.
 */
export interface PageModel {
  id: string
  title: string
  description: string
  image?: string
  url: string
  canonicalUrl?: string

  // View context
  isBlogPost: boolean
  showTableOfContents: boolean
  minTableOfContentsItems: number

  // Global context
  isLiteMode: boolean
  isDarkMode: boolean

  // Custom view flags
  tagsPage?: boolean
  propertyToFilterName?: string
}

/**
 * Standardized metadata for Next.js SEO.
 */
export interface PageMetadata {
  title: string
  description?: string
  image?: string
  url?: string
  author?: string
  twitterHandle?: string
  publishedTime?: string
  tags?: string[]
}

export interface NavigationLink {
  title: string
  url?: string
  pageId?: string
  menuItem?: boolean
}

export type NavigationStyle = 'default' | 'custom'

export interface PageError {
  message?: string
  statusCode: number
}

export interface PageProps {
  site?: Site
  recordMap?: ExtendedRecordMap
  pageId?: string
  error?: PageError
  tagsPage?: boolean
  propertyToFilterName?: string
}

export interface Params extends ParsedUrlQuery {
  pageId: string
}

export interface SiteMap {
  site: Site
  pageMap: PageMap
  canonicalPageMap: CanonicalPageMap
}

export interface CanonicalPageMap {
  [canonicalPageId: string]: string
}

export interface PageUrlOverridesMap {
  [pagePath: string]: string
}

export interface PageUrlOverridesInverseMap {
  [pageId: string]: string
}

export interface NotionPageInfo {
  pageId: string
  title: string
  image: string
  imageObjectPosition: string
  author: string
  authorImage: string
  detail: string
}
