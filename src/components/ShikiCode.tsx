'use client'

import { cn } from '@/lib/utils'
import * as React from 'react'
import type { BundledLanguage } from 'shiki'
import type { HighlighterCore } from 'shiki/core'

let highlighterPromise: Promise<HighlighterCore> | undefined

function getHighlighter(): Promise<HighlighterCore> {
  if (!highlighterPromise) {
    highlighterPromise = (async () => {
      const [
        { createHighlighterCore },
        { createJavaScriptRegexEngine },
        dark,
        light
      ] = await Promise.all([
        import('shiki/core'),
        import('shiki/engine/javascript'),
        import('shiki/themes/github-dark.mjs'),
        import('shiki/themes/github-light.mjs')
      ])
      return createHighlighterCore({
        themes: [dark.default, light.default],
        langs: [],
        engine: createJavaScriptRegexEngine()
      })
    })().catch((error: unknown) => {
      highlighterPromise = undefined
      throw error
    })
  }
  return highlighterPromise
}

const aliases: Record<string, string> = {
  'c#': 'csharp',
  'c++': 'cpp',
  'plain text': 'text',
  plaintext: 'text',
  js: 'javascript',
  ts: 'typescript',
  shell: 'bash'
}

export const ShikiCode = ({
  code,
  language = 'javascript',
  className
}: {
  code: string
  language?: string
  className?: string
}) => {
  const [highlighted, setHighlighted] = React.useState<{
    code: string
    language: string
    html: string
  } | null>(null)

  React.useEffect(() => {
    let cancelled = false
    async function highlight() {
      try {
        const highlighter = await getHighlighter()
        const { bundledLanguages } = await import('shiki/langs')
        const normalized = language.toLowerCase()
        const lang = aliases[normalized] || normalized
        function isBundledLanguage(value: string): value is BundledLanguage {
          return Object.hasOwn(bundledLanguages, value)
        }
        if (lang !== 'text' && !isBundledLanguage(lang)) {
          console.warn('[Code] Unsupported highlighting language', { language })
          return
        }
        if (
          isBundledLanguage(lang) &&
          !highlighter.getLoadedLanguages().includes(lang)
        ) {
          await highlighter.loadLanguage(await bundledLanguages[lang]())
        }
        const html = highlighter.codeToHtml(code, {
          lang,
          themes: { light: 'github-light', dark: 'github-dark' }
        })
        if (!cancelled) setHighlighted({ code, language, html })
      } catch (error) {
        console.error('[Code] Syntax highlighting failed', error)
      }
    }
    void highlight()
    return () => {
      cancelled = true
    }
  }, [code, language])

  if (
    !highlighted ||
    highlighted.code !== code ||
    highlighted.language !== language
  ) {
    return (
      <pre className={cn('shiki-loading', className)}>
        <code>{code}</code>
      </pre>
    )
  }
  return (
    <div
      className={cn('shiki-container', className)}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: Only escaped Shiki output reaches this sink; failures render React text.
      dangerouslySetInnerHTML={{ __html: highlighted.html }}
    />
  )
}
