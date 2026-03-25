# Fixing Audio Sync Backward Jump Regression

## The Mystery of the "Jump to Callout"
Despite previously implementing monotonic forward-only tracking, the highlight visually jumped back to the callout block (the top of the article). Surgical console logging revealed that the tracker `activeWordIndex` was **never** going backward. Instead, it was progressing from index 55 (the callout) to index 80 (a paragraph 10 pages down) - but index 80 itself was physically sitting *inside* the callout block!

## Root Causes Identified

### 1. False-Positive Seek Detection (Addressed)
The initial theory was a brittle manual time-delta check (`Math.abs(currentTime - lastTime) > 1.5s`) that was acting as a false positive for manual seeking when React or the browser stuttered, causing the mathematical tracking index to reset to zero. 
- **Fix**: Replaced with native `seeked` event handling and forward-only search starting from `lastAlignIdxRef.current`.

### 2. Ghost DOM Duplication (The Ultimate Fix)
This was the final ghost! `react-notion-x` renders Callout blocks with nested text classes:
```html
<div class="notion-callout-text">
  <div class="notion-text">...text...</div>
</div>
```
Our `querySelectorAll` matched **both** the parent `.notion-callout-text` AND the child `.notion-text`.
1. The script first processed the parent, wrapping all ~56 words in `<span>` tags.
2. It then processed the nested child, walking over the same text nodes and wrapping them in *another* layer of spans.
3. This created 56 "ghost" duplicate words in the tracking array that physically occupied the same space in the callout.

When the audio chronologically searched for a word like "practical" later in the article (at word index 80), it found the ghost duplicate of "practical" sitting back in the callout block!

## Final Resolution

### Block Deduplication
Updated the block selection logic using an array filter to guarantee that if Node A contains Node B, Node B is excluded. This restricts the iteration to top-level blocks only and structurally prevents duplicate DOM tracking.

```typescript
const blockNodes = allNodes.filter(
  (node) => !allNodes.some((parent) => parent !== node && parent.contains(node))
)
```

### Direct DOM Sync (No Cached Refs)
Moved the highlight toggle logic away from mutable React `wordRefs` (which could go stale or hold onto ghosts). Now, the code surgically searches the live browser DOM 60 times a second using the unique `data-audio-word-index` attribute.

### Monotonic Logic
The `lastAlignIdxRef` now serves as an immutable anchor, ensuring that once the tracker moves past a word, it can NEVER re-trigger a word sitting earlier in the array unless a native `seeked` event is received.

## Implementation Files
- [src/components/ArticleAudioPlayer.tsx](file:///Users/vivekkaushik/Projects/nextjs-notion-starter/src/components/ArticleAudioPlayer.tsx) - Deduplication and live DOM sync.
- [docs/fix/audio-sync-backward-jump.md](file:///Users/vivekkaushik/Projects/nextjs-notion-starter/docs/fix/audio-sync-backward-jump.md) - Documentation.
