# Environment Configuration

The app reads configuration from standard Next.js environment variables. `site.config.ts` does not store independent project settings; it adapts `process.env` into the internal config shape used by `src/lib/config.ts`.

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
