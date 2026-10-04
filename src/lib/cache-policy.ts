export interface CacheEntry<T> {
  version: 1
  data: T
  timestamp: number
}

export function isFresh(
  timestamp: number,
  ttlSeconds: number,
  now = Date.now()
): boolean {
  return (
    Number.isFinite(timestamp) &&
    timestamp <= now &&
    now - timestamp < ttlSeconds * 1000
  )
}

export class BoundedCache<T> {
  private entries = new Map<string, { entry: CacheEntry<T>; bytes: number }>()
  private bytes = 0

  constructor(
    private readonly maxEntries = 64,
    private readonly maxBytes = 32 * 1024 * 1024
  ) {
    if (maxEntries < 1 || maxBytes < 1) {
      throw new RangeError('Cache capacity must be positive.')
    }
  }

  get(key: string, ttlSeconds: number): CacheEntry<T> | undefined {
    const cached = this.entries.get(key)
    if (!cached) return undefined
    if (!isFresh(cached.entry.timestamp, ttlSeconds)) {
      this.delete(key)
      return undefined
    }
    this.entries.delete(key)
    this.entries.set(key, cached)
    return cached.entry
  }

  set(key: string, entry: CacheEntry<T>): void {
    this.delete(key)
    const bytes = Buffer.byteLength(JSON.stringify(entry))
    if (bytes > this.maxBytes) return
    this.entries.set(key, { entry, bytes })
    this.bytes += bytes
    while (this.entries.size > this.maxEntries || this.bytes > this.maxBytes) {
      const oldest = this.entries.keys().next().value
      if (oldest === undefined) break
      this.delete(oldest)
    }
  }

  private delete(key: string): void {
    const cached = this.entries.get(key)
    if (cached) this.bytes -= cached.bytes
    this.entries.delete(key)
  }

  clear(): void {
    this.entries.clear()
    this.bytes = 0
  }
}
import { Buffer } from 'node:buffer'
