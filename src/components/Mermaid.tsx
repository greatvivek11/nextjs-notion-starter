'use client'

import * as React from 'react'
import { useDarkMode } from '@/lib/use-dark-mode'

// -----------------------------------------------------------------------------
// Mermaid Renderer Component
// -----------------------------------------------------------------------------

export const Mermaid: React.FC<{
  chart: string
}> = ({ chart }) => {
  const [svg, setSvg] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const { isDarkMode } = useDarkMode()

  React.useEffect(() => {
    let isMounted = true

    async function render() {
      try {
        const { default: mermaid } = await import('mermaid')
        
        mermaid.initialize({
          startOnLoad: false,
          theme: isDarkMode ? 'dark' : 'default',
          securityLevel: 'loose',
          fontFamily: 'inherit'
        })

        const id = `mermaid-${Math.random().toString(36).substring(2, 11)}`
        const { svg: renderedSvg } = await mermaid.render(id, chart)

        if (isMounted) {
          setSvg(renderedSvg)
          setError(null)
        }
      } catch (err: any) {
        console.error('Mermaid rendering error:', err)
        if (isMounted) {
          setError(err.message || 'Failed to render Mermaid diagram')
        }
      }
    }

    render()

    return () => {
      isMounted = false
    }
  }, [chart, isDarkMode])

  if (error) {
    return (
      <pre className='mermaid-error' style={{ 
        color: '#E03131', 
        padding: '1rem', 
        background: 'rgba(235, 87, 87, 0.1)',
        borderRadius: '4px',
        fontSize: '0.875rem'
      }}>
        <code>{error}</code>
        <br />
        <br />
        <code>{chart}</code>
      </pre>
    )
  }

  if (!svg) {
    return (
      <div className='mermaid-loading' style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        padding: '2rem',
        opacity: 0.5
      }}>
        Loading diagram...
      </div>
    )
  }

  return (
    <div
      className='mermaid-container'
      style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        margin: '2rem 0',
        width: '100%',
        overflowX: 'auto'
      }}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: Mermaid output is generated SVG
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
