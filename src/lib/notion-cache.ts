import fsSync, { promises as fs } from 'fs'
import path from 'path'
import zlib from 'zlib'
import { promisify } from 'util'
import { Redis } from '@upstash/redis'
import { ExtendedRecordMap } from 'notion-types'
import {
  notionCacheDir,
  notionCacheTTL,
  redisNavTTL,
  redisPageTTL,
  redisSitemapTTL,
  revalidateTTL
} from './config'
import * as types from './types'

const gzip = promisify(zlib.gzip)
const gunzip = promisify(zlib.gunzip)

const FS_CACHE_DIR = path.join(process.cwd(), notionCacheDir)
const SITEMAP_CACHE_FILE = path.join(FS_CACHE_DIR, 'sitemap-cache.json')

// Upstash Redis configuration (Vercel connector provides these)
const redis =
  (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) &&
  (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN)
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN!
      })
    : null

interface CachedPage {
  data: ExtendedRecordMap
  timestamp: number
}

interface CachedSitemap {
  data: Partial<types.SiteMap>
  timestamp: number
}

class NotionCache {
  private memoryCache = new Map<string, CachedPage>()
  private navLinkCache = new Map<string, ExtendedRecordMap>()
  private sitemapCache = new Map<string, CachedSitemap>()

  private shouldBypassRedis(source?: string): boolean {
    const isBuildPhase =
      process.env.NEXT_PHASE === 'phase-production-build' ||
      fsSync.existsSync(path.join(FS_CACHE_DIR, '.build-phase'))

    return isBuildPhase && source !== 'build-warmup'
  }

  async getPage(pageId: string, source?: string): Promise<ExtendedRecordMap | null> {
    const now = Date.now()
    const effectiveTTL = source === 'build-warmup' ? redisPageTTL : revalidateTTL

    // 1. Memory Check
    const cached = this.memoryCache.get(pageId)
    if (cached && now - cached.timestamp < notionCacheTTL) {
      return cached.data
    }

    // 2. Disk Check (Fallback for build-time or local dev)
    const fsCached = await this.getFsCachedPage(pageId, false, effectiveTTL, source === 'build-warmup')
    if (fsCached) {
      this.memoryCache.set(pageId, { data: fsCached, timestamp: now })
      return fsCached
    }

    // 3. Redis Check (Shared persistent cache)
    if (redis && !this.shouldBypassRedis(source)) {
      try {
        const compressed = await redis.get<string>(`page:${pageId}`)
        if (compressed) {
          const decompressed = await gunzip(Buffer.from(compressed, 'base64'))
          const cachedData: CachedPage = JSON.parse(decompressed.toString())

          // Check if Redis cache is older than effective TTL (Soft Expiration)
          if (now - cachedData.timestamp < effectiveTTL * 1000) {
            console.log(`[Notion Redis HIT] Page: ${pageId}`)
            this.memoryCache.set(pageId, cachedData)
            return cachedData.data
          } else {
            console.log(`[Notion Redis STALE] Page: ${pageId} - Triggering refresh`)
          }
        }
      } catch (err) {
        console.error(`[Notion Redis Error] GET page:${pageId}`, err)
      }
    }

    return null
  }

  async setPage(pageId: string, data: ExtendedRecordMap, source = 'unknown') {
    const timestamp = Date.now()
    this.memoryCache.set(pageId, { data, timestamp })

    // Save to Redis (compressed to save space)
    if (redis && !this.shouldBypassRedis(source)) {
      try {
        const cacheObj: CachedPage = { data, timestamp }
        const compressed = await gzip(JSON.stringify(cacheObj))
        await redis.set(`page:${pageId}`, compressed.toString('base64'), {
          ex: redisPageTTL
        })
        console.log(`[Notion Redis SET] Page: ${pageId}`)
      } catch (err) {
        console.error(`[Notion Redis Error] SET page:${pageId}`, err)
      }
    }

    await this.setFsCachedPage(pageId, data)
  }

  async getNavLinkPage(pageId: string, source = 'unknown'): Promise<ExtendedRecordMap | null> {
    const now = Date.now()
    const effectiveTTL = source === 'build-warmup' ? redisNavTTL : revalidateTTL

    // 1. Memory Check
    const cached = this.navLinkCache.get(pageId)
    if (cached) return cached

    // 2. Disk Check
    const fsCached = await this.getFsCachedPage(pageId, true, effectiveTTL, source === 'build-warmup')
    if (fsCached) {
      this.navLinkCache.set(pageId, fsCached)
      return fsCached
    }

    // 3. Redis Check
    if (redis && !this.shouldBypassRedis(source)) {
      try {
        const compressed = await redis.get<string>(`nav:${pageId}`)
        if (compressed) {
          const decompressed = await gunzip(Buffer.from(compressed, 'base64'))
          const cachedData: CachedPage = JSON.parse(decompressed.toString())

          if (now - cachedData.timestamp < effectiveTTL * 1000) {
            this.navLinkCache.set(pageId, cachedData.data)
            return cachedData.data
          }
        }
      } catch (err) {
        // Ignore
      }
    }

    return null
  }

  async setNavLinkPage(pageId: string, data: ExtendedRecordMap, source = 'unknown') {
    const timestamp = Date.now()
    this.navLinkCache.set(pageId, data)

    if (redis && !this.shouldBypassRedis(source)) {
      try {
        const cacheObj: CachedPage = { data, timestamp }
        const compressed = await gzip(JSON.stringify(cacheObj))
        await redis.set(`nav:${pageId}`, compressed.toString('base64'), {
          ex: redisNavTTL
        })
      } catch (err) {
        // Ignore
      }
    }

    await this.setFsCachedPage(pageId, data, true)
  }

  private async getFsCachedPage(
    pageId: string,
    isNav = false,
    effectiveTTL = revalidateTTL,
    touchFile = false
  ): Promise<ExtendedRecordMap | null> {
    try {
      const fileName = isNav ? `nav-${pageId}.json` : `${pageId}.json`
      const cachePath = path.join(FS_CACHE_DIR, fileName)
      const stats = await fs.stat(cachePath)

      if (Date.now() - stats.mtimeMs > effectiveTTL * 1000) {
        return null
      }

      const data = await fs.readFile(cachePath, 'utf8')

      // During warmup, touch the file to update mtime so rendering workers
      // (which use a shorter TTL) will find it fresh.
      if (touchFile) {
        const now = new Date()
        await fs.utimes(cachePath, now, now).catch(() => {
          // Ignore utimes failure
        })
      }

      return JSON.parse(data)
    } catch (err) {
      return null
    }
  }

  private async setFsCachedPage(
    pageId: string,
    data: ExtendedRecordMap,
    isNav = false
  ) {
    try {
      await fs.mkdir(FS_CACHE_DIR, { recursive: true })
      const fileName = isNav ? `nav-${pageId}.json` : `${pageId}.json`
      const cachePath = path.join(FS_CACHE_DIR, fileName)
      await fs.writeFile(cachePath, JSON.stringify(data), 'utf8')
    } catch (err) {
      // Ignore cache write failures
    }
  }

  async getSitemap(cacheKey: string, source?: string): Promise<Partial<types.SiteMap> | null> {
    const now = Date.now()
    const effectiveTTL = source === 'build-warmup' ? redisSitemapTTL : revalidateTTL

    // 1. Memory Check
    const cached = this.sitemapCache.get(cacheKey)
    if (cached && now - cached.timestamp < effectiveTTL * 1000) {
      return cached.data
    }

    // 2. Disk Check
    try {
      const stats = await fs.stat(SITEMAP_CACHE_FILE)
      if (now - stats.mtimeMs < effectiveTTL * 1000) {
        const data = await fs.readFile(SITEMAP_CACHE_FILE, 'utf8')
        
        // During warmup, touch the sitemap file to update mtime so rendering workers
        // (which use a shorter TTL) will find it fresh.
        if (source === 'build-warmup') {
          const touchTime = new Date()
          await fs.utimes(SITEMAP_CACHE_FILE, touchTime, touchTime).catch(() => {
            // Ignore utimes failure
          })
        }
        
        const result = JSON.parse(data)
        this.sitemapCache.set(cacheKey, { data: result, timestamp: stats.mtimeMs })
        return result
      }
    } catch (err) {
      // Ignore
    }

    // 3. Redis Check
    if (redis && !this.shouldBypassRedis(source)) {
      try {
        const compressed = await redis.get<string>(`sitemap:${cacheKey}`)
        if (compressed) {
          const decompressed = await gunzip(Buffer.from(compressed, 'base64'))
          const cachedData: CachedSitemap = JSON.parse(decompressed.toString())

          if (now - cachedData.timestamp < effectiveTTL * 1000) {
            this.sitemapCache.set(cacheKey, cachedData)
            return cachedData.data
          }
        }
      } catch (err) {
        // Ignore
      }
    }

    return null
  }

  async setSitemap(cacheKey: string, data: Partial<types.SiteMap>, source = 'unknown') {
    const timestamp = Date.now()
    this.sitemapCache.set(cacheKey, { data, timestamp })

    if (redis && !this.shouldBypassRedis(source)) {
      try {
        const cacheObj: CachedSitemap = { data, timestamp }
        const compressed = await gzip(JSON.stringify(cacheObj))
        await redis.set(`sitemap:${cacheKey}`, compressed.toString('base64'), {
          ex: redisSitemapTTL
        })
        console.log(`[Notion Redis SET] Sitemap: ${cacheKey}`)
      } catch (err) {
        // Ignore
      }
    }

    try {
      await fs.mkdir(FS_CACHE_DIR, { recursive: true })
      await fs.writeFile(SITEMAP_CACHE_FILE, JSON.stringify(data), 'utf8')
    } catch (err) {
      // Ignore
    }
  }

  async clearMemory() {
    this.memoryCache.clear()
    this.navLinkCache.clear()
    this.sitemapCache.clear()
  }

  async setBuildPhaseMarker() {
    try {
      await fs.mkdir(FS_CACHE_DIR, { recursive: true })
      await fs.writeFile(path.join(FS_CACHE_DIR, '.build-phase'), 'true', 'utf8')
      console.log(`[Notion Cache] Set build phase marker file.`)
    } catch (err) {
      // Ignore
    }
  }
}

export const notionCache = new NotionCache()
