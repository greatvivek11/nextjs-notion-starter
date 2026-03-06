/**
 * Site-wide app configuration.
 *
 * This file pulls from the root "site.config.ts" as well as environment variables
 * for optional depenencies.
 */
import { parsePageId } from 'notion-utils'

import { getEnv, getSiteConfig } from './get-config-value'
import { NavigationLink } from './site-config'
import {
  NavigationStyle,
  PageUrlOverridesInverseMap,
  PageUrlOverridesMap,
  Site
} from './types'

// Required Notion Page ID
export const rootNotionPageId: string = parsePageId(
  getSiteConfig('rootNotionPageId'),
  { uuid: false }
)

if (!rootNotionPageId) {
  throw new Error('Config error invalid "rootNotionPageId"')
}

// optional - if you want to restrict pages to a single notion workspace
export const rootNotionSpaceId: string | null = parsePageId(
  getSiteConfig('rootNotionSpaceId', null),
  { uuid: true }
)

// optional whether or not to override the  page urls of Notion pages.
export const pageUrlOverrides = cleanPageUrlMap(
  getSiteConfig('pageUrlOverrides', {}) || {},
  { label: 'pageUrlOverrides' }
)

// optional whether or not to add some additional pages to the site which aren't children of the ROOT_NOTION_PAGE_ID
export const pageUrlAdditions = cleanPageUrlMap(
  getSiteConfig('pageUrlAdditions', {}) || {},
  { label: 'pageUrlAdditions' }
)

// optional whether or not to invert the page url overrides
export const inversePageUrlOverrides = invertPageUrlOverrides(pageUrlOverrides)

export const environment = process.env.NODE_ENV || 'development'
export const isDev = environment === 'development'

// ----------------------------------------------------------------------------

// general site config
export const name: string = getSiteConfig('name')
export const author: string = getSiteConfig('author')
export const domain: string = getSiteConfig('domain')
export const description: string = getSiteConfig('description', 'Notion Blog')
export const language: string = getSiteConfig('language', 'en')

// ----------------------------------------------------------------------------

// social accounts
export const twitter: string | null = getSiteConfig('twitter', null)
export const github: string | null = getSiteConfig('github', null)
export const youtube: string | null = getSiteConfig('youtube', null)
export const linkedin: string | null = getSiteConfig('linkedin', null)
export const newsletter: string | null = getSiteConfig('newsletter', null)

// ----------------------------------------------------------------------------

// default notion values for site-wide consistency (optional; may be overridden on a per-page basis)
export const defaultPageIcon: string = getSiteConfig('defaultPageIcon', '')
export const defaultPageCover: string = getSiteConfig('defaultPageCover', '')
export const defaultPageCoverPosition: number = getSiteConfig(
  'defaultPageCoverPosition',
  0.5
)

// ----------------------------------------------------------------------------

// Optional whether or not to enable support for LQIP preview images
export const isPreviewImageSupportEnabled: boolean = getSiteConfig(
  'isPreviewImageSupportEnabled',
  true
)

// Optional whether or not to include the Notion ID in page URLs or just use slugs
export const includeNotionIdInUrls: boolean = getSiteConfig(
  'includeNotionIdInUrls',
  !!isDev
)

// Optional whether or not to show the collection view dropdown i.e., the tabs in a gallery view database.
export const showCollectionViewDropdown: boolean = getSiteConfig(
  'showCollectionViewDropdown',
  false
)

// Optional whether or not to show the links in the page header.
export const navigationStyle: NavigationStyle = getSiteConfig(
  'navigationStyle',
  'default'
)

// Optional - navigation links to be shown in the page header if navigationStyle = 'custom'
export const navigationLinks: Array<NavigationLink | null> = getSiteConfig(
  'navigationLinks',
  []
)

// Optional whether or not to enable search
export const isSearchEnabled: boolean = getSiteConfig('isSearchEnabled', true)

// ----------------------------------------------------------------------------

export const isServer = typeof window === 'undefined'

export const port = getEnv('PORT', '3000')
export const host = isDev ? `http://localhost:${port}` : `https://${domain}`
export const apiHost = isDev
  ? host
  : `https://${process.env.VERCEL_URL || domain}`

export const apiBaseUrl = `/api`

export const api = {
  searchNotion: `${apiBaseUrl}/search-notion`,
  getNotionPageInfo: `${apiBaseUrl}/notion-page-info`,
  getSocialImage: `${apiBaseUrl}/social-image`
}

// ----------------------------------------------------------------------------

export const site: Site = {
  domain,
  name,
  rootNotionPageId,
  rootNotionSpaceId,
  description
}

function cleanPageUrlMap(
  pageUrlMap: PageUrlOverridesMap,
  {
    label
  }: {
    label: string
  }
): PageUrlOverridesMap {
  return Object.keys(pageUrlMap).reduce((acc, uri) => {
    const pageId = pageUrlMap[uri]
    const uuid = parsePageId(pageId, { uuid: false })

    if (!uuid) {
      throw new Error(`Invalid ${label} page id "${pageId}"`)
    }

    if (!uri) {
      throw new Error(`Missing ${label} value for page "${pageId}"`)
    }

    if (!uri.startsWith('/')) {
      throw new Error(
        `Invalid ${label} value for page "${pageId}": value "${uri}" should be a relative URI that starts with "/"`
      )
    }

    const path = uri.slice(1)

    return {
      ...acc,
      [path]: uuid
    }
  }, {})
}

function invertPageUrlOverrides(
  pageUrlOverrides: PageUrlOverridesMap
): PageUrlOverridesInverseMap {
  return Object.keys(pageUrlOverrides).reduce((acc, uri) => {
    const pageId = pageUrlOverrides[uri]

    return {
      ...acc,
      [pageId]: uri
    }
  }, {})
}
