// eslint-disable-next-line @typescript-eslint/no-var-requires
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true'
})

module.exports = withBundleAnalyzer({
  turbopack: {},
  env: {
    ROOT_NOTION_PAGE_ID: process.env.ROOT_NOTION_PAGE_ID,
    ROOT_NOTION_SPACE_ID: process.env.ROOT_NOTION_SPACE_ID,
    ABOUT_PAGE_ID: process.env.ABOUT_PAGE_ID,
    BLOG_PAGE_ID: process.env.BLOG_PAGE_ID,
    GITHUB: process.env.GITHUB,
    LINKEDIN: process.env.LINKEDIN,
    YOUTUBE: process.env.YOUTUBE,
    NEWSLETTER: process.env.NEWSLETTER,
    TWITTER: process.env.TWITTER,
    NAME: process.env.NAME,
    DOMAIN: process.env.DOMAIN,
    AUTHOR: process.env.AUTHOR,
    DESCRIPTION: process.env.DESCRIPTION,
    PAGE_URL_OVERRIDES: process.env.PAGE_URL_OVERRIDES,
    PAGE_URL_ADDITIONS: process.env.PAGE_URL_ADDITIONS,
    NAVIGATION_STYLE: process.env.NAVIGATION_STYLE,
    NAVIGATION_LINKS: process.env.NAVIGATION_LINKS,
    SHOW_COLLECTION_VIEW_DROPDOWN: process.env.SHOW_COLLECTION_VIEW_DROPDOWN,
    CRON_SECRET: process.env.CRON_SECRET
  },
  staticPageGenerationTimeout: 300,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**'
      },
      {
        protocol: 'https',
        hostname: 'pbs.twimg.com',
        port: '',
        pathname: '/**'
      },
      {
        protocol: 'https',
        hostname: 'abs.twimg.com',
        port: '',
        pathname: '/**'
      },
      {
        protocol: 'https',
        hostname: 's3.us-west-2.amazonaws.com',
        port: '',
        pathname: '/**'
      },
      {
        protocol: 'https',
        hostname: 'www.notion.so',
        port: '',
        pathname: '/**'
      },
      {
        protocol: 'https',
        hostname: 'notion.so',
        port: '',
        pathname: '/**'
      }
    ],
    formats: ['image/avif', 'image/webp'],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;"
  }
})
