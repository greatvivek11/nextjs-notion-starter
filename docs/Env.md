# Environment Configuration

The app reads configuration from standard Next.js environment variables. `site.config.ts` does not store independent project settings; it adapts `process.env` into the internal config shape used by `src/lib/config.ts`.

For local Kokoro generation on macOS, the setup flow expects Homebrew and a compatible Python 3.10-3.12 runtime. The provided setup script installs `python@3.12`, `espeak-ng`, and `ffmpeg` if they are missing.

## Required variables

- `ROOT_NOTION_PAGE_ID`: public Notion page ID that acts as the site's root
- `NAME`: site name
- `DOMAIN`: production domain without protocol
- `AUTHOR`: display author/owner name

## Common optional variables

- `DESCRIPTION`: default site description
- `TITLE`: root layout metadata title
- `ROOT_NOTION_SPACE_ID`: restrict pages to a single Notion workspace
- `BLOG_PAGE_ID`: blog collection page used by `/tags/[tagName]`
- `TWITTER`, `GITHUB`, `LINKEDIN`, `YOUTUBE`, `NEWSLETTER`
- `AUDIO_STORAGE_PROVIDER`: audio storage provider, currently `vercel-blob`
- `BLOB_READ_WRITE_TOKEN`: Vercel Blob read/write token for generated article audio
- `LOCAL_TTS_BACKEND`: Set to `mlx-audio` to use the high-performance MLX/Kokoro generator (requires Mac w/ Silicon).
- `KOKORO_VOICE`: The voice ID to use (default: `af_heart`).
- `KOKORO_WHISPERX_DEVICE`: Hardware acceleration for alignment (`mps` or `cpu`).
- `KOKORO_SPEED`: Playback speed for synthesis (e.g., `1.0`).

## JSON-backed variables

These must contain valid JSON:

- `PAGE_URL_OVERRIDES`: object mapping URL path to Notion page ID
- `PAGE_URL_ADDITIONS`: object mapping extra URL path to public Notion page ID
- `NAVIGATION_LINKS`: array of `{ "title": string, "pageId"?: string, "url"?: string }`

Invalid JSON falls back to empty values for optional fields, but valid JSON is strongly recommended so config mistakes are visible early.

## Example

```json
{
  "ROOT_NOTION_PAGE_ID": "0123456789abcdef0123456789abcdef",
  "NAME": "My Site",
  "DOMAIN": "example.com",
  "AUTHOR": "Your Name",
  "DESCRIPTION": "Notes and writing from Notion",
  "NAVIGATION_STYLE": "custom",
  "NAVIGATION_LINKS": [
    { "title": "Home", "pageId": "0123456789abcdef0123456789abcdef" },
    { "title": "GitHub", "url": "https://github.com/your-name" }
  ],
  "PAGE_URL_OVERRIDES": {
    "/about": "fedcba9876543210fedcba9876543210"
  }
}
```
