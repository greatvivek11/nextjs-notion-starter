import { setTimeout as sleep } from 'node:timers/promises'
import { notionRateLimiter } from './notion-rate-limiter'
import { notionMaxRetryBudget, notionMaxRetryDelay, notionRetryDelay } from './config'

interface NotionFetchError extends Error {
  status?: number
  statusCode?: number
  response?: Response
  headers?: Record<string, string>
}

const retryableStatuses = new Set([408, 429, 500, 502, 503, 504])

function retryAfterDelay(error: NotionFetchError): number | undefined {
  const value = error.response?.headers?.get('Retry-After') || error.headers?.['retry-after']
  if (!value) return undefined
  const seconds = Number(value)
  const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - Date.now()
  return Number.isFinite(delay) ? Math.max(0, delay) : undefined
}

export async function withRetry<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  retries = 5,
  delay = 1000
): Promise<T> {
  if (!Number.isInteger(retries) || retries < 1 || !Number.isFinite(delay) || delay < 0) {
    throw new RangeError('Notion retries must be positive and delay must be non-negative')
  }

  const deadline = Date.now() + notionMaxRetryBudget
  const controller = new AbortController()
  const { signal } = controller
  const timer = setTimeout(
    () => controller.abort(new DOMException('Notion retry budget exceeded', 'TimeoutError')),
    notionMaxRetryBudget
  )

  try {
    for (let attempt = 0; attempt < retries; attempt++) {
      signal.throwIfAborted()
      try {
        return await notionRateLimiter.execute(() => fn(signal), signal)
      } catch (error) {
        if (!(error instanceof Error)) throw error
        const fetchError = error as NotionFetchError
        const status = fetchError.statusCode ?? fetchError.status ?? fetchError.response?.status
        const retryable = status
          ? retryableStatuses.has(status)
          : ['FetchError', 'TimeoutError'].includes(error.name)
        if (signal.aborted || !retryable || attempt === retries - 1) throw error

        const retryAfter = retryAfterDelay(fetchError)
        const backoff = status === 429 ? notionRetryDelay : delay
        const finalDelay = retryAfter ?? Math.min(backoff + Math.floor(Math.random() * 500), notionMaxRetryDelay)
        // Never retry earlier than Retry-After, or begin another attempt after the deadline.
        if (finalDelay >= deadline - Date.now()) throw error

        console.warn(`[Notion API] ${status ?? error.name}: retrying in ${finalDelay}ms (attempt ${attempt + 1}/${retries})`)
        await sleep(finalDelay, undefined, { signal })
        delay = Math.min(delay * 2, notionMaxRetryDelay)
      }
    }
    throw new Error('Notion retry limit reached')
  } finally {
    clearTimeout(timer)
  }
}
