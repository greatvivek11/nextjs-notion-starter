# Next.js Notion Starter

A Next.js App Router starter for publishing public Notion content as a website with [`react-notion-x`](https://github.com/NotionX/react-notion-x).

This project is a fork of Travis Fischer's [nextjs-notion-starter-kit](https://github.com/transitive-bullshit/nextjs-notion-starter-kit) with an App Router migration and a smaller set of project-specific customizations around rendering, navigation, and Notion file handling.

## What It Includes

- `LOCAL_TTS_BACKEND`: Set to `mlx-audio` to use the high-performance MLX/Kokoro generator (requires Mac w/ Silicon).
- `KOKORO_VOICE`: The voice ID to use (default: `af_heart`).
- `KOKORO_WHISPERX_DEVICE`: Hardware acceleration for alignment (`mps` or `cpu`).
- `KOKORO_SPEED`: Playback speed for synthesis (e.g., `1.0`).

> [!IMPORTANT]
> Local audio synthesis requires a setup step that creates a workspace in `~/.notion-audio-kokoro`.
- Next.js 16 + React 19 with the App Router
- Public Notion pages rendered through `react-notion-x`
- ISR-based page generation for the root page, child pages, and tag pages
- Custom Notion renderer integrations for code highlighting, equations, collections, tweets, and PDFs
- Search API proxy backed by the Notion search endpoint
- Generated `robots.txt`
- Optional Vercel Analytics and Speed Insights on the homepage
- A custom `/api/notion-pdf` proxy to re-sign expiring Notion-hosted PDF URLs

## What It Does Not Include

- RSS, Atom, JSON Feed, or ICS feed generation
- Redis-backed image preview caching in the current configuration
- A dedicated dependency sync script such as `npm run deps:update`
- `dotenvx`; local setup uses the standard Next.js `.env` flow

## Setup & Local Development

### Prerequisites
- Node.js 18+
- A Public Notion Page (to use as your root CMS page)

### Quick Start
1. **Clone and Install**:
   ```bash
   git clone https://github.com/greatvivek11/nextjs-notion-starter.git
   cd nextjs-notion-starter
   npm install
   ```

2. **Environment Variables**:
   Copy `.env.example` to `.env` and fill in your details:
   ```bash
   cp .env.example .env
   ```
   Required values:
   - `ROOT_NOTION_PAGE_ID`
   - `NAME`
   - `DOMAIN`
   - `AUTHOR`

   Common optional values:
   - `DESCRIPTION`
   - `ROOT_NOTION_SPACE_ID`
   - `BLOG_PAGE_ID`
   - `NAVIGATION_STYLE`
   - `NAVIGATION_LINKS`
   - `PAGE_URL_OVERRIDES`
   - `PAGE_URL_ADDITIONS`

3. **Run Locally**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to see your site.

### Article Audio

To enable local development article read-aloud generation:

- Create a public Vercel Blob store for generated audio assets
- Ensure `BLOB_READ_WRITE_TOKEN` is available in your project env
- Set `AUDIO_STORAGE_PROVIDER=vercel-blob`
- Make sure Homebrew is available on your Mac; the setup script installs `python@3.12`, `espeak-ng`, and `ffmpeg`

**Recommended (Apple Silicon):** MLX-Audio backend

```bash
npm run audio:setup-mlx
### Local Audio Generation (Optional)

The starter now supports high-performance local audio generation with word-level synchronization using **MLX-Audio** and **Kokoro**. 

> [!NOTE]
> All local audio models and caches are stored in `~/.notion-audio-kokoro` to keep your project root clean and avoid build errors with virtual environment symlinks.

1.  **Requirement**: Apple Silicon Mac (M1/M2/M3).
2.  **Setup**:
    ```bash
    npm run audio:setup-mlx
    ```
3.  **Run**:
    -   In Development: Click "Listen" in the floating audio player.
    -   CLI: `npm run audio:generate -- <pageId>`
.

Generated audio is cached per article content hash in Blob. In production and preview, the player only appears for articles that already have cached audio.

## Configuration

Most runtime configuration comes from environment variables. [`site.config.ts`](./site.config.ts) is a thin adapter that reads those env vars and passes them into the app's config helpers.

The main configuration groups are:
- Site identity: `NAME`, `DOMAIN`, `AUTHOR`, `DESCRIPTION`
- Notion root pages: `ROOT_NOTION_PAGE_ID`, `ROOT_NOTION_SPACE_ID`, `BLOG_PAGE_ID`
- Navigation: `NAVIGATION_STYLE`, `NAVIGATION_LINKS`
- Custom routes: `PAGE_URL_OVERRIDES`, `PAGE_URL_ADDITIONS`
- Rendering toggles: `PREVIEW_IMAGE`, `INCLUDE_NOTION_ID_IN_URLS`, `SHOW_COLLECTION_VIEW_DROPDOWN`

JSON-backed env vars should contain valid JSON:

```json
{
  "PAGE_URL_OVERRIDES": {
    "/about": "0123456789abcdef0123456789abcdef"
  },
  "NAVIGATION_LINKS": [
    { "title": "Home", "pageId": "0123456789abcdef0123456789abcdef" },
    { "title": "GitHub", "url": "https://github.com/your-name" }
  ]
}
```

More details are in:
- [Notion setup](./docs/Notion.md)
- [System architecture](./docs/System_Architecture.md)
- [Project structure](./docs/Project_Structure.md)
- [Vercel optimization](./docs/vercel-optimization.md)
- [Blueprint / onboarding notes](./docs/Blueprint.md)

## Deployment

The easiest way to deploy is using [Vercel](https://vercel.com/):

1. Push your code to GitHub.
2. Connect your repo to Vercel.
3. Add your Environment Variables in the Vercel dashboard.

### Recommended Vercel Integrations

While the core application is platform-agnostic, we recommend the following Vercel integrations for the best experience:

- **[Vercel Blob](https://vercel.com/storage/blob)**: Used for storing and serving generated article audio. Enable this if you use the "Listen" feature.
- **[Upstash Redis](https://vercel.com/integrations/upstash)**: Used for persistent caching with Gzip compression. Highly recommended for sites with many articles to keep memory usage within free tier limits.

### Cron behavior

[`vercel.json`](./vercel.json) schedules `/api/cron` daily. That route checks `CRON_SECRET` and then POSTs to `CRON_URL`, which is intended for an external redeploy or revalidation webhook.

## Credits & Documentation

- **Base Repo**: [Travis Fischer](https://github.com/transitive-bullshit/nextjs-notion-starter-kit)
- **Detailed Docs**: Explore the [/docs](docs/) folder for system architecture and component details.

## License

MIT © [Vivek Kaushik](https://github.com/greatvivek11)
