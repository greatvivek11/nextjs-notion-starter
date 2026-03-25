import { promises as fs } from 'fs'
import path from 'path'
import { ExtendedRecordMap } from 'notion-types'
import { notionCacheDir, notionCacheTTL } from './config'
import * as types from './types'

const FS_CACHE_DIR = path.join(process.cwd(), notionCacheDir)
const SITEMAP_CACHE_FILE = path.join(FS_CACHE_DIR, 'sitemap-cache.json')

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

  async getPage(pageId: string): Promise<ExtendedRecordMap | null> {
    const now = Date.now()

    // 1. Memory Check
    const cached = this.memoryCache.get(pageId)
    if (cached && now - cached.timestamp < notionCacheTTL) {
      return cached.data
    }

    // 2. Disk Check
    const fsCached = await this.getFsCachedPage(pageId)
    if (fsCached) {
      this.memoryCache.set(pageId, { data: fsCached, timestamp: now })
      return fsCached
    }

    return null
  }

  async setPage(pageId: string, data: ExtendedRecordMap) {
    this.memoryCache.set(pageId, { data, timestamp: Date.now() })
    await this.setFsCachedPage(pageId, data)
  }

  async getNavLinkPage(pageId: string): Promise<ExtendedRecordMap | null> {
    // 1. Memory Check
    const cached = this.navLinkCache.get(pageId)
    if (cached) return cached

    // 2. Disk Check
    const fsCached = await this.getFsCachedPage(pageId, true)
    if (fsCached) {
      this.navLinkCache.set(pageId, fsCached)
      return fsCached
    }

    return null
  }

  async setNavLinkPage(pageId: string, data: ExtendedRecordMap) {
    this.navLinkCache.set(pageId, data)
    await this.setFsCachedPage(pageId, data, true)
  }

  private async getFsCachedPage(
    pageId: string,
    isNav = false
  ): Promise<ExtendedRecordMap | null> {
    try {
      const fileName = isNav ? `nav-${pageId}.json` : `${pageId}.json`
      const cachePath = path.join(FS_CACHE_DIR, fileName)
      const stats = await fs.stat(cachePath)

      // Cache for 1 hour on disk (standard TTL)
      if (Date.now() - stats.mtimeMs > 60 * 60 * 1000) {
        return null
      }

      const data = await fs.readFile(cachePath, 'utf8')
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

  async getSitemap(cacheKey: string): Promise<Partial<types.SiteMap> | null> {
    const now = Date.now()

    // 1. Memory Check
    const cached = this.sitemapCache.get(cacheKey)
    if (cached && now - cached.timestamp < 60 * 60 * 1000) {
      return cached.data
    }

    // 2. Disk Check
    try {
      const stats = await fs.stat(SITEMAP_CACHE_FILE)
      // Cache sitemap for 1 hour on disk
      if (now - stats.mtimeMs < 60 * 60 * 1000) {
        const data = await fs.readFile(SITEMAP_CACHE_FILE, 'utf8')
        const result = JSON.parse(data)
        this.sitemapCache.set(cacheKey, { data: result, timestamp: stats.mtimeMs })
        return result
      }
    } catch (err) {
      // Ignore
    }

    return null
  }

  async setSitemap(cacheKey: string, data: Partial<types.SiteMap>) {
    this.sitemapCache.set(cacheKey, { data, timestamp: Date.now() })
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
}

export const notionCache = new NotionCache()
