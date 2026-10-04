# Homepage styling guide

The homepage remains Notion-rendered. Content, section order, rich-text colors,
and configured navigation destinations are preserved.

## Style ownership

| File | Responsibility |
| --- | --- |
| [`global.css`](../src/styles/global.css) | Design tokens, shell, navigation/footer, focus, code themes, audio, reduced motion |
| [`notion.css`](../src/styles/notion.css) | Shared renderer cards, images, quotes, article reading width |
| [`notion-homepage.css`](../src/styles/notion-homepage.css) | Root-only typography and content-specific responsive layouts |
| [`notion-mobile.css`](../src/styles/notion-mobile.css) | Existing renderer mobile compatibility rules |
| [`styles.module.css`](../src/components/styles.module.css) | Component-specific legacy styles |

Keep new homepage rules scoped to `.index-page`; use `.article-page` for
editorial article refinements and `.tags-page` for tag collection adjustments.
Do not hide every collection header to solve a tag-only issue.

## Presentation

- Local Inter regular/semibold fonts load through Next's local font loader.
- Neutral light/dark surfaces, restrained blue accents, consistent borders,
  spacing, radii, and short motion tokens live in the shared stylesheet.
- Root title: `clamp(2.2rem, 6vw, 3.75rem)`, weight 600, balanced wrapping.
- Article pages use a 780px reading width, generous line height, and left-aligned
  titles.
- Gallery cards use responsive minimum widths, modest title sizes, and subtle
  hover/focus elevation instead of brightness filters.
- Failed images retain their footprint and show a muted fallback instead of
  collapsing a cover and shifting the page.

## Responsive behavior

Custom shell navigation switches to a mobile disclosure at 900px. The toggle
is named and associated with the menu; closed links are hidden, Escape closes
the disclosure and restores focus, and route changes close it.
The shared theme toggle appears in the custom navbar or in the footer when
using default Notion navigation, so both modes retain theme switching.

The existing root-specific tablet breakpoint is 1100px. It hides the homepage
aside, centers the content, stacks the profile/intro row, and renders
certification badges in three columns.

At 600px the profile is more compact, the badge mosaic uses two columns, and
skills stack into cards. Mobile introduction text is intentionally left-aligned;
its rule overrides the preceding tablet centering rule.

## Content-specific block selectors

These existing exceptions remain because Notion's columns encode content-specific
layouts. IDs remain valid only while those blocks are retained in Notion.

| Block | ID |
| --- | --- |
| Title | `a869e19a3e74488ca16349aee7581cb2` |
| Subtitle row | `fbd8305bf95341418ff30f0f32a36622` |
| Intro heading row | `9ef57da840544a3ea5677e7636177fd1` |
| Profile/intro row | `9a4ad916180b41f5ba93b6e82da6a546` |
| Badges row | `a2f58273435540c7be9b38a3cca7a811` |
| Skills row | `3d30db2722f84441a6bd7c8e06ebfeb8` |

After changing Notion structure, inspect the rendered DOM before changing these
selectors. Do not duplicate old exceptions in another override file or remove
them without checking the affected layouts.

## Accessibility and motion

The shell has a visible-on-focus skip link and consistent focus outlines.
Social icon links are explicitly named, controls have adequate hit areas,
and the shell does not add a second main landmark around Notion's own main.

Card transforms and menu entry are brief. `prefers-reduced-motion` disables
decorative motion and audio smooth scrolling. Content never depends on a
scroll-reveal script to become visible.

## Validation

The automated markup tests check menu association/closed state, social link
names, theme controls in both navigation modes, and the Notion renderer's
escaped readable code before highlighting. A stylesheet regression test checks
that reduced-motion rules apply at every viewport width. These are not browser
accessibility or layout tests.

Before deployment, review homepage, blog listing, article, tag, and missing-page
screens at 360, 390, 768, 1024, and 1440 CSS pixels, both themes, keyboard-only
navigation, and reduced motion. Check image/code/PDF behavior, console errors,
hydration, overflow, and content visibility with JavaScript disabled.
