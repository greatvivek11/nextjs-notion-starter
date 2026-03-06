'use client'

import { cn } from '@/lib/utils'
import React from 'react'

// -----------------------------------------------------------------------------
// Shiki Highlighter Singleton
// -----------------------------------------------------------------------------

let highlighterPromise: Promise<any> | null = null

async function getHighlighter() {
  if (highlighterPromise) return highlighterPromise

  highlighterPromise = (async () => {
    const { createHighlighter } = await import('shiki')

    return await createHighlighter({
      themes: ['github-dark', 'github-light'],
      langs: [
        'javascript',
        'typescript',
        'bash',
        'json',
        'python',
        'csharp',
        'cpp',
        'rust',
        'sql',
        'yaml',
        'markdown',
        'html',
        'css'
      ]
    })
  })()

  return highlighterPromise
}

export const ShikiCode: React.FC<{
  code: string
  language?: string
  className?: string
}> = ({ code, language = 'javascript', className }) => {
  const [html, setHtml] = React.useState<string | null>(null)
  const isDark =
    typeof window !== 'undefined' &&
    document.documentElement.classList.contains('dark-mode')

  React.useEffect(() => {
    let isMounted = true

    async function highlight() {
      try {
        const highlighter = await getHighlighter()
        if (!isMounted) return

        const theme = isDark ? 'github-dark' : 'github-light'

        // Map common Notion language names to Shiki names if needed
        let lang = language.toLowerCase()
        if (lang === 'c#') lang = 'csharp'
        if (lang === 'c++') lang = 'cpp'

        const output = highlighter.codeToHtml(code, {
          lang,
          theme
        })

        if (isMounted) {
          setHtml(output)
        }
      } catch (err) {
        console.error('Shiki highlighting error:', err)
        if (isMounted) {
          setHtml(`<pre><code>${code}</code></pre>`)
        }
      }
    }

    highlight()

    return () => {
      isMounted = false
    }
  }, [code, language, isDark])

  if (!html) {
    return (
      <pre className={cn('shiki-loading', className)}>
        <code>{code}</code>
      </pre>
    )
  }

  return (
    <div
      className={cn('shiki-container', className)}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: Shiki output is trusted syntax-highlighted HTML
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
