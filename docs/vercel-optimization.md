# Vercel Deployment Optimization

This document outlines the optimizations implemented to ensure the site remains within the Vercel and Upstash free tiers, especially for large workspaces (800+ articles).

## Key Optimizations

### 1. Persistent Redis Caching
By default, the site uses a local filesystem cache. On Vercel, this cache is ephemeral and is cleared every time a serverless instance restarts. For large sites, this causes frequent "full crawls" of the Notion workspace, leading to high memory usage and long function execution times.

- **Solution**: Implemented Upstash Redis as a persistent cache.
- **Compression**: All data stored in Redis is Gzip-compressed. This reduces the memory footprint by ~90%, allowing 800+ articles to fit easily within the 256MB Upstash free tier.
- **Auto-Config**: The site automatically detects `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` environment variables.

### 2. Configurable Revalidation (ISR)
The `revalidate` interval for pages is now configurable via environment variables.

- **Variable**: `REVALIDATE_TTL`
- **Default**: `3600` (1 hour)
- **Benefit**: Reduces the frequency of background revalidations triggered by bots and crawlers, keeping "Fluid Provisioned Memory" usage low.

### 3. Sitemap Removal
For sites with 800+ articles, generating a sitemap on every request is extremely expensive. It requires traversing the entire Notion workspace structure.

- **Action**: Removed the auto-generated `sitemap.xml`.
- **Reasoning**: If you are primarily driving traffic via social media (LinkedIn) or direct links (Resume), a sitemap is not strictly necessary for SEO ranking. Removing it prevents search engine crawlers from triggering massive workspace crawls.

### 4. Vercel Blob Storage
For the article audio "Listen" feature, we use Vercel Blob to store and serve the audio assets. This ensures that expensive audio generation only happens once per content update.

## Configuration

To enable these optimizations on Vercel:

1. **Connect Upstash Redis**: Use the Vercel Upstash Integration to add the database to your project.
2. **Set TTL**: (Optional) Add `REVALIDATE_TTL` as an environment variable (e.g., `86400` for 24 hours).

## Troubleshooting

- **Redis Error**: If Redis is not configured, the site will transparently fall back to the local filesystem cache.
- **Slow Updates**: If you add a new article and want to see it immediately, you can either trigger a manual revalidation or temporarily lower `REVALIDATE_TTL`.
