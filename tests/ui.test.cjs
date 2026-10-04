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
