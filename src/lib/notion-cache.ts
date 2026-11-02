import { createHash, randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import zlib from 'node:zlib'
import { Redis } from '@upstash/redis'
import type { ExtendedRecordMap } from 'notion-types'
import { unstable_rethrow } from 'next/navigation'
import { BoundedCache, type CacheEntry, isFresh } from './cache-policy'
import {
  notionCacheDir,
  notionCacheTTL,
  redisNavTTL,
  redisPageTTL,
  redisSitemapTTL,
  revalidateTTL
} from './config'
import type { SiteMap } from './types'

const gzip = promisify(zlib.gzip)
const gunzip = promisify(zlib.gunzip)
const PAGE_ID =
  /^(?:[0-9a-f]{32}|[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})$/i
const redisUrl =
  process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
const redisToken =
  process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
const redis =
  redisUrl && redisToken
    ? new Redis({
        url: redisUrl,
        token: redisToken,
        cache: 'default',
        retry: false,
        signal: () => AbortSignal.timeout(2000)
      })
    : null

function compactSitemap<T>(key: string, entry: CacheEntry<T>): boolean {
  if (
    key.startsWith('sitemap:') &&
    typeof entry.data === 'object' &&
    entry.data !== null &&
    'pageMap' in entry.data
  ) {
    return Reflect.deleteProperty(entry.data, 'pageMap')
  }
  return false
}

function normalizePageId(pageId: string): string {
  if (!PAGE_ID.test(pageId))
    throw new Error('Invalid Notion page ID for cache.')
  const id = pageId.replace(/-/g, '').toLowerCase()
  return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(
    16,
    20
  )}-${id.slice(20)}`
}

function isEntry<T>(value: unknown): value is CacheEntry<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'data' in value &&
    'timestamp' in value &&
    typeof value.timestamp === 'number' &&
    Number.isFinite(value.timestamp) &&
    typeof value.data === 'object' &&
    value.data !== null
  )
}

function validPayload(key: string, value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  const field = key.startsWith('sitemap:') ? 'canonicalPageMap' : 'block'
  return (
    field in value &&
    typeof value[field] === 'object' &&
    value[field] !== null &&
    !Array.isArray(value[field])
  )
}

function logCacheError(operation: string, key: string, error: unknown) {
  unstable_rethrow(error)
  // Upstash errors embed the entire command, including compressed page data.
  const message =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  console.warn(`[Notion Cache] ${operation} failed`, {
    key,
    error: message.slice(0, 500).split(', command was:')[0]
  })
}

export class NotionCache {
  private pages = new BoundedCache<ExtendedRecordMap>()
  private navigation = new BoundedCache<ExtendedRecordMap>(32, 8 * 1024 * 1024)
  private sitemaps = new BoundedCache<Partial<SiteMap>>(2, 16 * 1024 * 1024)
  private redisRetryAfter = 0

  get isBuildPhase(): boolean {
    return (
      process.env.NEXT_PHASE === 'phase-production-build' ||
      process.env.NOTION_BUILD_PHASE === 'true'
    )
  }

  private get directory(): string {
    return process.env.VERCEL && !this.isBuildPhase
      ? path.join(tmpdir(), notionCacheDir)
      : path.join(process.cwd(), notionCacheDir)
  }

  private canUseRedis(source?: string): boolean {
    return (
      Date.now() >= this.redisRetryAfter &&
      (!this.isBuildPhase || source === 'build-warmup')
    )
  }

  private redisFailed(operation: string, key: string, error: unknown) {
    logCacheError(`${operation}; bypassing Redis for 60s`, key, error)
    this.redisRetryAfter = Date.now() + 60_000
  }

  private async read<T>(
    key: string,
    memory: BoundedCache<T>,
    retentionTTL: number,
    source?: string
  ): Promise<T | null> {
    const build = this.isBuildPhase || source === 'build-warmup'
    const freshnessTTL = build ? retentionTTL : revalidateTTL
    const cached = memory.get(
      key,
      Math.min(notionCacheTTL / 1000, freshnessTTL)
    )
    if (cached) return structuredClone(cached.data)

    const filePath = this.filePath(key)
    try {
      const value: unknown = JSON.parse(await fs.readFile(filePath, 'utf8'))
      // Legacy raw-map files are deliberately not treated as freshly fetched data.
      if (isEntry<T>(value)) {
        if (!validPayload(key, value.data)) {
          throw new Error('Invalid filesystem cache payload.')
        }
        const entry: CacheEntry<T> = { ...value, version: 1 }
        if (compactSitemap(key, entry)) {
          await this.writeFile(key, entry)
          await this.writeRedis(key, entry, retentionTTL, source)
        }
        if (isFresh(entry.timestamp, freshnessTTL)) {
          memory.set(key, entry)
          return structuredClone(entry.data)
        }
      }
    } catch (error) {
      if (
        !(error instanceof Error && 'code' in error && error.code === 'ENOENT')
      ) {
        logCacheError('filesystem read', key, error)
      }
    }

    if (redis && this.canUseRedis(source)) {
      try {
        let compressed = await redis.get<string>(key)
        if (!compressed && /^(page|nav):/.test(key)) {
          compressed = await redis.get<string>(key.replace(/-/g, ''))
        }
        if (compressed) {
          const value: unknown = JSON.parse(
            (await gunzip(Buffer.from(compressed, 'base64'))).toString()
          )
          if (!isEntry<T>(value))
            throw new Error('Invalid Redis cache envelope.')
          if (!validPayload(key, value.data))
            throw new Error('Invalid Redis cache payload.')
          const entry: CacheEntry<T> = { ...value, version: 1 }
          if (compactSitemap(key, entry)) {
            await this.writeRedis(key, entry, retentionTTL, source)
          }
          if (isFresh(entry.timestamp, freshnessTTL)) {
            memory.set(key, entry)
            await this.writeFile(key, entry)
            return structuredClone(entry.data)
          }
        }
      } catch (error) {
        this.redisFailed('Redis read', key, error)
      }
    }
    return null
  }

  private async write<T>(
    key: string,
    data: T,
    memory: BoundedCache<T>,
    retentionTTL: number,
    source?: string
  ): Promise<void> {
    const entry: CacheEntry<T> = {
      version: 1,
      data: structuredClone(data),
      timestamp: Date.now()
    }
    compactSitemap(key, entry)
    memory.set(key, entry)
    await this.writeFile(key, entry)
    await this.writeRedis(key, entry, retentionTTL, source)
  }

  private async writeRedis<T>(
    key: string,
    entry: CacheEntry<T>,
    retentionTTL: number,
    source?: string
  ): Promise<void> {
    if (!isFresh(entry.timestamp, retentionTTL)) return
    const remainingTTL =
      retentionTTL - Math.ceil((Date.now() - entry.timestamp) / 1000)
    if (remainingTTL <= 0) return
    if (redis && this.canUseRedis(source)) {
      try {
        const compressed = await gzip(JSON.stringify(entry))
        await redis.set(key, compressed.toString('base64'), {
          ex: remainingTTL
        })
      } catch (error) {
        this.redisFailed('Redis write', key, error)
      }
    }
  }

  private async writeFile<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    const filePath = this.filePath(key)
    const temporaryPath = `${filePath}.${randomUUID()}.tmp`
    try {
      await fs.mkdir(this.directory, { recursive: true })
      await fs.writeFile(temporaryPath, JSON.stringify(entry), 'utf8')
      await fs.rename(temporaryPath, filePath)
    } catch (error) {
      logCacheError('filesystem write', key, error)
    } finally {
      await fs.unlink(temporaryPath).catch((error: unknown) => {
        if (
          !(
            error instanceof Error &&
            'code' in error &&
            error.code === 'ENOENT'
          )
        ) {
          logCacheError('temporary file cleanup', key, error)
        }
      })
    }
  }

  private filePath(key: string): string {
    return path.join(
      this.directory,
      `${createHash('sha256').update(key).digest('hex')}.json`
    )
  }

  async getPage(pageId: string, source?: string) {
    return this.read(
      `page:${normalizePageId(pageId)}`,
      this.pages,
      redisPageTTL,
      source
    )
  }

  async setPage(pageId: string, data: ExtendedRecordMap, source?: string) {
    return this.write(
      `page:${normalizePageId(pageId)}`,
      data,
      this.pages,
      redisPageTTL,
      source
    )
  }

  async getNavLinkPage(pageId: string, source?: string) {
    return this.read(
      `nav:${normalizePageId(pageId)}`,
      this.navigation,
      redisNavTTL,
      source
    )
  }

  async setNavLinkPage(
    pageId: string,
    data: ExtendedRecordMap,
    source?: string
  ) {
    return this.write(
      `nav:${normalizePageId(pageId)}`,
      data,
      this.navigation,
      redisNavTTL,
      source
    )
  }

  getSitemap(cacheKey: string, source?: string) {
    const key = `sitemap:${cacheKey}`
    return this.read(key, this.sitemaps, redisSitemapTTL, source)
  }

  setSitemap(cacheKey: string, data: Partial<SiteMap>, source?: string) {
    const key = `sitemap:${cacheKey}`
    return this.write(key, data, this.sitemaps, redisSitemapTTL, source)
  }

  async clearMemory() {
    this.pages.clear()
    this.navigation.clear()
    this.sitemaps.clear()
  }
}

export const notionCache = new NotionCache()
