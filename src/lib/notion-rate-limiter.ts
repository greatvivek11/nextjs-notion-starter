import { notionMaxConcurrency } from './config'

class NotionRateLimiter {
  private activeRequests = 0
  private requestQueue: (() => void)[] = []

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await fn()
          resolve(result)
        } catch (err) {
          reject(err)
        } finally {
          this.activeRequests--
          this.processQueue()
        }
      })
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
