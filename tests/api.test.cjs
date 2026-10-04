const assert = require('node:assert/strict')
const { test } = require('node:test')
const { loadModule } = require('./load-module.cjs')

function response() {
  return {
    statusCode: 200,
    headers: {},
    payload: undefined,
    setHeader(key, value) {
      this.headers[key] = value
    },
    status(value) {
      this.statusCode = value
      return this
    },
    json(value) {
      this.payload = value
      return this
    },
    send(value) {
      this.payload = value
      return this
    }
  }
}

test('search rejects malformed input and reports upstream errors without success responses', async () => {
  let calls = 0
  const handler = loadModule('../pages/api/search-notion', {
    '@/lib/notion': {
      async search() {
        calls++
        throw new Error('upstream')
      }
    }
  }).default
  const invalid = response()
  await handler({ method: 'POST', body: { query: 123 } }, invalid)
  assert.equal(invalid.statusCode, 400)
  assert.equal(calls, 0)
  const failed = response()
  await handler({ method: 'POST', body: { query: 'react' } }, failed)
  assert.equal(failed.statusCode, 502)
  assert.equal(calls, 1)
})

test('search preserves successful result shape and intentionally does not imply POST CDN caching', async () => {
  const results = { results: [], recordMap: { block: {} } }
  const handler = loadModule('../pages/api/search-notion', {
    '@/lib/notion': { search: async () => results }
  }).default
  const res = response()
  await handler({ method: 'POST', body: { query: '' } }, res)
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.payload, results)
  assert.equal(res.headers['Cache-Control'], 'no-store')
})

test('cron checks configuration, webhook status and timeout signal', async (t) => {
  const originalSecret = process.env.CRON_SECRET
  const originalUrl = process.env.CRON_URL
  const originalFetch = global.fetch
  process.env.CRON_SECRET = 'test-secret'
  delete process.env.CRON_URL
  t.after(() => {
    global.fetch = originalFetch
    if (originalSecret === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = originalSecret
    if (originalUrl === undefined) delete process.env.CRON_URL
    else process.env.CRON_URL = originalUrl
  })
  const handler = loadModule('../pages/api/cron').default
  const request = { headers: { authorization: 'Bearer test-secret' } }
  const unauthorized = response()
  await handler({ headers: {} }, unauthorized)
  assert.equal(unauthorized.statusCode, 401)
  const missing = response()
  await handler(request, missing)
  assert.equal(missing.statusCode, 503)
  process.env.CRON_URL = 'https://webhook.test'
  global.fetch = async (_, options) => {
    assert.ok(options.signal instanceof AbortSignal)
    return new Response(null, { status: 503 })
  }
  const failed = response()
  await handler(request, failed)
  assert.equal(failed.statusCode, 502)
  assert.equal(failed.payload.success, false)
  global.fetch = async () => new Response(null, { status: 200 })
  const succeeded = response()
  await handler(request, succeeded)
  assert.equal(succeeded.statusCode, 200)
  assert.equal(succeeded.payload.success, true)
})
