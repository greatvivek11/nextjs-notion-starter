import { notionRateLimiter } from './notion-rate-limiter'
import { notionRetryDelay } from './config'

/**
 * Wraps a Notion API call with exponential-backoff retries, concurrency limiting,
 * Retry-After header support, and jitter to prevent synchronized bursts.
 */
export async function withRetry<T>(fn: () => Promise<T>, retries = 8, delay = 1000): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await notionRateLimiter.execute(fn)
    } catch (err: any) {
      if (i === retries - 1) throw err

      const is429 =
        err.message?.includes('429') || err.status === 429 || err.statusCode === 429

      let currentDelay = delay
      if (is429) {
        const retryAfter = err.response?.headers?.get('Retry-After') || err.headers?.['retry-after']
        const retryAfterSeconds = retryAfter ? parseInt(retryAfter, 10) : 0
        currentDelay = retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : notionRetryDelay
        console.warn(`[Notion API] 429: waiting ${currentDelay}ms`)
      }

      const jitter = Math.floor(Math.random() * 2000)
      const finalDelay = currentDelay + jitter
      console.warn(`[Notion API] Retrying in ${finalDelay}ms...`)

      await new Promise((resolve) => setTimeout(resolve, finalDelay))
      delay *= 2
    }
  }
  throw new Error('Retry limit reached')
}
