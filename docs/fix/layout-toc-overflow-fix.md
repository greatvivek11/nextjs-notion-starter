# Fix: Layout Width & TOC Overflow

**Date**: March 6, 2026  
**Files Modified**: `src/styles/notion.css`, `src/components/styles.module.css`

## Problem

1. Main content was only ~60% of the cover image width, leaving asymmetric whitespace.
2. Table of Contents (TOC) overflowed past the right edge of the viewport, especially at 125%+ zoom or 1080p resolutions.
3. Social icons on the home page lost their `position: sticky` behavior.

## Root Cause

### TOC Overflow
The `react-notion-x` library uses this formula to position the aside container:

```css
/* react-notion-x/src/styles.css, line 177 */
.notion-page-content-has-aside {
    width: calc((100vw + var(--notion-max-width)) / 2);
}
```

With a large `--notion-max-width`, this pushes the container beyond the viewport edge. Additionally, the library forces `min-width: 222px` on `.notion-aside-table-of-contents`, preventing the TOC from shrinking to fit.

### Sticky Broken
Initial fix attempts used `overflow-x: hidden` on `.notion-page-scroller`, which prevents horizontal scrollbar but **breaks `position: sticky`** on all descendants (a known CSS limitation).

## Solution

### 1. Viewport-Relative Widths
Replaced all fixed-pixel widths with `65vw`:

```css
.notion { --notion-max-width: 65vw; }
.notion-page-cover-wrapper { max-width: 65vw !important; }
.notion-header .notion-nav-header { max-width: 65vw; }
/* Footer: max-width: 65vw (in styles.module.css) */
```

This ensures cover, content, header, and footer always scale together at any zoom level.

### 2. Aside Containment
The aside gets exactly `17.5vw` of space (half of the remaining `35vw`):

```css
.notion-aside {
    width: calc(17.5vw - 2.5rem);
    min-width: 0 !important;        /* Override library's forced min-width */
    flex: 0 0 auto;
}

.notion-aside-table-of-contents {
    min-width: 0 !important;         /* Override library's 222px min-width */
    font-size: 12px;                 /* Smaller text for navigational aid */
}
```

### 3. Overflow Without Breaking Sticky

```css
.notion-page-scroller {
    overflow-x: clip;    /* NOT hidden — clip prevents scrollbar without breaking sticky */
}
```

### 4. Lower Aside Breakpoint
Overrode the library's `1300px` breakpoint to `1000px` so the aside remains visible at higher zoom levels:

```css
@media (min-width: 1000px) and (min-height: 300px) {
    .notion-page-content-has-aside { display: flex; flex-direction: row; }
    .notion-page-content-has-aside .notion-aside { display: flex; }
}
```

## Key Takeaway

When overriding `react-notion-x` layout styles:
- **Don't use `overflow: hidden`** on ancestors of sticky elements. Use `overflow: clip` instead.
- **Don't cap the aside container width** (`max-width: 100%`) — this breaks the side-by-side layout. Instead, constrain the aside itself.
- **Always override `min-width: 222px`** on `.notion-aside-table-of-contents` when using custom widths.
