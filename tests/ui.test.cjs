const assert = require('node:assert/strict')
const { test } = require('node:test')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { loadModule, loadComponent } = require('./load-module.cjs')
const fs = require('node:fs')
const path = require('node:path')
const postcss = require('postcss')

const { ThemeToggle } = loadComponent('ThemeToggle', {
  '@/lib/use-dark-mode': {
    useDarkMode: () => ({ isDarkMode: false, toggleDarkMode: () => false })
  }
})

const cn = (...classes) => classes.filter(Boolean).join(' ')
const config = {
  name: 'Example Developer',
  rootNotionPageId: '12345678123412341234123456789abc',
  isSearchEnabled: true,
  navigationLinks: [
    { title: 'About', pageId: '8b47325549744eba9360f0d6b88d419e' }
  ]
}

test('navigation initially hides mobile links and exposes named, associated controls', () => {
  const { Navbar } = loadComponent('Navbar', {
    '@/lib/config': {
      appConfig: config,
      inversePageUrlOverrides: { '8b47325549744eba9360f0d6b88d419e': 'about' }
    },
    '@/lib/navigation': loadModule('navigation'),
    '@/lib/notion-search-trigger': { openNotionSearch: () => true },
    './ThemeToggle': { ThemeToggle },
    '@/lib/utils': { cn },
    'next/navigation': { usePathname: () => '/about' },
    'next/image': (props) => React.createElement('img', props),
    'next/link': (props) => React.createElement('a', props)
  })
  const html = renderToStaticMarkup(React.createElement(Navbar))
  assert.match(html, /aria-label="Main navigation"/)
  assert.match(html, /aria-label="Open navigation menu"/)
  assert.match(html, /aria-expanded="false"/)
  assert.match(html, /class="site-nav__mobile" hidden=""/)
  assert.match(html, /aria-current="page"/)
  const controlledId = html.match(/aria-controls="([^"]+)"/)[1]
  assert.ok(html.includes(`id="${controlledId}"`))
  assert.match(html, /href="\/about"/)
})

test('code is readable and escaped before asynchronous highlighting is available', () => {
  const { ShikiCode } = loadComponent('ShikiCode', { '@/lib/utils': { cn } })
  const code = '<section>Hello & goodbye</section>'
  const html = renderToStaticMarkup(
    React.createElement(ShikiCode, { code, language: 'unknown' })
  )
  assert.match(
    html,
    /<code>&lt;section&gt;Hello &amp; goodbye&lt;\/section&gt;<\/code>/
  )
  assert.doesNotMatch(html, /<section>/)
})

test('footer gives icon links accessible names and avoids empty social destinations', () => {
  const { Footer } = loadComponent('Footer', {
    './ThemeToggle': { ThemeToggle },
    '@/lib/config': {
      appConfig: { ...config, author: 'Example Developer', github: 'example' }
    }
  })
  const html = renderToStaticMarkup(React.createElement(Footer))
  assert.match(html, /aria-label="Social links"/)
  assert.match(html, /aria-label="GitHub"/)
  assert.match(html, /href="https:\/\/github.com\/example"/)
  assert.doesNotMatch(html, /href="[^"]*undefined/)
})

test('default navigation retains a theme control while custom navigation avoids a duplicate footer toggle', () => {
  for (const navigationStyle of ['default', 'custom']) {
    const { Footer } = loadComponent('Footer', {
      '@/lib/config': {
        appConfig: { ...config, author: 'Example', navigationStyle }
      },
      './ThemeToggle': { ThemeToggle }
    })
    const html = renderToStaticMarkup(React.createElement(Footer))
    assert.equal(
      html.includes('aria-label="Switch to dark theme"'),
      navigationStyle === 'default'
    )
  }
})

test('reduced-motion rules apply independently of viewport breakpoints', () => {
  const css = postcss.parse(
    fs.readFileSync(path.resolve(__dirname, '../src/styles/global.css'), 'utf8')
  )
  const rules = []
  css.walkAtRules('media', (rule) => {
    if (rule.params === '(prefers-reduced-motion: reduce)') rules.push(rule)
  })
  assert.equal(rules.length, 1)
  assert.equal(rules[0].parent.type, 'root')
  assert.match(rules[0].toString(), /scroll-behavior:\s*auto\s*!important/)
})

test('processed global CSS retains shell styles, responsive navigation, and theme tokens', async () => {
  const filename = path.resolve(__dirname, '../src/styles/global.css')
  const result = await postcss([require('@tailwindcss/postcss')()]).process(
    fs.readFileSync(filename, 'utf8'),
    { from: filename }
  )
  const css = postcss.parse(result.css)
  const rules = new Map()
  css.walkRules((rule) => rules.set(rule.selector, rule))
  for (const selector of [
    '.site-header',
    '.site-nav',
    '.site-content',
    '.site-footer',
    '.site-footer__links',
    '.skip-link'
  ]) {
    assert.ok(rules.has(selector), `Missing compiled rule: ${selector}`)
  }
  assert.ok(
    rules.get('.site-header').nodes.some(
      (node) => node.prop === 'position' && node.value === 'fixed'
    )
  )
  const mobile = rules.get('.site-nav__mobile:not([hidden])')
  assert.equal(mobile.parent.name, 'media')
  assert.equal(mobile.parent.params, '(max-width: 900px)')
  assert.ok(
    rules.get(':root').nodes.some(
      (node) => node.prop === '--header-height' && node.value === '76px'
    )
  )
})

test('Notion code integration server-renders escaped readable content before highlighting', () => {
  const code = '<section>Hello & goodbye</section>'
  const { ShikiCode } = loadComponent('ShikiCode', { '@/lib/utils': { cn } })
  const { NotionRenderer } = loadComponent('NotionRenderer', {
    '@/lib/config': { appConfig: config },
    '@/lib/map-image-url': { mapImageUrl: (url) => url },
    '@/lib/search-notion': { searchNotion: () => undefined },
    '@/lib/utils': { cn },
    './styles.module.css': {},
    './CustomLink': {},
    './CustomPdf': {},
    './NotionPageHeader': {},
    './NotionProperties': {},
    './ShikiCode': { ShikiCode },
    'next/image': () => null,
    'next/link': () => null,
    'next/dynamic': () => () => null,
    'react-notion-x': {
      NotionRenderer: ({ components }) =>
        React.createElement(components.Code, {
          block: {
            type: 'code',
            properties: { title: [[code]], language: [['html']] }
          }
        })
    }
  })
  const html = renderToStaticMarkup(
    React.createElement(NotionRenderer, {
      recordMap: { block: {} },
      isDarkMode: false
    })
  )
  assert.match(
    html,
    /<code>&lt;section&gt;Hello &amp; goodbye&lt;\/section&gt;<\/code>/
  )
})

function renderNotionImages({ previewImages = false, cover = true } = {}) {
  const pageId = config.rootNotionPageId
  const imageId = '22345678123412341234123456789abc'
  const coverUrl = '/cover.png?table=block'
  const imageUrl = '/content.png?table=block'
  const recordMap = {
    block: {
      [pageId]: {
        role: 'reader',
        value: {
          id: pageId,
          type: 'page',
          parent_table: 'space',
          properties: { title: [['Image loading test']] },
          format: cover ? { page_cover: coverUrl } : {},
          content: [imageId]
        }
      },
      [imageId]: {
        role: 'reader',
        value: {
          id: imageId,
          type: 'image',
          parent_id: pageId,
          parent_table: 'block',
          properties: { source: [[imageUrl]] },
          format: { block_width: 800, block_height: 600 }
        }
      }
    },
    collection: {},
    collection_view: {},
    collection_query: {},
    signed_urls: {},
    user: {}
  }
  if (previewImages) {
    const preview = {
      originalWidth: 800,
      originalHeight: 600,
      dataURIBase64:
        'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    }
    recordMap.preview_images = {
      [coverUrl]: preview,
      [imageUrl]: preview
    }
  }
  const { NotionRenderer } = loadComponent('NotionRenderer', {
    '@/lib/config': { appConfig: config },
    '@/lib/map-image-url': { mapImageUrl: (url) => url },
    '@/lib/search-notion': { searchNotion: () => undefined },
    '@/lib/utils': { cn },
    './styles.module.css': {},
    './CustomLink': {},
    './CustomPdf': {},
    './NotionPageHeader': { NotionPageHeader: () => null },
    './NotionProperties': {},
    './ShikiCode': {},
    'next/dynamic': () => () => null
  })
  return renderToStaticMarkup(
    React.createElement(NotionRenderer, {
      recordMap,
      isDarkMode: false
    })
  )
}

for (const previewImages of [false, true]) {
  test(`Notion covers load eagerly with high fetch priority (previews: ${previewImages})`, () => {
    const html = renderNotionImages({ previewImages })
    const cover = html.match(/<img\b[^>]*class="notion-page-cover"[^>]*>/)?.[0]
    assert.ok(cover, 'The full Notion renderer must emit the cover image')
    assert.match(cover, /data-notion-image-loading="true"/)
    assert.match(cover, /fetchPriority="high"/)
    assert.doesNotMatch(cover, /loading="lazy"/)
    assert.match(cover, /object-position:center 50%/)
    if (previewImages) {
      assert.match(cover, /width="800" height="600"/)
      assert.match(cover, /data-nimg="1"/)
      assert.match(cover, /background-image:/)
    } else {
      assert.match(cover, /loading="eager"/)
      assert.doesNotMatch(cover, /position:absolute/)
    }
    assert.match(html, /<link\b[^>]*rel="preload"[^>]*as="image"/)
  })

  test(`ordinary proxied content images stay lazy (previews: ${previewImages})`, () => {
    const html = renderNotionImages({ previewImages })
    const image = html.match(/<img\b[^>]*alt="notion image"[^>]*>/)?.[0]
    assert.ok(image, 'The full Notion renderer must emit the content image')
    assert.match(image, /data-notion-image-loading="true"/)
    assert.match(image, /loading="lazy"/)
    assert.doesNotMatch(image, /fetchPriority="high"/)
    assert.doesNotMatch(html, /<link\b[^>]*(?:href|imageSrcSet)="[^"]*content/)
  })
}

test('coverless Notion pages do not promote every proxied image', () => {
  const html = renderNotionImages({ cover: false })
  assert.doesNotMatch(html, /fetchPriority="high"/)
  assert.match(html, /loading="lazy"/)
})

test('image shimmer only targets pending images and respects reduced motion', () => {
  const css = postcss.parse(
    fs.readFileSync(path.resolve(__dirname, '../src/styles/notion.css'), 'utf8')
  )
  const rules = []
  css.walkRules("img[data-notion-image-loading='true']", (rule) => {
    rules.push(rule)
  })
  assert.equal(rules.length, 2)
  assert.ok(
    rules[0].nodes.some(
      (node) =>
        node.prop === 'animation' &&
        node.value === 'notion-image-shimmer 1.5s linear infinite'
    )
  )
  assert.equal(rules[1].parent.params, '(prefers-reduced-motion: reduce)')
  assert.ok(
    rules[1].nodes.some(
      (node) => node.prop === 'animation' && node.value === 'none'
    )
  )
  let reservesSpace = false
  css.walkRules((rule) => {
    if (
      rule.selector.includes(':not([width])') &&
      rule.selector.includes(':not([height])') &&
      rule.selector.includes("[height='100%']") &&
      rule.nodes.some(
        (node) => node.prop === 'min-height' && node.value === '120px'
      )
    ) {
      reservesSpace = true
    }
  })
  assert.ok(reservesSpace, 'Images without dimensions need a visible skeleton')
})
