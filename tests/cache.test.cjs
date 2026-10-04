const assert = require('node:assert/strict')
const { test } = require('node:test')
const zlib = require('node:zlib')
const { loadModule } = require('./load-module.cjs')

const policy = loadModule('cache-policy')
const id = '8b473255-4974-4eba-9360-f0d6b88d419e'
const map = {
  block: {
    [id]: { value: { id, type: 'page', properties: { title: [['Example']] } } }
  },
  collection: {},
  collection_view: {},
  collection_query: {},
  signed_urls: {},
  notion_user: {}
}

function clock(t) {
  const original = Date.now
  let now = 1_000_000
  Date.now = () => now
  t.after(() => {
    Date.now = original
  })
  return (seconds) => {
    now += seconds * 1000
  }
}

function cacheFixture(t, { withRedis = false } = {}) {
  const originalUrl = process.env.UPSTASH_REDIS_REST_URL
  const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN
  const originalKVUrl = process.env.KV_REST_API_URL
  const originalKVToken = process.env.KV_REST_API_TOKEN
  const originalBuild = process.env.NOTION_BUILD_PHASE
  const originalPhase = process.env.NEXT_PHASE
  delete process.env.KV_REST_API_URL
  delete process.env.KV_REST_API_TOKEN
  delete process.env.NOTION_BUILD_PHASE
  delete process.env.NEXT_PHASE
  if (withRedis) {
    process.env.UPSTASH_REDIS_REST_URL = 'https://cache.test'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'fixture'
  } else {
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
  }
  t.after(() => {
    for (const [key, value] of Object.entries({
      UPSTASH_REDIS_REST_URL: originalUrl,
      UPSTASH_REDIS_REST_TOKEN: originalToken,
      KV_REST_API_URL: originalKVUrl,
      KV_REST_API_TOKEN: originalKVToken,
      NOTION_BUILD_PHASE: originalBuild,
      NEXT_PHASE: originalPhase
    })) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })
  const files = new Map()
  const redisValues = new Map()
  const stats = { gets: 0, writes: 0 }
  const missing = () =>
    Object.assign(new Error('Not found'), { code: 'ENOENT' })
  const fs = {
    async readFile(path) {
      if (!files.has(path)) throw missing()
      return files.get(path)
    },
    async mkdir() {
      return undefined
    },
    async writeFile(path, value) {
      files.set(path, value)
      stats.writes++
    },
    async rename(from, to) {
      files.set(to, files.get(from))
      files.delete(from)
    },
    async unlink(path) {
      if (!files.delete(path)) throw missing()
    }
  }
  class Redis {
    async get(key) {
      stats.gets++
      return redisValues.get(key) ?? null
    }
    async set(key, value) {
      redisValues.set(key, value)
    }
  }
  const controlFlow = new Error('framework control flow')
  const { NotionCache } = loadModule('notion-cache', {
    './config': {
      notionCacheDir: '.fixture-cache',
      notionCacheTTL: 600000,
      revalidateTTL: 3600,
      redisPageTTL: 604800,
      redisNavTTL: 604800,
      redisSitemapTTL: 86400
    },
    './cache-policy': policy,
    'node:fs': { promises: fs },
    '@upstash/redis': { Redis },
    'next/navigation': {
      unstable_rethrow(error) {
        if (error === controlFlow) throw error
      }
    }
  })
  return {
    cache: new NotionCache(),
    files,
    redisValues,
    stats,
    controlFlow,
    fs
  }
}

test('cache policy rejects future timestamps and expires at the exact TTL', () => {
  assert.equal(policy.isFresh(1000, 10, 10999), true)
  assert.equal(policy.isFresh(1000, 10, 11000), false)
  assert.equal(policy.isFresh(11001, 10, 11000), false)
  assert.equal(policy.isFresh(NaN, 10, 11000), false)
})

test('memory cache evicts least recently used entries and oversized values', (t) => {
  clock(t)
  const cache = new policy.BoundedCache(2, 400)
  const entry = (data) => ({ version: 1, timestamp: Date.now(), data })
  cache.set('a', entry('first'))
  cache.set('b', entry('second'))
  assert.ok(cache.get('a', 10))
  cache.set('c', entry('third'))
  assert.equal(cache.get('b', 10), undefined)
  cache.set('large', entry('x'.repeat(1000)))
  assert.equal(cache.get('large', 10), undefined)
  assert.ok(cache.get('a', 10))
})

test('filesystem and memory page/nav caches retain original age and isolate mutations', async (t) => {
  const advance = clock(t)
  const { cache, files } = cacheFixture(t)
  await cache.setPage(id, map)
  await cache.setNavLinkPage(id, map)
  const first = await cache.getPage(id.replace(/-/g, ''))
  first.block[id].value.properties.title = [['Changed']]
  assert.deepEqual((await cache.getPage(id)).block[id].value.properties.title, [
    ['Example']
  ])
  advance(600)
  await cache.clearMemory()
  assert.ok(await cache.getPage(id))
  assert.ok(await cache.getNavLinkPage(id))
  advance(3000)
  assert.equal(await cache.getPage(id), null)
  assert.equal(await cache.getNavLinkPage(id), null)
  assert.equal(files.size, 2)
  assert.equal(
    [...files.values()].some(
      (value) => JSON.parse(value).timestamp !== 1_000_000
    ),
    false
  )
})

test('Redis hydration and warmup preserve source age without promoting stale runtime data', async (t) => {
  const advance = clock(t)
  const { cache, files, redisValues, stats } = cacheFixture(t, {
    withRedis: true
  })
  const entry = { data: map, timestamp: Date.now() }
  redisValues.set(
    `page:${id.replace(/-/g, '')}`,
    zlib.gzipSync(JSON.stringify(entry)).toString('base64')
  )
  advance(3500)
  assert.ok(await cache.getPage(id))
  assert.equal(JSON.parse([...files.values()][0]).timestamp, entry.timestamp)
  advance(100)
  assert.equal(await cache.getPage(id), null)
  assert.ok(await cache.getPage(id, 'build-warmup'))
  await cache.clearMemory()
  assert.equal(await cache.getPage(id), null)
  assert.ok(stats.gets > 0)
})

test('sitemap caching separates keys, preserves age and never shares mutable objects', async (t) => {
  const advance = clock(t)
  const { cache } = cacheFixture(t)
  await cache.setSitemap('one', { canonicalPageMap: { article: id } })
  const result = await cache.getSitemap('one')
  result.canonicalPageMap.article = 'changed'
  assert.equal((await cache.getSitemap('one')).canonicalPageMap.article, id)
  assert.equal(await cache.getSitemap('two'), null)
  advance(3600)
  assert.equal(await cache.getSitemap('one'), null)
})

test('invalid IDs are rejected before filesystem access', async (t) => {
  const { cache, stats } = cacheFixture(t)
  await assert.rejects(cache.getPage('../outside'), /Invalid Notion page ID/)
  await assert.rejects(
    cache.setNavLinkPage('bad', map),
    /Invalid Notion page ID/
  )
  assert.equal(stats.writes, 0)
})

test('framework control-flow errors are rethrown rather than swallowed', async (t) => {
  const { cache, fs, controlFlow } = cacheFixture(t)
  fs.readFile = async () => {
    throw controlFlow
  }
  await assert.rejects(cache.getPage(id), (error) => error === controlFlow)
})

test('page fetching deduplicates raw work but returns independent enriched results on hits and misses', async () => {
  const stored = new Map()
  let fetches = 0
  const navId = '12345678-1234-1234-1234-123456789abc'
  const rawMap = structuredClone(map)
  rawMap.collection_query = {
    collection: {
      view: { collection_group_results: { blockIds: ['one', 'two'] } }
    }
  }
  const { getPage } = loadModule('notion', {
    './config': { navigationStyle: 'custom', rootNotionPageId: id },
    './notion-api': {
      notion: {
        async getPage() {
          fetches++
          await Promise.resolve()
          return structuredClone(rawMap)
        }
      }
    },
    './notion-cache': {
      notionCache: {
        async getPage(key) {
          return stored.has(key) ? structuredClone(stored.get(key)) : null
        },
        async setPage(key, value) {
          stored.set(key, structuredClone(value))
        }
      }
    },
    './notion-retry': { withRetry: (fn) => fn(new AbortController().signal) },
    './notion-filters': {
      applyFormatPropertyFilters(value) {
        value.collection_query.collection.view.collection_group_results.blockIds.pop()
      }
    },
    './notion-collections': { fetchLinkedCollections: async (value) => value },
    './notion-navigation': {
      getNavigationLinkPages: async () => [
        {
          ...structuredClone(map),
          block: { [navId]: { value: { id: navId, type: 'page' } } }
        }
      ]
    }
  })
  const [first, second] = await Promise.all([
    getPage(id),
    getPage(id.replace(/-/g, ''))
  ])
  assert.equal(fetches, 1)
  first.collection_query.collection.view.collection_group_results.blockIds.length = 0
  assert.deepEqual(
    second.collection_query.collection.view.collection_group_results.blockIds,
    ['one']
  )
  const hit = await getPage(id)
  assert.ok(hit.block[navId])
  assert.deepEqual(
    hit.collection_query.collection.view.collection_group_results.blockIds,
    ['one']
  )
  assert.deepEqual(
    stored.get(id).collection_query.collection.view.collection_group_results
      .blockIds,
    ['one', 'two']
  )
})

test('navigation preserves overrides and recognizes equivalent root ID forms', () => {
  const { resolveNavigationUrl } = loadModule('navigation')
  assert.equal(
    resolveNavigationUrl({ pageId: id }, {}, id.replace(/-/g, '')),
    '/'
  )
  assert.equal(
    resolveNavigationUrl(
      { pageId: id },
      { [id.replace(/-/g, '')]: '/about' },
      'other'
    ),
    '/about'
  )
  assert.equal(
    resolveNavigationUrl({ url: 'https://example.com' }, {}, id),
    'https://example.com'
  )
  assert.equal(resolveNavigationUrl({}, {}, id), undefined)
})

test('tag filtering remains isolated for sequential and concurrent requests', async (t) => {
  const original = process.env.BLOG_PAGE_ID
  process.env.BLOG_PAGE_ID = id
  t.after(() => {
    if (original === undefined) delete process.env.BLOG_PAGE_ID
    else process.env.BLOG_PAGE_ID = original
  })
  const originalMap = structuredClone(map)
  originalMap.block.alpha = {
    value: { id: 'alpha', type: 'page', properties: { tag: [['Alpha']] } }
  }
  originalMap.block.beta = {
    value: { id: 'beta', type: 'page', properties: { tag: [['Beta']] } }
  }
  originalMap.collection_query = {
    collection: {
      view: { collection_group_results: { blockIds: ['alpha', 'beta'] } }
    }
  }
  const { resolveTagPage } = loadModule('tag-service', {
    './resolve-notion-page': {
      resolveNotionPage: async () => ({ pageId: id, recordMap: originalMap })
    },
    './tags': {
      getTagsContext(value) {
        return {
          queryResults:
            value.collection_query.collection.view.collection_group_results,
          propertyToFilterId: 'tag',
          propertyToFilter: [
            'tag',
            { options: [{ value: 'Alpha' }, { value: 'Beta' }] }
          ]
        }
      }
    },
    'notion-utils': { normalizeTitle: (value) => value.toLowerCase() }
  })
  const ids = (result) =>
    result.recordMap.collection_query.collection.view.collection_group_results
      .blockIds
  assert.deepEqual(ids(await resolveTagPage('alpha')), ['alpha'])
  assert.deepEqual(ids(await resolveTagPage('beta')), ['beta'])
  const [alpha, beta] = await Promise.all([
    resolveTagPage('alpha'),
    resolveTagPage('beta')
  ])
  assert.deepEqual(ids(alpha), ['alpha'])
  assert.deepEqual(ids(beta), ['beta'])
  assert.deepEqual(
    originalMap.collection_query.collection.view.collection_group_results
      .blockIds,
    ['alpha', 'beta']
  )
})

test('block guards handle wrapped responses and canonical home URLs handle UUID forms', () => {
  const { getPageBlock } = loadModule('notion-helpers')
  const nested = structuredClone(map)
  nested.block[id] = { value: nested.block[id] }
  assert.equal(getPageBlock(nested, id.replace(/-/g, '')).id, id)
  assert.equal(getPageBlock({ block: {} }, id), undefined)
  const { mapPageUrl, getCanonicalPageUrl } = loadModule('map-page-url', {
    './config': { includeNotionIdInUrls: false },
    './get-canonical-page-id': { getCanonicalPageId: () => 'article' }
  })
  const site = { rootNotionPageId: id, domain: 'example.com' }
  assert.equal(
    mapPageUrl(
      site,
      map,
      new URLSearchParams('lite=true')
    )(id.replace(/-/g, '')),
    '/?lite=true'
  )
  assert.equal(
    getCanonicalPageUrl(site, map)(id.replace(/-/g, '')),
    'https://example.com'
  )
})
