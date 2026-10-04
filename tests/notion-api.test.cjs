const assert = require('node:assert/strict')
const http = require('node:http')
const { test } = require('node:test')
const { loadModule } = require('./load-module.cjs')

const config = {
  notionMaxConcurrency: 1,
  notionMaxRetryBudget: 80,
  notionMaxRetryDelay: 5,
  notionRetryDelay: 3,
  notionRequestTimeout: 30
}

function createRetry() {
  const limiter = loadModule('notion-rate-limiter', { './config': config })
  return {
    ...limiter,
    ...loadModule('notion-retry', {
      './config': config,
      './notion-rate-limiter': limiter
    })
  }
}

function fetchError(status, retryAfter) {
  const error = new Error(`HTTP ${status}`)
  error.name = 'FetchError'
  error.statusCode = status
  error.response = new Response(null, {
    status,
    headers: retryAfter === undefined ? {} : { 'Retry-After': retryAfter }
  })
  return error
}

test('returns successful results', async () => {
  const { withRetry } = createRetry()
  assert.equal(
    await withRetry(async (signal) => {
      assert.equal(signal.aborted, false)
      return 'page'
    }),
    'page'
  )
})

test('does not retry permanent HTTP errors or programming errors', async () => {
  const { withRetry } = createRetry()
  for (const error of [
    fetchError(400),
    fetchError(401),
    fetchError(403),
    fetchError(404),
    new TypeError('bug')
  ]) {
    let calls = 0
    await assert.rejects(
      withRetry(async () => {
        calls++
        throw error
      }),
      (actual) => actual === error
    )
    assert.equal(calls, 1)
  }
})

test('retries 429, server failures, and network errors', async () => {
  const { withRetry } = createRetry()
  const networkError = new Error('network unavailable')
  networkError.name = 'FetchError'
  for (const error of [fetchError(429, '0'), fetchError(503), networkError]) {
    let calls = 0
    assert.equal(
      await withRetry(async () => {
        if (++calls === 1) throw error
        return 'page'
      }),
      'page'
    )
    assert.equal(calls, 2)
  }
})

test('does not shorten Retry-After when it exceeds the remaining budget', async () => {
  const { withRetry } = createRetry()
  for (const value of ['60', new Date(Date.now() + 60000).toUTCString()]) {
    let calls = 0
    const error = fetchError(429, value)
    await assert.rejects(
      withRetry(async () => {
        calls++
        throw error
      }),
      (actual) => actual === error
    )
    assert.equal(calls, 1)
  }
})

test('honors a Retry-After longer than the normal backoff cap', async () => {
  const { withRetry } = createRetry()
  const started = Date.now()
  let calls = 0
  assert.equal(
    await withRetry(async () => {
      if (++calls === 1) throw fetchError(429, '0.015')
      return 'page'
    }),
    'page'
  )
  assert.equal(calls, 2)
  assert.ok(Date.now() - started >= 15)
})

test('enforces attempt limits and rejects invalid retry settings', async () => {
  const { withRetry } = createRetry()
  let calls = 0
  await assert.rejects(
    withRetry(async () => {
      calls++
      throw fetchError(503)
    }, 2)
  )
  assert.equal(calls, 2)
  for (const [retries, delay] of [
    [0, 1],
    [1.5, 1],
    [1, -1],
    [1, NaN]
  ]) {
    await assert.rejects(
      withRetry(async () => 'page', retries, delay),
      RangeError
    )
  }
})

test('aborts an in-flight operation at the overall deadline', async () => {
  const { withRetry } = createRetry()
  const started = Date.now()
  let calls = 0
  await assert.rejects(
    withRetry((signal) => {
      calls++
      return new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), {
          once: true
        })
      })
    }),
    { name: 'TimeoutError' }
  )
  assert.equal(calls, 1)
  assert.ok(Date.now() - started < config.notionMaxRetryBudget + 200)
})

test('removes expired queued operations without consuming a slot', async () => {
  const { withRetry, notionRateLimiter } = createRetry()
  let release
  const blocker = notionRateLimiter.execute(
    () =>
      new Promise((resolve) => {
        release = resolve
      })
  )
  let calls = 0
  await assert.rejects(
    withRetry(async () => {
      calls++
    }),
    { name: 'TimeoutError' }
  )
  assert.equal(calls, 0)
  release()
  await blocker
  assert.equal(await notionRateLimiter.execute(async () => 'next'), 'next')
  assert.equal(calls, 0)
})

test('all HTTP endpoints use the application User-Agent and honor request and caller deadlines', async () => {
  const headers = []
  const server = http.createServer((req, res) => {
    headers.push(req.headers['user-agent'])
    if (req.url === '/loadPageChunk') {
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ recordMap: { block: {} } }))
    }
    // Collection endpoint intentionally hangs, despite its SDK timeout being 60s.
  })

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { NotionAPI } = require('notion-client')
  class LocalNotionAPI extends NotionAPI {
    constructor(options) {
      super({
        ...options,
        apiBaseUrl: `http://127.0.0.1:${server.address().port}`
      })
    }
  }
  const { notion } = loadModule('notion-api', {
    './config': config,
    'notion-client': { NotionAPI: LocalNotionAPI }
  })
  try {
    await notion.getPageRaw('8b47325549744eba9360f0d6b88d419e')
    let started = Date.now()
    await assert.rejects(notion.getCollectionData('collection', 'view'))
    assert.ok(Date.now() - started < config.notionRequestTimeout + 200)

    const controller = new AbortController()
    started = Date.now()
    const timer = setTimeout(() => controller.abort(), 5)
    try {
      await assert.rejects(
        notion.getCollectionData('collection', 'view', undefined, {
          ofetchOptions: { signal: controller.signal }
        })
      )
      assert.equal(controller.signal.aborted, true)
      assert.ok(Date.now() - started < 200)
    } finally {
      clearTimeout(timer)
    }
    assert.ok(headers.length >= 2)
    assert.ok(headers.every((header) => header === 'nextjs-notion-starter'))
  } finally {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
  }
})

test('merges the recordMap and reducer results from a linked collection response', async () => {
  const map = {
    block: {
      page: { value: { id: 'page', type: 'page', content: ['viewBlock'] } },
      viewBlock: { value: { type: 'collection_view', view_ids: ['view'] } }
    },
    collection: {},
    collection_view: {
      view: { value: { format: { collection_pointer: { id: 'collection' } } } }
    },
    notion_user: {},
    collection_query: {},
    signed_urls: {}
  }
  const notion = {
    async getCollectionData(cid, vid, view, options) {
      assert.equal(cid, 'collection')
      assert.equal(vid, 'view')
      assert.ok(options.ofetchOptions.signal instanceof AbortSignal)
      return {
        recordMap: {
          block: { article: { value: { id: 'article', type: 'page' } } }
        },
        result: {
          reducerResults: {
            collection_group_results: { blockIds: ['article'] }
          }
        }
      }
    },
    async getBlocks() {
      return { recordMap: { block: {} } }
    }
  }
  const { withRetry } = createRetry()
  const { fetchLinkedCollections } = loadModule('notion-collections', {
    './notion-api': { notion },
    './notion-retry': { withRetry },
    './notion-helpers': loadModule('notion-helpers', {})
  })
  const result = await fetchLinkedCollections(map, 'page')
  assert.ok(result.block.article)
  assert.deepEqual(
    result.collection_query.collection.view.collection_group_results.blockIds,
    ['article']
  )
})
