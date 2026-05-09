# Homepage Styling Guide

This document covers the responsive styling system for the homepage hero section, covering all three breakpoints: **Desktop**, **Tablet (iPad Mini/Air/Pro)**, and **Mobile**.

All homepage-specific styles are scoped under `.index-page` in `src/styles/notion.css` to avoid affecting blog posts or other pages.

## Hero Section Structure

The homepage hero is rendered from Notion blocks with the following DOM hierarchy:

```
.index-page
└── .notion-page
    ├── .notion-page-cover-wrapper          ← Microsoft logo cover image
    ├── .notion-block-a869e19a...           ← Title: "Vivek Kaushik"
    │   └── .notion-title
    ├── .notion-row (fbd8305b...)           ← Subtitle: "Azure AI Developer at Microsoft"
    │   └── .notion-column → .notion-h1
    ├── .notion-row (9ef57da8...)           ← Heading: "✦ Introduction ✦"
    │   └── .notion-column → .notion-h2
    └── .notion-row (9a4ad916...ba93b6e...)  ← Hero Row: Profile Pic + Intro Text
        ├── .notion-column (43.75%)          ← Profile picture column
        │   └── figure.notion-asset-wrapper-image
        │       └── div → img
        ├── .notion-spacer
        └── .notion-column (56.25%)          ← Intro text column
            ├── .notion-text (pink bg)       ← "I'm a Fullstack + AI + Cloud..."
            ├── .notion-text (teal bg)       ← "Currently, I'm working as..."
            ├── .notion-text (orange bg)     ← Skills list
            ├── .notion-text (pink bg)       ← Industries list
            └── .notion-text (gray bg)       ← Consultancy description
```

## Notion Block ID Reference

> [!IMPORTANT]
> These IDs are stable as long as the Notion page structure doesn't change. If blocks are deleted and recreated, the IDs will change.

| Block | ID | Purpose |
|---|---|---|
| Title | `a869e19a3e74488ca16349aee7581cb2` | "Vivek Kaushik" heading |
| Subtitle Row | `fbd8305bf95341418ff30f0f32a36622` | "Azure AI Developer at Microsoft" |
| Intro Heading Row | `9ef57da840544a3ea5677e7636177fd1` | "✦ Introduction ✦" |
| Hero Row | `9a4ad916180b41f5ba93b6e82da6a546` | Profile pic + intro text columns |
| Badges Row | `a2f58273435540c7be9b38a3cca7a811` | Azure certification badges |
| Profile Pic | `34a1309610f08080837effef3a0db200` | Image block inside hero row |

> [!CAUTION]
> The Hero Row ID contains `ba93b6e` (NOT `ba937b6e`). A previous typo caused all hero row CSS to silently fail. Always verify IDs against the live DOM using `curl -s http://localhost:3000 | grep -o 'notion-block-[a-f0-9]*' | sort -u`.

## Responsive Breakpoints

### Global Overrides (All Viewports)

**File:** `src/styles/notion.css`, lines 15–69

**Strategy:** Ensure perfect centering and consistent typography hierarchy regardless of screen size.
- **Aside (Social Icons):** Globally hidden (`display: none`) on the homepage to prevent rightward layout shifting on iPad Pro / Surface Pro devices.
- **Centering:** When the aside is hidden, the main content `.notion-page-content-has-aside` is forced to `width: 100%` and `justify-content: center`.
- **Typography Hierarchy:**
  - **Title:** `font-weight: 800`, `font-size: clamp(2.2rem, 6vw, 4rem)`
  - **Subtitle (H1):** `font-weight: 600`, `font-size: clamp(1.4rem, 4vw, 2.2rem)`
  - **Intro Heading (H2):** `font-weight: 600`, `font-size: clamp(1.2rem, 3vw, 1.8rem)`

### Desktop (> 1100px)

No *structural* homepage-specific overrides other than the global ones above. Notion's default two-column layout is used for the hero row, with the profile pic and intro text side by side.

### Tablet (≤ 1100px) — `@media (max-width: 1100px)`

**File:** `src/styles/notion.css`, lines 15–200

**Strategy:** All elements stack vertically with centered text. Multi-column rows collapse to single columns.

| Element | Treatment |
|---|---|
| Cover image | `object-fit: contain`, full width |
| Title | Centered, `clamp(2.4rem, 8vw, 3.8rem)`, weight 800 |
| Subtitle row | Spacers hidden, columns collapse, height auto |
| Intro heading row | Same as subtitle, blanks hidden |
| Hero row | `flex-direction: column`, spacers hidden, columns 100% width |
| Profile pic | Container: `min(75vw, 500px)`, image fills at 100%, `border-radius: 1.25rem` |
| Intro text | Centered, `1rem` top margin for breathing room |
| Badges | 3-column CSS grid mosaic |
| Skills | Tabular (default Notion row behavior, scrollable) |

**Spacing Rules (Tablet):**

```
Cover Image
  ↓ margin-top: 0.5rem (title block)
Title ("Vivek Kaushik")
  ↓ margin-bottom: 0.25rem
Subtitle Row ("Azure AI Developer...")
  ↓ margin-bottom: 0.75rem
Intro Heading Row ("✦ Introduction ✦")
  ↓ margin-bottom: 0.75rem
Hero Row (Profile Pic)
  ↓ margin-top: 1rem (intro text)
Intro Text ("I'm a Fullstack...")
```

### Mobile (≤ 600px) — `@media (max-width: 600px)`

**File:** `src/styles/notion.css`, lines 289+, 426+, 830+, 911+

**Strategy:** Stacked layout, card-based skills, compact badge grid.

| Element | Treatment |
|---|---|
| Cover image | `object-fit: contain`, full width |
| Hero row | `flex-direction: column`, spacers hidden |
| Profile pic | Scales to viewport width |
| Badges | Mosaic pattern |
| Skills | Card-based stacked layout (not tabular) |
| Navigation | Avatar only (name hidden), compact links |

## CSS Architecture

### Selector Specificity

All tablet/mobile rules use `.index-page .notion-block-{id}` with `!important` to override:
1. Default `react-notion-x` styles
2. Inline `style` attributes set by Notion's renderer (e.g., column widths)

### Key Techniques

**1. Collapsing Multi-Column Rows:**
```css
/* Hide spacer between columns */
.notion-block-{row-id} .notion-spacer { display: none !important; }
/* Force columns to stack vertically */
.notion-block-{row-id} .notion-column {
  width: 100% !important;     /* Override inline calc() */
  max-width: 100% !important;
}
/* Set row to vertical flex */
.notion-block-{row-id} {
  display: flex !important;
  flex-direction: column !important;
  height: auto !important;    /* Kill fixed height */
}
```

**2. Scaling Images Past Notion's Constraints:**
```css
/* Set desired size on the figure element */
.notion-asset-wrapper-image {
  width: min(75vw, 500px) !important;
}
/* Inner div fills the figure */
.notion-asset-wrapper-image > div {
  width: 100% !important;
  height: auto !important;
}
/* Image fills its container */
.notion-asset-wrapper-image img {
  width: 100% !important;
  height: auto !important;
  object-fit: cover !important;
}
```

**3. Removing Notion's Gray Background:**
```css
.notion-asset-wrapper-image {
  background: transparent !important;
  background-color: transparent !important;
  border: none !important;
  box-shadow: none !important;
}
```

## Debugging Tips

> [!TIP]
> **Verify block IDs against live DOM:**
> ```bash
> curl -s http://localhost:3000 | grep -o 'notion-block-[a-f0-9]*' | sort -u | grep '9a4ad'
> ```

> [!TIP]
> **Extract hero section HTML for inspection:**
> ```bash
> curl -s http://localhost:3000 | python3 -c "
> import sys
> html = sys.stdin.read()
> start = html.find('notion-block-9a4ad916')
> tag_start = html.rfind('<', 0, start)
> print(html[tag_start:tag_start+2000])
> "
> ```

> [!WARNING]
> CSS `!important` **does** beat inline styles, but `width: fit-content` on a container will shrink it to the image's natural size (~225px), preventing the image from scaling up. Always use an explicit size like `min(75vw, 500px)` on the figure/wrapper.

## File Reference

| File | Lines | Purpose |
|---|---|---|
| `src/styles/notion.css` | 15–200 | Tablet (`≤ 1100px`) homepage overrides |
| `src/styles/notion.css` | 289–322 | Mobile (`≤ 600px`) nav overrides |
| `src/styles/notion.css` | 426+ | Mobile homepage hero overrides |
| `src/styles/notion.css` | 830+ | Mobile badge mosaic |
| `src/styles/notion.css` | 911+ | Mobile skills card layout |
