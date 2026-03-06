# Fixing PDF Rendering in react-notion-x (Next.js SSG)

> **Date:** February 2026  
> **Affected files:** `src/components/NotionPage.tsx`, `src/pages/api/notion-pdf.ts`, `src/lib/notion.ts`

---

## The Problem

PDF blocks embedded in Notion pages failed to render in this Next.js application. The root cause was a chain of three interconnected issues:

1. **React Hydration Error (#418):** The `react-pdf` library (used by `react-notion-x`) depends on browser-only APIs. During SSG, Next.js renders on the server first, producing an empty tree for the PDF. When the client hydrates, it tries to mount `<Pdf />` immediately, causing a mismatch.

2. **Expired AWS S3 Signed URLs (403 Forbidden):** Notion stores files on AWS S3 with time-limited signed URLs (~1 hour). Since this app uses Static Site Generation (SSG), the signed URL is baked into HTML at build time and expires long before most users visit. Result: `403 Forbidden`.

3. **CORS Restrictions:** Even with fresh signed URLs, `react-pdf` fetches PDFs via XHR/`fetch()`, which triggers browser CORS policies. Notion's `file.notion.so` domain does **not** set `Access-Control-Allow-Origin` headers, so the browser blocks the request entirely.

---

## Approaches Tried (and Why They Failed)

### 1. Dynamic Import with `ssr: false`
**Idea:** Dynamically import the `Pdf` component with `ssr: false` to skip server rendering.  
**Result:** Fixed the hydration error, but the S3 URL was still expired → 403.

### 2. Proxying through `notion.so/image/`
**Idea:** Route the S3 URL through Notion's public image proxy (`https://www.notion.so/image/<encoded_url>?table=block&id=<blockId>&cache=v2`).  
**Result:** Notion's image proxy returns **400 Bad Request** for PDFs — it only supports image files.

### 3. Custom `/api/notion-pdf` calling `getSignedFileUrls` directly
**Idea:** Create a Next.js API route that calls `notion.getSignedFileUrls()` to dynamically sign URLs at request time.  
**Result:** The Notion API's `getSignedFileUrls` endpoint returns **404 "Record Not Found"** for public (unauthenticated) workspaces. It requires a `token_v2` cookie for auth.

### 4. Re-enabling `signFileUrls: true` in notion.ts
**Idea:** Let `notion-client` natively sign URLs during page loads by setting `signFileUrls: true` in the `getPage()` call.  
**Result:** The signed URLs were populated at build time, but they pointed to `file.notion.so` which blocks browser XHR via **CORS policy** and returns **419** when fetched server-to-server without Notion session cookies.

### 5. Server-side streaming proxy for `file.notion.so`
**Idea:** Proxy the `file.notion.so` URL through our API route, fetching it server-to-server (bypassing browser CORS) and streaming the binary back.  
**Result:** `file.notion.so` returns **400** with a redirect to `/login` for server-to-server requests — it requires Notion authentication cookies.

### 6. Google Docs Viewer iframe
**Idea:** Use `https://docs.google.com/viewer?url=<encoded_url>&embedded=true` to render PDFs in a Google-hosted iframe.  
**Result:** Google Docs Viewer couldn't access the `notion.so/image/` URL (which returns 400 for PDFs anyway), resulting in a **blank iframe**.

### 7. `notion.getBlocks()` to find parent, then sign
**Idea:** Call `notion.getBlocks([blockId])` to retrieve the block's `parent_id`, then call `getPage(parentId, signFileUrls: true)`.  
**Result:** `syncRecordValuesMain` (the endpoint behind `getBlocks`) also returns **404 "Record Not Found"** for unauthenticated access.

### 8. Passing the S3 URL path segment as blockId
**Idea:** Parse the UUID from the S3 URL path (`/spaceId/blockId/filename.pdf`) and use it to look up the signed URL.  
**Result:** The S3 URL path contains a **file reference UUID**, NOT the Notion block ID. These are completely different identifiers, so the lookup always failed.

---

## The Final Solution ✅

The working solution combines three key insights:

### Insight 1: `loadPageChunk` is the only Notion API that works without auth
The `notion.getPage()` method internally calls `loadPageChunk` which works for public Notion pages without authentication. All other endpoints (`getSignedFileUrls`, `syncRecordValuesMain`, `getBlocks`) require a `token_v2` cookie.

### Insight 2: `getPage()` with `signFileUrls: true` produces valid signed URLs
When called with `signFileUrls: true`, `getPage()` internally calls `loadPageChunk` first (establishing access context), then `addSignedUrls` → `getSignedFileUrls` in the correct sequence. This works even without auth because the preceding `loadPageChunk` call establishes the permission context.

### Insight 3: The `signed_urls` map key is the Notion block ID, not the S3 file reference
The `recordMap.signed_urls` dictionary is keyed by the **Notion PDF block ID** (e.g., `7f2a3275-...`), which is different from the file reference UUID in the S3 URL path (e.g., `a42b8a0f-...`).

### Implementation

#### `src/components/NotionPage.tsx` — CustomPdf Component
```tsx
const CustomPdf = ({ file }: any) => {
  const [mounted, setMounted] = React.useState(false)
  const { recordMap } = useNotionContext()

  React.useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null

  // Scan recordMap.block to find the root pageId and the PDF blockId
  let pageId = '', pdfBlockId = ''
  if (recordMap?.block) {
    for (const [id, blockEntry] of Object.entries(recordMap.block)) {
      const val = (blockEntry as any)?.value || blockEntry
      if (val?.type === 'page' && !pageId) pageId = id
      if (val?.type === 'pdf') {
        const source = val?.properties?.source?.[0]?.[0]
        if (source === file || source?.includes(file) || file?.includes(source))
          pdfBlockId = id
        else if (!pdfBlockId)
          pdfBlockId = id // fallback for single PDF pages
      }
    }
  }

  const iframeSrc = (pageId && pdfBlockId)
    ? `/api/notion-pdf?pageId=${pageId}&blockId=${pdfBlockId}`
    : file

  return <iframe src={iframeSrc} style={{ width: '100%', height: '80vh', border: 'none' }} />
}
```

#### `src/pages/api/notion-pdf.ts` — Server-side PDF proxy
```ts
export default async function handler(req, res) {
  const { pageId, blockId } = req.query
  const { notion } = await import('@/lib/notion-api')

  // Step 1: Fetch the page with signFileUrls: true
  const recordMap = await notion.getPage(pageId, {
    fetchMissingBlocks: true,
    fetchCollections: false,
    signFileUrls: true
  })

  // Step 2: Extract the signed URL for the PDF block
  const signedUrl = recordMap?.signed_urls?.[blockId]

  // Step 3: Fetch and stream the PDF binary (server-to-server bypasses CORS)
  const pdfResponse = await fetch(signedUrl)
  const buffer = Buffer.from(await pdfResponse.arrayBuffer())

  res.setHeader('Content-Type', 'application/pdf')
  res.status(200).send(buffer)
}
```

#### `src/lib/notion.ts` — Keep `signFileUrls: false`
```ts
// signFileUrls: false for SSG pages (images use mapImageUrl proxy)
// PDFs are handled by /api/notion-pdf which signs on demand
signFileUrls: false
```

### How the data flows

```
Browser loads SSG page
  → react-notion-x renders PDF block
  → CustomPdf receives raw S3 URL as `file` prop
  → CustomPdf scans recordMap.block to find pageId + pdfBlockId
  → Renders <iframe src="/api/notion-pdf?pageId=X&blockId=Y">
  → API route calls notion.getPage(pageId, { signFileUrls: true })
  → notion-client: loadPageChunk → addSignedUrls → getSignedFileUrls
  → Fresh file.notion.so signed URL returned
  → API fetches PDF binary server-to-server (no CORS)
  → Streams application/pdf back to iframe
  → Browser's native PDF viewer renders it
```

### Additional fix: Build retry logic
Notion's API sporadically returns 502/503 during builds. A `withRetry` wrapper in `notion.ts` provides exponential backoff (up to 5 retries) for `notion.getPage()` calls.
