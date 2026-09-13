import { notionRateLimiter } from './notion-rate-limiter'
import { notionMaxRetryBudget, notionMaxRetryDelay, notionRetryDelay } from './config'

/**
 * Wraps a Notion API call with exponential-backoff retries, concurrency limiting,
 * Retry-After header support, and jitter to prevent synchronized bursts.
 *
 * All delays are capped at `notionMaxRetryDelay`, and the whole retry loop bails out
 * once `notionMaxRetryBudget` has elapsed. This keeps worst-case failures well under the
 * serverless function's max duration, so a persistent rate limit surfaces as a normal
 * thrown error (caught by the app's error boundary) instead of the platform killing the
 * invocation outright and returning a generic 500 page.
 */
export async function withRetry<T>(fn: () => Promise<T>, retries = 5, delay = 1000): Promise<T> {
  const startTime = Date.now()

  for (let i = 0; i < retries; i++) {
    try {
      return await notionRateLimiter.execute(fn)
    } catch (err: any) {
      const elapsed = Date.now() - startTime
      if (i === retries - 1 || elapsed >= notionMaxRetryBudget) throw err

      const is429 =
        err.message?.includes('429') || err.status === 429 || err.statusCode === 429

      let currentDelay = delay
      if (is429) {
        const retryAfter = err.response?.headers?.get('Retry-After') || err.headers?.['retry-after']
        const retryAfterSeconds = retryAfter ? parseInt(retryAfter, 10) : 0
        currentDelay = retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : notionRetryDelay
        console.warn(`[Notion API] 429: waiting ${currentDelay}ms`)
      }

      currentDelay = Math.min(currentDelay, notionMaxRetryDelay)
      const jitter = Math.floor(Math.random() * 500)
      let finalDelay = currentDelay + jitter

      // Don't sleep past the remaining retry budget.
      const remainingBudget = notionMaxRetryBudget - elapsed
      finalDelay = Math.min(finalDelay, Math.max(remainingBudget, 0))

      console.warn(`[Notion API] Retrying in ${finalDelay}ms...`)

      await new Promise((resolve) => setTimeout(resolve, finalDelay))
      delay = Math.min(delay * 2, notionMaxRetryDelay)
    }
  }
  throw new Error('Retry limit reached')
}
