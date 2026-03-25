# Notion API Performance & 429 Error Analysis

This document summarizes the investigation and findings regarding persistent Notion API 429 (Too Many Requests) errors and the "missing gallery" regression encountered during optimization.

## 1. Problem Identification

### Primary Issue: 429 Rate Limiting
The application was frequently hitting Notion's API rate limits, especially during `npm run dev` and `npm run build`.
- **Root Cause A: SiteMap "Leakage"**: Every call to `resolveNotionPage` that required slug resolution (e.g., `/blog`, `/about`, or any URL not using a raw ID) triggered a call to `getSiteMap()`. `getSiteMap()` performs a full scan of the Notion workspace, making dozens of API calls in parallel.
- **Root Cause B: Cross-Process Cache Missing**: Next.js `dev` mode uses multiple worker processes. In-memory caches are not shared between these processes or across server restarts, leading to redundant "Cache MISS" fetches for the same data.
- **Root Cause C: Parallel Audio Generation**: The new audio generation route was making parallel `getPage` calls without global concurrency control, pushing traffic over the "3 requests per second" limit.

### Secondary Issue: Missing Gallery/Collection
During initial performance optimizations, the gallery on the main page disappeared.
- **Cause**: Using restrictive `getPage` options (like `chunkLimit: 1` or omitting `fetchCollections: true`) in an attempt to save bandwidth clipped the `collection_view` and `collection_query` data required by `react-notion-x` to render galleries.

---

## 2. Investigated Approaches & Fixes

### A. Filesystem-Backed Caching (Recommended)
**Approach**: Implement a persistent disk-based cache in `.notion-cache/`.
- **Benfit**: Shares fetched data across worker processes and persists through server restarts.
- **Result**: Drastically reduced API traffic after the initial "warm-up" phase.

### B. Global Concurrency Control
**Approach**: Wrapped all Notion API calls in a concurrency limiter (`MAX_CONCURRENCY = 3`).
- **Benefit**: Ensures the application never exceeds Notion's recommended average throughput, even when multiple routes (Audio, oEmbed, Page) are active.

### C. Source-Aware Logging
**Approach**: Added a `source` parameter to all `getPage` calls (e.g., `source: 'AudioAPI'`, `source: 'SiteMap'`).
- **Benefit**: Allowed us to identify that `SiteMap` was the source of 90% of redundant traffic.

### D. SiteMap Optimization
**Approach**: Implemented filesystem caching for the sitemap itself (`sitemap-cache.json`).
- **Benefit**: The heavy full-workspace scan only runs once per hour instead of on every request.

### E. Audio Route Optimization
**Approach**: Refactored the `/api/article-audio` route to use a direct `getPage` call instead of the heavy `resolveNotionPage`.
- **Benefit**: Bypassed unnecessary sitemap scans and navigation link fetches.

---

## 3. Current Status & Recommendation

The user has opted to revert the filesystem caching and concurrency logic to restore the "standard" project structure. However, the 429 errors persist because the root architectural issues remain:
1. **Parallelism**: Multiple concurrent requests still exceed Notion's limit.
2. **Redundancy**: `getSiteMap` is still excessively heavy.

### Recommendations for Final Resolution:
1. **Re-enable SiteMap Disk Caching**: Even if full-page caching is skipped, caching the sitemap structure is critical for performance.
2. **Implement Global Retry Delay**: Ensure `withRetry` uses at least 3-5 seconds for 429 errors to let the Notion bucket refill.
3. **Explicit Data Fetching**: Always ensure `fetchCollections: true` is used for pages containing galleries.
