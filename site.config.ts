import { siteConfig } from '@/lib/site-config'
import { NavigationStyle } from '@/lib/types'

export default siteConfig({
  // the site's root Notion page (required)
  rootNotionPageId: process.env.ROOT_NOTION_PAGE_ID,

  // if you want to restrict pages to a single notion workspace (optional)
  // (this should be a Notion ID; see the docs for how to extract this)
  rootNotionSpaceId: process.env.ROOT_NOTION_SPACE_ID,

  // basic site info (required)
  name: process.env.NAME,
  domain: process.env.DOMAIN,
  author: process.env.AUTHOR,

  // open graph metadata (optional)
  description: process.env.DESCRIPTION,

  // social usernames (optional)
  twitter: process.env.TWITTER,
  github: process.env.GITHUB,
  linkedin: process.env.LINKEDIN,
  youtube: process.env.YOUTUBE, // optional youtube channel name or `channel/UCGbXXXXXXXXXXXXXXXXXXXXXX`
  newsletter: process.env.NEWSLETTER, // optional newsletter URL
  // mastodon: '#', // optional mastodon profile URL, provides link verification

  // default notion icon and cover images for site-wide consistency (optional)
  // page-specific values will override these site-wide defaults
  defaultPageIcon: null,
  defaultPageCover: null,
  defaultPageCoverPosition: 0.5,

  includeNotionIdInUrls: !!process.env.INCLUDE_NOTION_ID_IN_URLS,
  showCollectionViewDropdown: !!process.env.SHOW_COLLECTION_VIEW_DROPDOWN,

  // whether or not to enable support for LQIP preview images (optional)
  isPreviewImageSupportEnabled: !!process.env.PREVIEW_IMAGE,

  // whether or not redis is enabled for caching generated preview images (optional)
  // NOTE: if you enable redis, you need to set the `REDIS_HOST` and `REDIS_PASSWORD`
  // environment variables. see the readme for more info
  isRedisEnabled: false,

  // map of notion page IDs to URL paths (optional)
  // any pages defined here will override their default URL paths
  // example:
  //
  pageUrlOverrides: JSON.parse(process.env.PAGE_URL_OVERRIDES || '{}'),
  pageUrlAdditions: JSON.parse(process.env.PAGE_URL_ADDITIONS || '{}'),
  // pageUrlOverrides: null,

  // whether to use the default notion navigation style or a custom one with links to
  // important pages. To use `navigationLinks`, set `navigationStyle` to `custom`.
  // navigationStyle: 'default'
  navigationStyle: process.env.NAVIGATION_STYLE as NavigationStyle,
  navigationLinks: JSON.parse(process.env.NAVIGATION_LINKS)
})
