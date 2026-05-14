# Vercel Deployment Optimization

This document outlines the optimizations implemented to ensure the site remains within the Vercel and Upstash free tiers, especially for large workspaces (800+ articles).

## Key Optimizations

### 1. Persistent Redis Caching
By default, the site uses a local filesystem cache. On Vercel, this cache is ephemeral and is cleared every time a serverless instance restarts. For large sites, this causes frequent "full crawls" of the Notion workspace, leading to high memory usage and long function execution times.

- **Solution**: Implemented Upstash Redis as a persistent cache.
- **Compression**: All data stored in Redis is Gzip-compressed. This reduces the memory footprint by ~90%, allowing 800+ articles to fit easily within the 256MB Upstash free tier.
- **Auto-Config**: The site automatically detects `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` or `KV_REST_API_URL` / `KV_REST_API_TOKEN` environment variables.

### 2. Revalidation Interval (ISR)
Pages use a 1-hour ISR revalidation interval (`export const revalidate = 3600`). The Redis cache soft-expiration is kept in sync via `revalidateTTL` in `src/lib/config.ts`.

> **Note:** Next.js 16 requires `revalidate` to be a numeric literal in page files. To change the interval, update both the `revalidate` value in the 3 page files (`page.tsx`, `[pageId]/page.tsx`, `tags/[tagName]/page.tsx`) and `revalidateTTL` in `config.ts`, then redeploy.

### 3. Sitemap Removal
For sites with 800+ articles, generating a sitemap on every request is extremely expensive. It requires traversing the entire Notion workspace structure.

- **Action**: Removed the auto-generated `sitemap.xml`.
- **Reasoning**: If you are primarily driving traffic via social media (LinkedIn) or direct links (Resume), a sitemap is not strictly necessary for SEO ranking. Removing it prevents search engine crawlers from triggering massive workspace crawls.

### 4. Vercel Blob Storage
For the article audio "Listen" feature, we use Vercel Blob to store and serve the audio assets. This ensures that expensive audio generation only happens once per content update.

## Configuration

To enable these optimizations on Vercel:

1. **Connect Upstash Redis**: Use the Vercel Upstash Integration to add the database to your project. The app accepts either `UPSTASH_REDIS_REST_*` or `KV_REST_API_*` variable names.
2. **Revalidation**: The default is 1 hour. To change it, update the hardcoded values in the page files and `config.ts` (see note above).

## Troubleshooting

- **Redis Error**: If Redis is not configured, the site will transparently fall back to the local filesystem cache.
- **Slow Updates**: If you add a new article and want to see it immediately, you can trigger a manual revalidation by visiting the page after the revalidation window expires (1 hour by default).
