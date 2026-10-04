import { notionMaxConcurrency } from './config'

class NotionRateLimiter {
  private activeRequests = 0
  private requestQueue: (() => void)[] = []

  async execute<T>(fn: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    signal?.throwIfAborted()
    return new Promise((resolve, reject) => {
      const cancel = () => {
        const index = this.requestQueue.indexOf(run)
        if (index >= 0) this.requestQueue.splice(index, 1)
        reject(signal.reason)
      }
      const run = async () => {
        signal?.removeEventListener('abort', cancel)
        try {
          signal?.throwIfAborted()
          const result = await fn()
          resolve(result)
        } catch (err) {
          reject(err)
        } finally {
          this.activeRequests--
          this.processQueue()
        }
      }
      signal?.addEventListener('abort', cancel, { once: true })
      this.requestQueue.push(run)
      this.processQueue()
    })
  }

  private processQueue() {
    if (this.activeRequests < notionMaxConcurrency && this.requestQueue.length > 0) {
      const next = this.requestQueue.shift()
      if (next) {
        this.activeRequests++
        next()
      }
    }
  }
}

export const notionRateLimiter = new NotionRateLimiter()
