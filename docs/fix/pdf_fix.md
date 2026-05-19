# Walkthrough: Fixing the Resume PDF CORS / Loading Issue & Modular Refactoring

## 1. CORS / Loading Issue

### Diagnosis

The PDF on the resume page was failing to load with a CORS error because the browser was trying to fetch the file URL directly via the `attachment:...` protocol.

Here is the flow that led to this error:
1. The custom `CustomPdf` component in [NotionRenderer.tsx](file:///Users/vivekkaushik/Projects/nextjs-notion-starter/src/components/NotionRenderer.tsx) attempts to resolve `pageId` and `pdfBlockId` from `recordMap.block`.
2. If both IDs are successfully resolved, the component proxies the request through `/api/notion-pdf?pageId=${pageId}&blockId=${pdfBlockId}` to sign the URL and fetch the binary server-side.
3. If they are not resolved, it falls back to using the raw `file` URL (which is of the form `attachment:...` when uploaded directly to Notion).
4. Because the block entries in `recordMap.block` are double-wrapped by Notion/react-notion-x as `{ spaceId: "...", value: { value: Block, role: "reader" } }`, traversing `blockEntry.value` directly did not yield a valid block object. Instead, the actual `Block` containing the type and source attributes was nested inside `blockEntry.value.value`.
5. As a result, the loop inside `CustomPdf` could not find any blocks matching `type === 'page'` or `type === 'pdf'`, causing both `pageId` and `pdfBlockId` to remain empty. The component fell back to requesting `attachment:...` directly in the browser, failing due to CORS.

### Resolution

We updated `CustomPdf`'s block traversal loop to correctly unwrap the block entries:

```typescript
const val = (blockEntry as any)?.value?.value ?? (blockEntry as any)?.value ?? blockEntry
```

This normalized the block structure, allowing `CustomPdf` to successfully resolve both `pageId` and `pdfBlockId`. The PDF now fetches correctly via the `/api/notion-pdf` server-to-server proxy.

---

## 2. Zoom Controls and Centering Improvements

### Diagnosis
Previously, the PDF was rendered directly at default sizing without centering, causing a large asymmetric white space on the right side on desktop screens. Additionally, a default grey container wrapper from react-notion-x surrounded the PDF content.

### Resolution
1. **Centering Layout**: Wrapped the `<Document>` in a new `pdfDocumentWrapper` element and centered the pages horizontally using flexbox styling:
   ```css
   .pdfDocumentWrapper {
     display: flex;
     flex-direction: column;
     align-items: center;
     padding: 20px;
     overflow-x: auto;
     background: #f5f5f7;
   }
   ```
2. **Interactive Zoom Controls**: Implemented a responsive toolbar featuring zoom-out, current zoom scale, zoom-in, and reset-zoom controls:
   - Added a `scale` state variable initialized to `1.0`.
   - Used `lucide-react` icons (`ZoomIn`, `ZoomOut`, and `RotateCcw`) for clean, modern controls.
   - Connected these buttons to helper handlers that increment or decrement the scale state (constrained between `0.5` and `2.0` zoom levels).
   - Applied modern styling with a sleek background, smooth transitions, and distinct active/hover states that adapt cleanly to light and dark theme modes.
3. **Removing the Grey Background Container**: Overrode the react-notion-x default styles for the wrapper elements in [notion.css](file:///Users/vivekkaushik/Projects/nextjs-notion-starter/src/styles/notion.css):
   ```css
   .notion-pdf,
   .notion-asset-wrapper-pdf,
   .notion-asset-wrapper-pdf > div {
     background: transparent !important;
     border: none !important;
     padding: 0 !important;
   }
   ```
   This successfully removes the default background and padding settings (including inline styles applied by react-notion-x), integrating the new PDF viewer cleanly into the page.

---

## 3. Modular Refactoring (SOLID Principles)

To satisfy the **Single Responsibility Principle (SRP)**, we refactored the monolithic `NotionRenderer.tsx` (~470 lines) by extracting custom overrides into dedicated, single-responsibility files:

1. **`src/components/CustomLink.tsx`**: Intercepts inline Notion links and rewrites them to internal routes.
2. **`src/components/CustomPdf.tsx`**: Lazy-loads `react-pdf`, handles block unwrapping, URL proxying, and renders the toolbar controls/centering layout.
3. **`src/components/NotionPageHeader.tsx`**: Renders headers and sets up native search keyboard shortcut bindings (`Cmd/Ctrl+K`).
4. **`src/components/NotionProperties.tsx`**: Houses page metadata properties and selectors overrides.
5. **`src/components/NotionRenderer.tsx`**: Streamlined down to **~170 lines**, acting solely as the main configuration entry mapping these custom sub-components.
