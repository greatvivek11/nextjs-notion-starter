# AGENTS.md

Notes for OpenCode sessions working in this repo. Keep additions tight; if a fact is obvious from filenames or `package.json`, do not repeat it.

## What this repo is

Next.js 16 App Router site that renders a public Notion workspace as a blog/wiki using `react-notion-x`. Forked from `transitive-bullshit/nextjs-notion-starter-kit`; some server-side concerns (Redis caching, build warmup, audio TTS) were added on top.

- App Router pages in `src/app/` (root, `[pageId]`, `tags/[tagName]`, `api/article-audio`).
- Pages Router still in use for these API routes only: `src/pages/api/{search-notion,notion-pdf,notion-page-info,social-image,cron}.ts`. The split is intentional; do not migrate them without checking the rationale in `docs/System_Architecture.md`.
- Site-wide config is the env-backed adapter `site.config.ts` (root) -> `src/lib/config.ts` (consumed). Most knobs are env vars, not in-repo constants.

## Commands

```bash
npm install
npm run dev       # next dev
npm run build     # next build (does Notion warmup + ISR pre-gen)
npm run start     # next start
npm run lint      # biome lint .
npm run format    # biome format --write .
npm run check     # biome check --apply . (this IS the "test" script)
npm run test      # alias for `npm run check` — no unit/integration tests exist
```

There is no separate typecheck script. Run `npx tsc --noEmit` if you need it; `tsconfig.json` has `noEmit: true` and `"strict": false` (intentionally lax — Notion typings are loose).

`npm run audio:setup-mlx` (Apple Silicon) and `npm run audio:setup-kokoro` / `audio:setup-kokoro-coreml` (Intel/older Macs) install Python venvs under `~/.notion-audio-kokoro`, NOT inside the repo. The repo is gitignored for `.kokoro/`. Don't `pip install` into the project venv.

`npm run audio:generate -- <pageId>` POSTs to `http://localhost:3000/api/article-audio`; dev server must be running.

## Required env

Minimum (`README.md` + `.env.example` agree):
- `ROOT_NOTION_PAGE_ID`, `NAME`, `DOMAIN`, `AUTHOR`

For audio TTS in production/preview:
- `AUDIO_STORAGE_PROVIDER=vercel-blob`, `BLOB_READ_WRITE_TOKEN`

For Upstash Redis (optional but recommended past ~50 pages):
- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (or legacy `KV_REST_API_URL`/`KV_REST_API_TOKEN`)

JSON-backed env vars (`PAGE_URL_OVERRIDES`, `PAGE_URL_ADDITIONS`, `NAVIGATION_LINKS`) must be valid JSON; invalid values silently fall back to `{}` / `[]` (see `site.config.ts:parseJsonEnv`).

## Architecture: Notion fetch path

`src/app/[pageId]/page.tsx` -> `resolveNotionPage` -> `getPage` (`src/lib/notion.ts`) -> `notionCache` (`src/lib/notion-cache.ts`).

Cache is a three-tier LRU: in-memory `Map` -> gzip-compressed filesystem in `.notion-cache/<pageId>.json` -> Upstash Redis. The `.notion-cache/` directory is gitignored and 300+ files there is normal. TTLs differ across tiers; see `src/lib/config.ts` constants (`notionCacheTTL`, `redisPageTTL`, `revalidateTTL`).

Notion API calls are wrapped in `withRetry` + `notionRateLimiter` (`src/lib/notion-retry.ts`, `notion-rate-limiter.ts`). Concurrency is hard-capped at 3 (`notionMaxConcurrency`). 429s are handled with `Retry-After` honoring + jitter. Do not bypass these for one-off scripts.

Build warmup is critical. `next.config.js` writes a `.build-phase` marker synchronously; `notion-cache.ts` reads it to bypass Redis (the warmup pass populates disk only). `generateStaticParams` in `[pageId]/page.tsx` fetches the full sitemap, then warms every page in chunks of 10 via `getPage(pageId, 'build-warmup')`. Result: workers render against warm disk cache, no live API calls during render. Don't remove the warmup step; it is what prevents 429s.

## ISR `revalidate` quirk

Next.js 16 requires `revalidate` to be a literal integer in the page file, not an import. The literal `3600` is set in three places: `src/app/page.tsx`, `src/app/[pageId]/page.tsx`, `src/app/tags/[tagName]/page.tsx`. `revalidateTTL` in `src/lib/config.ts` must match. If you change one, change all three. `vercel-optimization.md` calls this out.

## PDF rendering

Notion-hosted PDF S3 URLs expire. `CustomPdf` component routes all PDF blocks through `src/pages/api/notion-pdf.ts` (a Pages-Router handler that re-signs URLs). Don't try to render PDFs directly; the signed URL will be dead in <1h. `next.config.js` `images.remotePatterns` whitelists `s3.us-west-2.amazonaws.com`, `images.unsplash.com`, `pbs/abs.twimg.com`, `notion.so` — add new image hosts there too.

## Article audio (TTS)

Local-only. `canGenerateArticleAudioLocally()` (`src/lib/article-audio-local.ts:26`) gates on `NODE_ENV === 'development' && !process.env.VERCEL_ENV`. In production, the API returns 403; only cached audio is served from Vercel Blob.

The Python side (`tools/kokoro/*.py`) lives in the user's home dir (`~/.notion-audio-kokoro/`) because Turbopack/Next have build issues with venv symlinks inside the project root. Two venvs: `.venv` (WhisperX alignment) and `.venv-mlx` (MLX-Audio generation). `setup-kokoro.sh` handles both.

The `ArticleAudioPlayer` is a 711-line client component that polls `/api/article-audio` every 5s, plays audio with word-level highlight alignment, and is mounted only when `page.isBlogPost && !page.tagsPage` (i.e. a child of a Notion collection). Add new TTS backends by editing `tools/kokoro/generate_article_audio_*.py` and `article-audio-local.ts` together; the JS/Python boundary is `child_process.execFile`.

## Styling

- Tailwind v4 via `@tailwindcss/postcss` (NOT the classic PostCSS plugin); config is `postcss.config.mjs`.
- No Tailwind config file — Tailwind 4 picks up `@/styles/global.css` and component files automatically.
- `src/styles/notion.css` overrides react-notion-x defaults; `--notion-max-width: 65vw` and `overflow-x: clip` on `.notion-page-scroller` are load-bearing (see `docs/UI_Components.md` for the aside layout math). Don't switch to `overflow-x: hidden` — it breaks `position: sticky` on the TOC aside.
- Biome handles lint+format. No ESLint, no Prettier. Biome config in `biome.json` uses single quotes, no semicolons, no trailing commas, 80 cols, 2-space indent, LF. Match these when editing.

## Cron

`vercel.json` schedules a daily POST to `/api/cron` (the Pages Router handler at `src/pages/api/cron.ts`), which validates `Authorization: Bearer ${CRON_SECRET}` and forwards to `CRON_URL`. Useful for triggering a Vercel deploy hook / revalidation webhook on a schedule.

## Common pitfalls

- The Notion client (`@upstash/redis`) MUST be constructed with `cache: 'default'` (see `src/lib/notion-cache.ts:31`). The default is `no-store`, which makes Next.js throw `DYNAMIC_SERVER_USAGE` inside ISR and silently fall back to full Notion crawls that exceed Vercel's 10s serverless budget. `docs/vercel-caching-and-isr-architecture.md` is the post-mortem. If you ever rewrite the Redis client, preserve this.
- `notion.ts` and `notion-filters.ts` were refactored in March 2026 (see `docs/fix/notion-sync-performance-and-architecture-2026-03-28.md`). The key invariant: only fetch linked collection views that are *embedded* in the page's content tree (use `getEmbeddedViewIds`). Don't fetch all `collection_view` blocks unconditionally — it makes individual blog posts 10x slower.
- The Notion API does NOT return auth errors when you query a private page; it just returns empty results. Verify `ROOT_NOTION_PAGE_ID` is from a *publicly published* Notion page (`Share -> Publish`) before debugging deeper. `docs/Notion.md`.
- Search API responses are sometimes double-wrapped (`block[id].value.value`); `notion.ts:search()` unwraps them. Don't refactor that away.
- `app/sitemap.ts` was removed per `vercel-optimization.md` (workspace too large, sitemap crawl triggers 504s). If you re-add it, gate it behind a `NEXT_PUBLIC_GENERATE_SITEMAP` flag and cache aggressively.
- The `notionMaxConcurrency` cap is for *all* Notion API calls, including sitemap build. Don't raise it past 3 without testing — Notion 429s cascade and `withRetry` will burn ~20s per failure.
- `generateStaticParams` swallows errors and returns `[]` on failure. If builds silently produce zero static pages, that's why — check terminal logs for `failed to generate static params` and the underlying Notion errors above it.

## File-by-file pointers (only non-obvious ones)

- `site.config.ts` — env adapter. Most "configuration" is in `.env`, not here.
- `src/lib/config.ts` — derives `appConfig` from `site.config.ts` + `process.env`. Throws at import time if `rootNotionPageId` is missing.
- `src/lib/notion-cache.ts` — three-tier cache; see "Architecture" above.
- `src/lib/notion.ts` — orchestrator; do not add business logic here, put it in the dedicated `notion-*.ts` modules.
- `src/lib/get-site-map.ts` — workspace walk; entry point is `getSiteMap('build-warmup')` during build.
- `src/components/NotionPage.tsx` — root client component. Exposes `pageId`/`recordMap`/`block` on `window` in dev only.
- `src/components/NotionRenderer.tsx` — custom `react-notion-x` renderer; `components` map registers Code/Pdf/Collection/Equation/Modal/Tweet/Header.
- `src/pages/api/cron.ts` — Vercel cron target; gates on `CRON_SECRET`.
- `vercel.json` — only schedules the cron. No redirects, no headers.
- `docs/fix/*.md` — post-mortems of real bugs. Read before changing cache or Notion fetch code.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
